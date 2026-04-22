from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, Request, Header, Query
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from datetime import datetime, timedelta
from typing import Optional
import os
from pathlib import Path
from database import get_db, engine
import models
import schemas
from log_processor import process_proxy_logs
from passlib.context import CryptContext
from jose import JWTError, jwt

app = FastAPI(title="Student Internet Usage Analysis API")
MEDIA_DIR = Path(__file__).resolve().parent / "media"
MEDIA_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(MEDIA_DIR)), name="media")

CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://192.168.137.1:3000,http://172.16.124.223:3000",
)
ALLOWED_CORS_ORIGINS = [origin.strip() for origin in CORS_ORIGINS.split(",") if origin.strip()]
ALLOWED_CORS_ORIGIN_REGEX = os.getenv(
    "CORS_ORIGIN_REGEX",
    r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|172\.16\.\d{1,3}\.\d{1,3})(:\d+)?$",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_CORS_ORIGINS,
    allow_origin_regex=ALLOWED_CORS_ORIGIN_REGEX,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

SECRET_KEY = os.getenv("SECRET_KEY", "secret_key")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ALLOWED_USER_ROLES = {"network_analyst", "admin", "student", "guest", "co"}
HEARTBEAT_TIMEOUT_MINUTES = int(os.getenv("HEARTBEAT_TIMEOUT_MINUTES", "5"))
NETWORK_EVENT_SECRET = os.getenv("NETWORK_EVENT_SECRET", "change_this_secret")

def ensure_identity_schema():
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'approved'"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by_user_id INT NULL"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at DATETIME NULL"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url VARCHAR(255) NULL"))
        conn.execute(text("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_identifier VARCHAR(128) NULL"))
        conn.execute(text("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS auth_source VARCHAR(50) NOT NULL DEFAULT 'wifi_portal'"))
        conn.execute(text("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_heartbeat_at DATETIME NULL"))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS session_ip_assignments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                session_id INT NOT NULL,
                ip_address VARCHAR(45) NOT NULL,
                assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                released_at DATETIME NULL,
                INDEX idx_session_ip_assignments_session_id (session_id),
                INDEX idx_session_ip_assignments_ip_address (ip_address),
                CONSTRAINT fk_session_ip_assignments_session_id FOREIGN KEY (session_id) REFERENCES sessions(session_id)
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS flagged_sites (
                id INT AUTO_INCREMENT PRIMARY KEY,
                website VARCHAR(255) NOT NULL UNIQUE,
                is_active TINYINT NOT NULL DEFAULT 1,
                created_by_user_id INT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_flagged_sites_website (website),
                INDEX idx_flagged_sites_active (is_active)
            )
        """))

def close_stale_portal_sessions(db: Session):
    cutoff = datetime.utcnow() - timedelta(minutes=HEARTBEAT_TIMEOUT_MINUTES)
    stale_sessions = db.query(models.Session).filter(
        models.Session.auth_source == "portal_login",
        models.Session.logout_time == None,
        models.Session.last_heartbeat_at != None,
        models.Session.last_heartbeat_at < cutoff
    ).all()

    for stale in stale_sessions:
        stale.logout_time = cutoff
        active_assignment = db.query(models.SessionIPAssignment).filter(
            models.SessionIPAssignment.session_id == stale.session_id,
            models.SessionIPAssignment.released_at == None
        ).order_by(models.SessionIPAssignment.assigned_at.desc()).first()
        if active_assignment:
            active_assignment.released_at = cutoff
    if stale_sessions:
        db.commit()

# Security
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

def require_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

def require_access_approved(user: models.User):
    if user.role != "admin" and user.approval_status != "approved":
        raise HTTPException(
            status_code=403,
            detail="Access pending admin approval. Please wait for approval before using internet access.",
        )

def parse_date_boundary(value: Optional[str], is_end: bool = False) -> Optional[datetime]:
    if not value:
        return None
    cleaned = value.strip()
    try:
        if "T" in cleaned:
            return datetime.fromisoformat(cleaned)
        if is_end:
            return datetime.fromisoformat(f"{cleaned}T23:59:59")
        return datetime.fromisoformat(f"{cleaned}T00:00:00")
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {value}. Use YYYY-MM-DD or ISO datetime.")

def upsert_portal_session_for_user(
    db: Session,
    user: models.User,
    ip_address: str,
    device_identifier: str,
    auth_source: str = "portal_login",
):
    now = datetime.utcnow()
    active_session = db.query(models.Session).filter(
        models.Session.user_id == user.id,
        models.Session.device_identifier == device_identifier,
        models.Session.auth_source == auth_source,
        models.Session.logout_time == None
    ).order_by(models.Session.login_time.desc()).first()

    if not active_session:
        active_session = models.Session(
            user_id=user.id,
            ip_address=ip_address,
            device_identifier=device_identifier,
            auth_source=auth_source,
            login_time=now,
            last_heartbeat_at=now,
            logout_time=None,
        )
        db.add(active_session)
        db.commit()
        db.refresh(active_session)

        db.add(models.SessionIPAssignment(
            session_id=active_session.session_id,
            ip_address=ip_address,
            assigned_at=now,
            released_at=None,
        ))
        db.commit()
        return active_session

    if active_session.ip_address != ip_address:
        open_assignment = db.query(models.SessionIPAssignment).filter(
            models.SessionIPAssignment.session_id == active_session.session_id,
            models.SessionIPAssignment.released_at == None
        ).order_by(models.SessionIPAssignment.assigned_at.desc()).first()
        if open_assignment:
            open_assignment.released_at = now
        db.add(models.SessionIPAssignment(
            session_id=active_session.session_id,
            ip_address=ip_address,
            assigned_at=now,
            released_at=None,
        ))
        active_session.ip_address = ip_address
        db.commit()
        db.refresh(active_session)
    active_session.last_heartbeat_at = now
    db.commit()
    db.refresh(active_session)

    return active_session

@app.on_event("startup")
def on_startup():
    ensure_identity_schema()

# Routes
@app.post("/login", response_model=schemas.Token)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    user_agent: Optional[str] = Header(default=None, alias="User-Agent"),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    require_access_approved(user)
    
    access_token = create_access_token(data={"sub": user.username})
    ip_address = request.client.host if request.client else "0.0.0.0"
    device_identifier = (user_agent or "unknown-device")[:120]
    portal_session = upsert_portal_session_for_user(db, user, ip_address, device_identifier, "portal_login")
    return {"access_token": access_token, "token_type": "bearer", "session_id": portal_session.session_id}

@app.post("/register", response_model=schemas.UserOut, status_code=201)
def register_student(payload: schemas.StudentRegister, db: Session = Depends(get_db)):
    username = payload.username.strip()
    if db.query(models.User).filter(models.User.username == username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    user = models.User(
        name=payload.name.strip(),
        username=username,
        password_hash=pwd_context.hash(payload.password),
        role="student",
        approval_status="pending",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@app.post("/portal/heartbeat", response_model=schemas.SessionOut)
def portal_heartbeat(
    request: Request,
    user_agent: Optional[str] = Header(default=None, alias="User-Agent"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    close_stale_portal_sessions(db)
    ip_address = request.client.host if request.client else "0.0.0.0"
    device_identifier = (user_agent or "unknown-device")[:120]
    return upsert_portal_session_for_user(db, current_user, ip_address, device_identifier, "portal_login")

@app.get("/portal/status", response_model=schemas.PortalStatus)
def portal_status(
    user_agent: Optional[str] = Header(default=None, alias="User-Agent"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    close_stale_portal_sessions(db)
    device_identifier = (user_agent or "unknown-device")[:120]
    active_session = db.query(models.Session).filter(
        models.Session.user_id == current_user.id,
        models.Session.device_identifier == device_identifier,
        models.Session.auth_source == "portal_login",
        models.Session.logout_time == None
    ).order_by(models.Session.login_time.desc()).first()
    if not active_session:
        raise HTTPException(status_code=404, detail="No active portal session")

    return {
        "session_id": active_session.session_id,
        "ip_address": active_session.ip_address,
        "login_time": active_session.login_time,
        "last_heartbeat_at": active_session.last_heartbeat_at,
        "is_online": True
    }

@app.post("/portal/logout")
def portal_logout(
    request: Request,
    user_agent: Optional[str] = Header(default=None, alias="User-Agent"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.utcnow()
    ip_address = request.client.host if request.client else "0.0.0.0"
    device_identifier = (user_agent or "unknown-device")[:120]
    active_session = db.query(models.Session).filter(
        models.Session.user_id == current_user.id,
        models.Session.device_identifier == device_identifier,
        models.Session.auth_source == "portal_login",
        models.Session.logout_time == None
    ).order_by(models.Session.login_time.desc()).first()
    if not active_session:
        return {"message": "No active portal session found"}

    active_session.logout_time = now
    open_assignment = db.query(models.SessionIPAssignment).filter(
        models.SessionIPAssignment.session_id == active_session.session_id,
        models.SessionIPAssignment.released_at == None
    ).order_by(models.SessionIPAssignment.assigned_at.desc()).first()
    if open_assignment:
        open_assignment.released_at = now
    if active_session.ip_address != ip_address:
        active_session.ip_address = ip_address
    db.commit()
    return {"message": "Portal session closed", "session_id": active_session.session_id}

@app.post("/portal/network-event", response_model=schemas.NetworkEventResponse)
def portal_network_event(
    payload: schemas.NetworkEventRequest,
    x_network_secret: Optional[str] = Header(default=None, alias="X-Network-Secret"),
    db: Session = Depends(get_db),
):
    if x_network_secret != NETWORK_EVENT_SECRET:
        raise HTTPException(status_code=401, detail="Invalid network event secret")

    close_stale_portal_sessions(db)
    event_type = payload.event_type.strip().lower()
    event_time = payload.event_time or datetime.utcnow()
    device_identifier = (payload.device_identifier or "network-event-device")[:120]
    username = payload.username.strip()
    ip_address = payload.ip_address.strip()

    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    active_session = db.query(models.Session).filter(
        models.Session.user_id == user.id,
        models.Session.device_identifier == device_identifier,
        models.Session.auth_source == "portal_login",
        models.Session.logout_time == None
    ).order_by(models.Session.login_time.desc()).first()

    if event_type == "connect":
        active = upsert_portal_session_for_user(db, user, ip_address, device_identifier, "portal_login")
        if active.last_heartbeat_at is None:
            active.last_heartbeat_at = event_time
            db.commit()
            db.refresh(active)
        return {"message": "connect event applied", "session_id": active.session_id}

    if event_type == "ip_change":
        if not active_session:
            active = upsert_portal_session_for_user(db, user, ip_address, device_identifier, "portal_login")
            return {"message": "ip_change created new active session", "session_id": active.session_id}
        if active_session.ip_address != ip_address:
            active_assignment = db.query(models.SessionIPAssignment).filter(
                models.SessionIPAssignment.session_id == active_session.session_id,
                models.SessionIPAssignment.released_at == None
            ).order_by(models.SessionIPAssignment.assigned_at.desc()).first()
            if active_assignment:
                active_assignment.released_at = event_time
            db.add(models.SessionIPAssignment(
                session_id=active_session.session_id,
                ip_address=ip_address,
                assigned_at=event_time,
                released_at=None
            ))
            active_session.ip_address = ip_address
        active_session.last_heartbeat_at = event_time
        db.commit()
        return {"message": "ip_change event applied", "session_id": active_session.session_id}

    if event_type == "disconnect":
        if not active_session:
            return {"message": "No active session to disconnect", "session_id": None}
        active_session.logout_time = event_time
        active_session.last_heartbeat_at = event_time
        active_assignment = db.query(models.SessionIPAssignment).filter(
            models.SessionIPAssignment.session_id == active_session.session_id,
            models.SessionIPAssignment.released_at == None
        ).order_by(models.SessionIPAssignment.assigned_at.desc()).first()
        if active_assignment:
            active_assignment.released_at = event_time
        db.commit()
        return {"message": "disconnect event applied", "session_id": active_session.session_id}

    raise HTTPException(status_code=400, detail="Unsupported event_type. Use connect, ip_change, or disconnect")

@app.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user

@app.get("/me/profile", response_model=schemas.UserOut)
def get_my_profile(current_user: models.User = Depends(get_current_user)):
    return current_user

@app.put("/me/profile", response_model=schemas.UserOut)
def update_my_profile(payload: schemas.UserProfileUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    username = payload.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    existing = db.query(models.User).filter(models.User.username == username, models.User.id != current_user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    current_user.name = payload.name.strip() or current_user.name
    current_user.username = username
    if payload.password and payload.password.strip():
        current_user.password_hash = pwd_context.hash(payload.password.strip())
    db.commit()
    db.refresh(current_user)
    return current_user

@app.post("/me/profile-image", response_model=schemas.UserOut)
async def upload_my_profile_image(
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    content_type = (image.content_type or "").lower()
    if content_type not in {"image/png", "image/jpeg", "image/jpg", "image/webp"}:
        raise HTTPException(status_code=400, detail="Only PNG, JPG, JPEG, and WEBP images are allowed")
    ext = ".png"
    if "jpeg" in content_type or "jpg" in content_type:
        ext = ".jpg"
    elif "webp" in content_type:
        ext = ".webp"

    file_name = f"user_{current_user.id}_{int(datetime.utcnow().timestamp())}{ext}"
    file_path = MEDIA_DIR / file_name
    file_bytes = await image.read()
    if len(file_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image size must be 5MB or less")
    file_path.write_bytes(file_bytes)

    current_user.profile_image_url = f"/media/{file_name}"
    db.commit()
    db.refresh(current_user)
    return current_user

@app.get("/users", response_model=list[schemas.UserOut])
def list_users(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    users = db.query(models.User).order_by(models.User.id.asc()).all()
    return users

@app.post("/users", response_model=schemas.UserOut, status_code=201)
def create_user(
    payload: schemas.UserCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    role = payload.role.strip().lower()
    if role not in ALLOWED_USER_ROLES:
        allowed = ", ".join(sorted(ALLOWED_USER_ROLES))
        raise HTTPException(status_code=400, detail=f"Invalid role. Allowed roles: {allowed}")

    existing_user = db.query(models.User).filter(models.User.username == payload.username.strip()).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")

    user = models.User(
        name=payload.name.strip(),
        username=payload.username.strip(),
        password_hash=pwd_context.hash(payload.password),
        role=role,
        approval_status="approved",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@app.get("/users/pending", response_model=list[schemas.UserOut])
def list_pending_users(db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    return db.query(models.User).filter(models.User.approval_status == "pending").order_by(models.User.id.asc()).all()

@app.get("/users/requests", response_model=list[schemas.UserOut])
def list_user_requests(status_filter: str = "pending", db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    status_value = status_filter.strip().lower()
    query = db.query(models.User)
    if status_value in {"pending", "approved", "rejected"}:
        query = query.filter(models.User.approval_status == status_value)
    return query.order_by(models.User.id.desc()).all()

@app.post("/users/{user_id}/approve", response_model=schemas.UserOut)
def approve_user(user_id: int, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.approval_status = "approved"
    user.approved_by_user_id = admin.id
    user.approved_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return user

@app.post("/users/{user_id}/reject", response_model=schemas.UserOut)
def reject_user(user_id: int, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Admin users cannot be rejected")
    user.approval_status = "rejected"
    user.approved_by_user_id = admin.id
    user.approved_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return user

@app.post("/users/{user_id}/drop-access", response_model=schemas.UserOut)
def drop_user_access(user_id: int, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Admin users cannot be dropped")

    now = datetime.utcnow()
    active_sessions = db.query(models.Session).filter(
        models.Session.user_id == user.id,
        models.Session.logout_time == None
    ).all()
    for session in active_sessions:
        session.logout_time = now
        active_assignment = db.query(models.SessionIPAssignment).filter(
            models.SessionIPAssignment.session_id == session.session_id,
            models.SessionIPAssignment.released_at == None
        ).order_by(models.SessionIPAssignment.assigned_at.desc()).first()
        if active_assignment:
            active_assignment.released_at = now

    # Mark as rejected so login/proxy authorization fails until admin re-approves.
    user.approval_status = "rejected"
    user.approved_by_user_id = admin.id
    user.approved_at = now
    db.commit()
    db.refresh(user)
    return user

@app.get("/analysis/top-site", response_model=schemas.TopVisitedSiteAnalysis)
def get_top_site_analysis(db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    row = db.query(
        models.Log.website.label("website"),
        func.count(models.Log.id).label("visits"),
        func.sum(models.Log.data_used_mb).label("total_data_mb"),
    ).group_by(models.Log.website).order_by(func.count(models.Log.id).desc()).first()
    if not row:
        return {"website": "N/A", "visits": 0, "total_data_mb": 0.0}
    return {
        "website": row.website,
        "visits": int(row.visits or 0),
        "total_data_mb": round(float(row.total_data_mb or 0.0), 4),
    }

@app.get("/analysis/users/{user_id}/top-site", response_model=schemas.TopVisitedSiteAnalysis)
def get_user_top_site_analysis(user_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    row = db.query(
        models.Log.website.label("website"),
        func.count(models.Log.id).label("visits"),
        func.sum(models.Log.data_used_mb).label("total_data_mb"),
    ).select_from(models.Log)\
     .join(models.Session, models.Log.session_id == models.Session.session_id)\
     .filter(models.Session.user_id == user_id)\
     .group_by(models.Log.website)\
     .order_by(func.count(models.Log.id).desc())\
     .first()

    if not row:
        return {
            "website": "N/A",
            "visits": 0,
            "total_data_mb": 0.0,
            "user_id": user.id,
            "username": user.username,
        }
    return {
        "website": row.website,
        "visits": int(row.visits or 0),
        "total_data_mb": round(float(row.total_data_mb or 0.0), 4),
        "user_id": user.id,
        "username": user.username,
    }

@app.get("/flagged-sites", response_model=list[schemas.FlaggedSiteOut])
def list_flagged_sites(db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    return db.query(models.FlaggedSite).order_by(models.FlaggedSite.created_at.desc()).all()

@app.post("/flagged-sites", response_model=schemas.FlaggedSiteOut, status_code=201)
def add_flagged_site(payload: schemas.FlaggedSiteCreate, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    website = payload.website.strip().lower()
    if not website:
        raise HTTPException(status_code=400, detail="Website is required")
    existing = db.query(models.FlaggedSite).filter(models.FlaggedSite.website == website).first()
    if existing:
        existing.is_active = 1
        db.commit()
        db.refresh(existing)
        return existing
    item = models.FlaggedSite(
        website=website,
        is_active=1,
        created_by_user_id=admin.id
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@app.post("/flagged-sites/{site_id}/deactivate", response_model=schemas.FlaggedSiteOut)
def deactivate_flagged_site(site_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    item = db.query(models.FlaggedSite).filter(models.FlaggedSite.id == site_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Flagged site not found")
    item.is_active = 0
    db.commit()
    db.refresh(item)
    return item

@app.post("/flagged-sites/{site_id}/activate", response_model=schemas.FlaggedSiteOut)
def activate_flagged_site(site_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    item = db.query(models.FlaggedSite).filter(models.FlaggedSite.id == site_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Flagged site not found")
    item.is_active = 1
    db.commit()
    db.refresh(item)
    return item

@app.post("/identity/wifi-connect", response_model=schemas.SessionOut, status_code=201)
def wifi_connect(payload: schemas.WifiConnectRequest, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    user = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    connected_at = payload.connected_at or datetime.utcnow()
    wifi_session = models.Session(
        user_id=payload.user_id,
        ip_address=payload.ip_address,
        device_identifier=payload.device_identifier,
        auth_source=payload.auth_source,
        login_time=connected_at,
        logout_time=None,
    )
    db.add(wifi_session)
    db.commit()
    db.refresh(wifi_session)

    assignment = models.SessionIPAssignment(
        session_id=wifi_session.session_id,
        ip_address=payload.ip_address,
        assigned_at=connected_at,
        released_at=None,
    )
    db.add(assignment)
    db.commit()
    return wifi_session

@app.get("/identity/sessions", response_model=list[schemas.SessionListItem])
def list_identity_sessions(include_closed: bool = False, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    close_stale_portal_sessions(db)
    query = db.query(
        models.Session.session_id,
        models.Session.user_id,
        models.User.username,
        models.Session.ip_address,
        models.Session.device_identifier,
        models.Session.auth_source,
        models.Session.login_time,
        models.Session.last_heartbeat_at,
        models.Session.logout_time,
    ).join(models.User, models.Session.user_id == models.User.id)

    if not include_closed:
        query = query.filter(models.Session.logout_time == None)

    rows = query.order_by(models.Session.login_time.desc()).all()
    return [
        {
            "session_id": row.session_id,
            "user_id": row.user_id,
            "username": row.username,
            "ip_address": row.ip_address,
            "device_identifier": row.device_identifier,
            "auth_source": row.auth_source,
            "login_time": row.login_time,
            "last_heartbeat_at": row.last_heartbeat_at,
            "logout_time": row.logout_time,
        }
        for row in rows
    ]

@app.get("/metrics/online-users", response_model=list[schemas.OnlineUserItem])
def get_online_users(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    close_stale_portal_sessions(db)
    rows = db.query(
        models.Session.user_id,
        models.User.username,
        models.Session.ip_address,
        models.Session.device_identifier,
        models.Session.last_heartbeat_at,
    ).join(models.User, models.Session.user_id == models.User.id).filter(
        models.Session.auth_source == "portal_login",
        models.Session.logout_time == None
    ).order_by(models.Session.last_heartbeat_at.desc()).all()
    return [
        {
            "user_id": row.user_id,
            "username": row.username,
            "ip_address": row.ip_address,
            "device_identifier": row.device_identifier,
            "last_heartbeat_at": row.last_heartbeat_at,
        }
        for row in rows
    ]

@app.get("/metrics/proxy-active-clients", response_model=list[schemas.ProxyActiveClientItem])
def get_proxy_active_clients(minutes: int = 10, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    window_minutes = max(1, min(minutes, 240))
    since = datetime.utcnow() - timedelta(minutes=window_minutes)
    rows = db.query(
        models.Session.ip_address.label("ip_address"),
        models.User.username.label("username"),
        func.count(func.distinct(models.Log.website)).label("website_count"),
        func.sum(models.Log.data_used_mb).label("total_data_mb"),
        func.max(models.Log.timestamp).label("last_seen_at"),
    ).select_from(models.Log)\
     .join(models.Session, models.Log.session_id == models.Session.session_id)\
     .join(models.User, models.Session.user_id == models.User.id)\
     .filter(models.Log.timestamp >= since)\
     .group_by(models.Session.ip_address, models.User.username)\
     .order_by(func.max(models.Log.timestamp).desc())\
     .all()

    return [
        {
            "ip_address": row.ip_address,
            "username": row.username,
            "website_count": int(row.website_count or 0),
            "total_data_mb": round(float(row.total_data_mb or 0.0), 4),
            "last_seen_at": row.last_seen_at,
        }
        for row in rows
        if row.last_seen_at is not None
    ]

@app.post("/identity/sessions/{session_id}/ip-change", response_model=schemas.SessionOut)
def update_session_ip(session_id: int, payload: schemas.IpChangeRequest, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    wifi_session = db.query(models.Session).filter(models.Session.session_id == session_id).first()
    if not wifi_session:
        raise HTTPException(status_code=404, detail="Session not found")
    if wifi_session.logout_time is not None:
        raise HTTPException(status_code=400, detail="Cannot change IP on a disconnected session")

    changed_at = payload.changed_at or datetime.utcnow()

    active_assignment = db.query(models.SessionIPAssignment).filter(
        models.SessionIPAssignment.session_id == session_id,
        models.SessionIPAssignment.released_at == None
    ).order_by(models.SessionIPAssignment.assigned_at.desc()).first()

    if active_assignment:
        active_assignment.released_at = changed_at

    new_assignment = models.SessionIPAssignment(
        session_id=session_id,
        ip_address=payload.ip_address,
        assigned_at=changed_at,
        released_at=None,
    )
    wifi_session.ip_address = payload.ip_address
    db.add(new_assignment)
    db.commit()
    db.refresh(wifi_session)
    return wifi_session

@app.post("/identity/sessions/{session_id}/disconnect", response_model=schemas.SessionOut)
def disconnect_session(session_id: int, payload: schemas.DisconnectRequest, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    wifi_session = db.query(models.Session).filter(models.Session.session_id == session_id).first()
    if not wifi_session:
        raise HTTPException(status_code=404, detail="Session not found")
    if wifi_session.logout_time is not None:
        return wifi_session

    disconnected_at = payload.disconnected_at or datetime.utcnow()
    wifi_session.logout_time = disconnected_at

    active_assignment = db.query(models.SessionIPAssignment).filter(
        models.SessionIPAssignment.session_id == session_id,
        models.SessionIPAssignment.released_at == None
    ).order_by(models.SessionIPAssignment.assigned_at.desc()).first()
    if active_assignment:
        active_assignment.released_at = disconnected_at

    db.commit()
    db.refresh(wifi_session)
    return wifi_session

@app.get("/users/{user_id}/traffic", response_model=schemas.UserTrafficDetails)
def get_user_traffic(user_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    logs = db.query(models.Log.website, models.Log.data_used_mb)\
        .join(models.Session, models.Log.session_id == models.Session.session_id)\
        .filter(models.Session.user_id == user_id).all()

    total_data_mb = sum(log.data_used_mb for log in logs) if logs else 0.0
    accessed_sites = sorted({log.website for log in logs})

    return {
        "user_id": target_user.id,
        "username": target_user.username,
        "total_data_mb": round(total_data_mb, 4),
        "accessed_sites": accessed_sites
    }

@app.post("/upload-logs")
async def upload_logs(file: UploadFile = File(...), current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.csv', '.txt')):
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    content = await file.read()
    inserted = process_proxy_logs(content, db)
    
    return {"message": "Logs processed successfully", "records_inserted": inserted}

@app.get("/metrics/usage-summary", response_model=schemas.UsageSummary)
def get_usage_summary(db: Session = Depends(get_db)):
    # Total data mb
    total_data = db.query(func.sum(models.Log.data_used_mb)).scalar() or 0.0
    
    # Total active users (from sessions or just users who have logs)
    total_users_query = db.query(func.count(func.distinct(models.Session.user_id)))\
        .join(models.Log, models.Session.session_id == models.Log.session_id).scalar() or 0
        
    # Top website
    top_site = db.query(models.Log.website, func.sum(models.Log.data_used_mb).label('total'))\
        .group_by(models.Log.website).order_by(func.sum(models.Log.data_used_mb).desc()).first()
        
    top_website_name = top_site[0] if top_site else "N/A"
    
    return schemas.UsageSummary(
        total_data_mb=round(total_data, 2),
        total_users=total_users_query,
        top_website=top_website_name
    )

@app.get("/metrics/top-users", response_model=list[schemas.TopUser])
def get_top_users(db: Session = Depends(get_db)):
    results = db.query(
        models.User.name.label("username"),
        func.sum(models.Log.data_used_mb).label("data_mb")
    ).select_from(models.Log)\
     .join(models.Session, models.Log.session_id == models.Session.session_id)\
     .join(models.User, models.Session.user_id == models.User.id)\
     .group_by(models.User.id)\
     .order_by(func.sum(models.Log.data_used_mb).desc())\
     .limit(10).all()
     
    return [{"username": r.username, "data_mb": round(r.data_mb, 2)} for r in results]

@app.get("/metrics/top-websites", response_model=list[schemas.TopWebsite])
def get_top_websites(db: Session = Depends(get_db)):
    results = db.query(
        models.Log.website,
        func.sum(models.Log.data_used_mb).label("data_mb"),
        models.Category.category
    ).outerjoin(models.Category, models.Log.category_id == models.Category.id)\
     .group_by(models.Log.website, models.Category.category)\
     .order_by(func.sum(models.Log.data_used_mb).desc())\
     .limit(10).all()
     
    return [{"website": r.website, "data_mb": round(r.data_mb, 2), "category": r.category or "Uncategorized"} for r in results]

@app.get("/metrics/usage-by-category", response_model=list[schemas.UsageByCategory])
def get_usage_by_category(db: Session = Depends(get_db)):
    results = db.query(
        models.Category.category,
        func.sum(models.Log.data_used_mb).label("data_mb")
    ).select_from(models.Log)\
     .join(models.Category, models.Log.category_id == models.Category.id)\
     .group_by(models.Category.category)\
     .order_by(func.sum(models.Log.data_used_mb).desc()).all()
     
    return [{"category": r.category, "data_mb": round(r.data_mb, 2)} for r in results]

@app.get("/metrics/trends", response_model=list[schemas.TrendPoint])
def get_trends(db: Session = Depends(get_db)):
    # Group by Date
    results = db.query(
        func.date(models.Log.timestamp).label("date"),
        func.sum(models.Log.data_used_mb).label("data_mb")
    ).group_by(func.date(models.Log.timestamp))\
     .order_by(func.date(models.Log.timestamp)).all()
     
    return [{"date": str(r.date), "data_mb": round(r.data_mb, 2)} for r in results]

@app.get("/metrics/traffic", response_model=list[schemas.TrafficDetails])
def get_traffic_details(db: Session = Depends(get_db)):
    logs = db.query(
        models.Log.website,
        models.Log.data_used_mb,
        models.User.name.label("username")
    ).select_from(models.Log)\
     .join(models.Session, models.Log.session_id == models.Session.session_id)\
     .join(models.User, models.Session.user_id == models.User.id).all()
    
    traffic_map = {}
    for log in logs:
        if log.website not in traffic_map:
            traffic_map[log.website] = {"data_mb": 0.0, "users": set()}
        traffic_map[log.website]["data_mb"] += log.data_used_mb
        traffic_map[log.website]["users"].add(log.username)
        
    result = []
    for website, data in traffic_map.items():
        result.append({
            "website": website,
            "total_data_mb": round(data["data_mb"], 4),
            "users": list(data["users"])
        })
    result.sort(key=lambda x: x["total_data_mb"], reverse=True)
    return result

@app.get("/metrics/my-traffic", response_model=list[schemas.TrafficDetails])
def get_my_traffic(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    logs = db.query(
        models.Log.website,
        models.Log.data_used_mb
    ).select_from(models.Log)\
     .join(models.Session, models.Log.session_id == models.Session.session_id)\
     .filter(models.Session.user_id == current_user.id)\
     .all()

    traffic_map = {}
    for log in logs:
        if log.website not in traffic_map:
            traffic_map[log.website] = {"data_mb": 0.0}
        traffic_map[log.website]["data_mb"] += log.data_used_mb

    result = []
    for website, data in traffic_map.items():
        result.append({
            "website": website,
            "total_data_mb": round(data["data_mb"], 4),
            "users": [current_user.name],
        })
    result.sort(key=lambda x: x["total_data_mb"], reverse=True)
    return result

@app.get("/metrics/traffic/{website}/users", response_model=list[schemas.SiteUserTraffic])
def get_site_user_traffic(website: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    rows = db.query(
        models.Session.session_id.label("session_id"),
        models.User.name.label("username"),
        models.Session.ip_address.label("ip_address"),
        models.User.role.label("role"),
        func.sum(models.Log.data_used_mb).label("total_data_mb"),
        func.max(models.Log.timestamp).label("last_seen_at")
    ).select_from(models.Log)\
     .join(models.Session, models.Log.session_id == models.Session.session_id)\
     .join(models.User, models.Session.user_id == models.User.id)\
     .filter(models.Log.website == website)\
     .group_by(models.Session.session_id, models.User.id, models.User.name, models.Session.ip_address, models.User.role)\
     .order_by(func.sum(models.Log.data_used_mb).desc())\
     .all()

    return [
        {
            "session_id": row.session_id,
            "username": row.username,
            "ip_address": row.ip_address,
            "role": row.role,
            "total_data_mb": round(float(row.total_data_mb or 0.0), 4),
            "last_seen_at": row.last_seen_at,
        }
        for row in rows
    ]

@app.get("/metrics/logs", response_model=list[schemas.LogExportItem])
def get_filtered_logs(
    user_id: Optional[int] = Query(default=None),
    website: Optional[str] = Query(default=None),
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    limit: int = Query(default=500, ge=1, le=5000),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    start_dt = parse_date_boundary(start_date, is_end=False)
    end_dt = parse_date_boundary(end_date, is_end=True)
    if start_dt and end_dt and start_dt > end_dt:
        raise HTTPException(status_code=400, detail="start_date cannot be later than end_date")

    rows_query = db.query(
        models.Log.id.label("log_id"),
        models.Log.timestamp,
        models.Log.website,
        models.Log.data_used_mb,
        models.User.name.label("username"),
        models.User.id.label("user_id"),
        models.User.role.label("role"),
        models.Session.session_id.label("session_id"),
        models.Session.ip_address.label("ip_address"),
    ).select_from(models.Log)\
     .join(models.Session, models.Log.session_id == models.Session.session_id)\
     .join(models.User, models.Session.user_id == models.User.id)

    if current_user.role != "admin":
        rows_query = rows_query.filter(models.User.id == current_user.id)
    elif user_id is not None:
        rows_query = rows_query.filter(models.User.id == user_id)

    if website and website.strip():
        rows_query = rows_query.filter(models.Log.website.ilike(f"%{website.strip()}%"))
    if start_dt:
        rows_query = rows_query.filter(models.Log.timestamp >= start_dt)
    if end_dt:
        rows_query = rows_query.filter(models.Log.timestamp <= end_dt)

    rows = rows_query.order_by(models.Log.timestamp.desc()).limit(limit).all()
    return [
        {
            "log_id": row.log_id,
            "timestamp": row.timestamp,
            "website": row.website,
            "data_used_mb": round(float(row.data_used_mb or 0.0), 4),
            "username": row.username,
            "user_id": row.user_id,
            "role": row.role,
            "session_id": row.session_id,
            "ip_address": row.ip_address,
        }
        for row in rows
    ]

@app.get("/metrics/logs/export")
def export_filtered_logs_csv(
    user_id: Optional[int] = Query(default=None),
    website: Optional[str] = Query(default=None),
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    start_dt = parse_date_boundary(start_date, is_end=False)
    end_dt = parse_date_boundary(end_date, is_end=True)
    if start_dt and end_dt and start_dt > end_dt:
        raise HTTPException(status_code=400, detail="start_date cannot be later than end_date")

    rows_query = db.query(
        models.Log.id.label("log_id"),
        models.Log.timestamp,
        models.Log.website,
        models.Log.data_used_mb,
        models.User.name.label("username"),
        models.User.id.label("user_id"),
        models.User.role.label("role"),
        models.Session.session_id.label("session_id"),
        models.Session.ip_address.label("ip_address"),
    ).select_from(models.Log)\
     .join(models.Session, models.Log.session_id == models.Session.session_id)\
     .join(models.User, models.Session.user_id == models.User.id)

    if current_user.role != "admin":
        rows_query = rows_query.filter(models.User.id == current_user.id)
    elif user_id is not None:
        rows_query = rows_query.filter(models.User.id == user_id)

    if website and website.strip():
        rows_query = rows_query.filter(models.Log.website.ilike(f"%{website.strip()}%"))
    if start_dt:
        rows_query = rows_query.filter(models.Log.timestamp >= start_dt)
    if end_dt:
        rows_query = rows_query.filter(models.Log.timestamp <= end_dt)

    rows = rows_query.order_by(models.Log.timestamp.desc()).all()

    csv_lines = ["log_id,timestamp,website,data_used_mb,username,user_id,role,session_id,ip_address"]
    for row in rows:
        website_value = (row.website or "").replace('"', '""')
        username_value = (row.username or "").replace('"', '""')
        ip_value = (row.ip_address or "").replace('"', '""')
        csv_lines.append(
            f'{row.log_id},"{row.timestamp.isoformat() if row.timestamp else ""}","{website_value}",{round(float(row.data_used_mb or 0.0), 4)},"{username_value}",{row.user_id},"{row.role}",{row.session_id},"{ip_value}"'
        )

    from fastapi.responses import Response
    csv_content = "\n".join(csv_lines)
    filename = f'logs_export_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}.csv'
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@app.get("/metrics/user-activity", response_model=list[schemas.UserActivityDetails])
def get_user_activity(db: Session = Depends(get_db)):
    logs = db.query(
        models.User.name.label("username"),
        models.Log.website,
        models.Log.data_used_mb
    ).select_from(models.Log)\
     .join(models.Session, models.Log.session_id == models.Session.session_id)\
     .join(models.User, models.Session.user_id == models.User.id).all()
     
    user_map = {}
    for log in logs:
        if log.username not in user_map:
            user_map[log.username] = {"data_mb": 0.0, "sites": set()}
        user_map[log.username]["data_mb"] += log.data_used_mb
        user_map[log.username]["sites"].add(log.website)
        
    result = []
    for username, data in user_map.items():
        result.append({
            "username": username,
            "total_data_mb": round(data["data_mb"], 4),
            "visited_sites": list(data["sites"])
        })
    result.sort(key=lambda x: x["total_data_mb"], reverse=True)
    return result
