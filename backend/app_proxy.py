import os
import sys
import datetime
import logging
import socket
from typing import Any, Dict, Optional
from urllib.parse import urlparse

# Ensure that the proxy directory sees our FastAPI backend folder
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from proxy.http.proxy import HttpProxyBasePlugin
from proxy.http import httpMethods, httpStatusCodes
from proxy.http.parser import HttpParser
from proxy.http.responses import seeOthersResponse
from proxy.http.exception import HttpRequestRejected
import models
from database import SessionLocal

logger = logging.getLogger(__name__)
CAPTIVE_PORTAL_URL = os.getenv("CAPTIVE_PORTAL_URL", "http://127.0.0.1:3000/portal")
CAPTIVE_EXTRA_ALLOWED_HOSTS = os.getenv("CAPTIVE_ALLOWED_HOSTS", "")

class StudentUsagePlugin(HttpProxyBasePlugin):
    """
    Plugin for proxy.py that intercepts client requests and logs their data usage
    and visited domains into the Student Internet Usage database.
    """

    def _normalize_host(self, host: Optional[bytes]) -> str:
        if not host:
            return ""
        host_text = host.decode("utf-8", errors="ignore") if isinstance(host, bytes) else str(host)
        return host_text.split(":")[0].strip().lower()

    def _allowed_portal_hosts(self) -> set[str]:
        hosts = set()
        parsed = urlparse(CAPTIVE_PORTAL_URL)
        if parsed.hostname:
            hosts.add(parsed.hostname.lower())
        for raw in CAPTIVE_EXTRA_ALLOWED_HOSTS.split(","):
            value = raw.strip().lower()
            if value:
                hosts.add(value.split(":")[0])
        # Also trust every local interface IP so changing adapters/hotspot IP
        # does not break captive portal access.
        hosts.update(self._local_ipv4_addresses())
        return hosts

    def _local_ipv4_addresses(self) -> set[str]:
        ips = {"127.0.0.1", "localhost"}
        try:
            hostname = socket.gethostname()
            for item in socket.getaddrinfo(hostname, None, socket.AF_INET):
                ip = item[4][0]
                if ip:
                    ips.add(ip.lower())
        except Exception:
            pass
        return ips

    def _detect_server_ip_for_client(self, client_ip: str) -> Optional[str]:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                sock.connect((client_ip, 1))
                server_ip = sock.getsockname()[0]
                return server_ip
        except Exception:
            return None

    def _portal_url_for_client(self, client_ip: str) -> str:
        parsed = urlparse(CAPTIVE_PORTAL_URL)
        detected_ip = self._detect_server_ip_for_client(client_ip)
        if not detected_ip:
            return CAPTIVE_PORTAL_URL
        scheme = parsed.scheme or "http"
        port = parsed.port or (443 if scheme == "https" else 80)
        path = parsed.path or "/portal"
        if port in (80, 443):
            return f"{scheme}://{detected_ip}{path}"
        return f"{scheme}://{detected_ip}:{port}{path}"

    def _request_path_text(self, request: HttpParser) -> str:
        raw_path = request.path or b""
        if isinstance(raw_path, bytes):
            return raw_path.decode("utf-8", errors="ignore")
        return str(raw_path)

    def _is_portal_bootstrap_request(self, request: HttpParser, request_host: str, client_ip: str) -> bool:
        allowed_hosts = set(self._allowed_portal_hosts())
        detected_server_ip = self._detect_server_ip_for_client(client_ip)
        if detected_server_ip:
            allowed_hosts.add(detected_server_ip.lower())
        if request_host not in allowed_hosts:
            return False
        path = self._request_path_text(request)
        if request.method == httpMethods.OPTIONS:
            return True
        allowed_prefixes = (
            "/portal",
            "/login",
            "/register",
            "/docs",
            "/openapi.json",
            "/_next/",
        )
        return any(path.startswith(prefix) for prefix in allowed_prefixes)

    def _resolve_active_session(self, db: SessionLocal, client_ip: str, now: datetime.datetime):
        active_assignment = db.query(models.SessionIPAssignment).filter(
            models.SessionIPAssignment.ip_address == client_ip,
            models.SessionIPAssignment.assigned_at <= now,
            (models.SessionIPAssignment.released_at == None) | (models.SessionIPAssignment.released_at >= now),
        ).order_by(models.SessionIPAssignment.assigned_at.desc()).first()

        if active_assignment:
            session = db.query(models.Session).filter(
                models.Session.session_id == active_assignment.session_id,
                models.Session.login_time <= now,
                (models.Session.logout_time == None) | (models.Session.logout_time >= now),
            ).first()
            if session:
                return session

        return db.query(models.Session).filter(
            models.Session.ip_address == client_ip,
            models.Session.login_time <= now,
            (models.Session.logout_time == None) | (models.Session.logout_time >= now),
        ).order_by(models.Session.login_time.desc()).first()

    def handle_client_request(self, request: HttpParser) -> Optional[HttpParser]:
        assert self.client.addr
        client_ip = self.client.addr[0]
        now = datetime.datetime.utcnow()
        portal_url = self._portal_url_for_client(client_ip)
        allowed_hosts = set(self._allowed_portal_hosts())
        detected_server_ip = self._detect_server_ip_for_client(client_ip)
        if detected_server_ip:
            allowed_hosts.add(detected_server_ip.lower())
        request_host = self._normalize_host(request.host)

        if request_host in allowed_hosts:
            return request
        if self._is_portal_bootstrap_request(request, request_host, client_ip):
            return request

        db = SessionLocal()
        try:
            active_session = self._resolve_active_session(db, client_ip, now)
            if active_session is None:
                if request.method != httpMethods.CONNECT:
                    self.client.queue(seeOthersResponse(portal_url.encode("utf-8")))
                    return None
                raise HttpRequestRejected(
                    status_code=httpStatusCodes.PROXY_AUTH_REQUIRED,
                    reason=b'Portal login required',
                )

            user = db.query(models.User).filter(models.User.id == active_session.user_id).first()
            is_authorized = bool(
                user and user.approval_status == "approved" and user.role != "guest"
            )
            if is_authorized:
                return request

            if request.method != httpMethods.CONNECT:
                self.client.queue(seeOthersResponse(portal_url.encode("utf-8")))
                return None
            raise HttpRequestRejected(
                status_code=httpStatusCodes.PROXY_AUTH_REQUIRED,
                reason=b'Portal login required',
            )
        finally:
            db.close()

    def on_access_log(self, context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        try:
            req_bytes = int(context.get('request_bytes', 0) or 0)
            res_bytes = int(context.get('response_bytes', 0) or 0)
            total_bytes = req_bytes + res_bytes
            
            client_ip = context.get('client_ip')
            
            # The domain normally sits in server_host for HTTP and CONNECT (HTTPS)
            # Sometimes it's bytes, sometimes it's str depending on the context
            server_host = context.get('server_host')
            if isinstance(server_host, bytes):
                domain = server_host.decode('utf-8', errors='ignore')
            elif isinstance(server_host, str):
                domain = server_host
            else:
                domain = ""
                
            if not domain:
                # fallback to request_path
                path = context.get('request_path', b'')
                if isinstance(path, bytes):
                    path = path.decode('utf-8', errors='ignore')
                if "://" in path:
                    domain = path.split("://")[1].split("/")[0]
                else:
                    domain = path.split("/")[0]
                    
            if not client_ip or not domain:
                return context
                
            # Remove port from domain
            domain = domain.split(":")[0]
            
            data_mb = total_bytes / (1024.0 * 1024.0)
            
            # Ensure ANY access log is recorded, even if traffic shows 0 bytes measured right now
            if data_mb == 0:
                data_mb = 0.0001
            
            if data_mb > 0:
                self.log_to_db(client_ip, domain, data_mb)
                
        except Exception as e:
            logger.error(f"Error in StudentUsagePlugin: {e}", exc_info=True)

        return context
        
    def log_to_db(self, ip: str, website: str, mb: float):
        db = SessionLocal()
        try:
            now = datetime.datetime.utcnow()

            active_session = self._resolve_active_session(db, ip, now)
            
            if not active_session:
                # If no session, wait, should we skip?
                # The user says "anyone that connects to it i can see the traffic"
                # If they want to see "anyone", maybe we should log to an "Unknown User" session if no session exists,
                # or we just let it drop if authentication is required. 
                # Let's check `seed.py` or default assumptions to see if we should create a fallback session.
                # Actually, the proxy logs processing logic skipped logs without sessions.
                # Let's create an "Unauthenticated" user and session if it doesn't exist, to capture ALL traffic.
                user = db.query(models.User).filter_by(username="guest").first()
                if not user:
                    user = models.User(
                        name="Guest User",
                        username="guest",
                        password_hash="none",
                        role="guest",
                        approval_status="approved",
                    )
                    db.add(user)
                    db.commit()
                    db.refresh(user)
                elif user.role != "guest":
                    user.role = "guest"
                    db.commit()
                
                # Check for a guest session
                active_session = db.query(models.Session).filter(
                    models.Session.user_id == user.id,
                    models.Session.ip_address == ip,
                    models.Session.logout_time == None
                ).order_by(models.Session.login_time.desc()).first()
                if not active_session:
                    active_session = models.Session(user_id=user.id, ip_address=ip, auth_source="proxy_fallback")
                    db.add(active_session)
                    db.commit()
                    db.refresh(active_session)
                
            # Check or create category
            cat = db.query(models.Category).filter(models.Category.website == website).first()
            cat_id = cat.id if cat else None
            
            if not cat:
                new_cat = models.Category(website=website, category="Uncategorized")
                db.add(new_cat)
                db.commit()
                db.refresh(new_cat)
                cat_id = new_cat.id
                
            # Add log
            new_log = models.Log(
                session_id=active_session.session_id,
                website=website,
                category_id=cat_id,
                data_used_mb=mb,
                timestamp=now
            )
            db.add(new_log)

            # Automatic enforcement: if a flagged site is accessed, block user
            # and close active sessions until admin re-approves.
            flagged = db.query(models.FlaggedSite).filter(
                models.FlaggedSite.website == website.lower(),
                models.FlaggedSite.is_active == 1
            ).first()
            if flagged and active_session and active_session.user_id:
                violator = db.query(models.User).filter(models.User.id == active_session.user_id).first()
                if violator and violator.role != "admin":
                    violator.approval_status = "rejected"
                    violator.approved_at = now
                    open_sessions = db.query(models.Session).filter(
                        models.Session.user_id == violator.id,
                        models.Session.logout_time == None
                    ).all()
                    for sess in open_sessions:
                        sess.logout_time = now
                        active_assignment = db.query(models.SessionIPAssignment).filter(
                            models.SessionIPAssignment.session_id == sess.session_id,
                            models.SessionIPAssignment.released_at == None
                        ).order_by(models.SessionIPAssignment.assigned_at.desc()).first()
                        if active_assignment:
                            active_assignment.released_at = now
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"DB Error while logging traffic: {e}", exc_info=True)
        finally:
            db.close()
