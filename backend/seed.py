"""
Database bootstrap and mock data seed.

Usage:
  python seed.py           Create DB + tables; seed only empty tables (safe).
  python seed.py --reset   Drop all tables, recreate, load full mock dataset (dev).

`npm run db` invokes `seed.py --reset` for a complete local database.
"""
import argparse
import os
import random

import pymysql
from database import engine, Base, SessionLocal
import models
from passlib.context import CryptContext
from datetime import datetime, timedelta

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

MOCK_WEBSITES = [
    "google.com",
    "youtube.com",
    "github.com",
    "facebook.com",
    "wikipedia.org",
    "instagram.com",
    "netflix.com",
    "tiktok.com",
]


def _get_db_creds():
    return (
        os.getenv("DB_USER", "root"),
        os.getenv("DB_PASSWORD", ""),
        os.getenv("DB_HOST", "127.0.0.1"),
        int(os.getenv("DB_PORT", "3306")),
        os.getenv("DB_NAME", "student_usage_db"),
    )


def ensure_database_exists():
    USER, PASSWORD, HOST, PORT, NAME = _get_db_creds()
    print(f"Connecting to MySQL server at {HOST}:{PORT}...")
    try:
        connection = pymysql.connect(host=HOST, user=USER, password=PASSWORD, port=PORT)
        cursor = connection.cursor()
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{NAME}`;")
        connection.commit()
        cursor.close()
        connection.close()
        print(f"Database '{NAME}' created or already exists.")
        return True
    except Exception as e:
        print(f"Failed to create database: {e}")
        return False


def reset_schema():
    print("Reset mode: dropping all application tables...")
    Base.metadata.drop_all(bind=engine)
    print("Creating tables from models...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully.")


def create_tables_only():
    print("Creating tables (if missing)...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully.")


def seed_categories(db):
    categories = [
        models.Category(website="google.com", category="Education"),
        models.Category(website="wikipedia.org", category="Education"),
        models.Category(website="github.com", category="Education"),
        models.Category(website="facebook.com", category="Social Media"),
        models.Category(website="instagram.com", category="Social Media"),
        models.Category(website="youtube.com", category="Entertainment"),
        models.Category(website="netflix.com", category="Entertainment"),
        models.Category(website="tiktok.com", category="Social Media"),
    ]
    db.add_all(categories)
    db.commit()
    print(f"Seeded {len(categories)} categories.")


def seed_users(db):
    hashed_pw = pwd_context.hash("password123")
    users = [
        models.User(
            name="Admin User",
            username="admin",
            password_hash=hashed_pw,
            role="admin",
            approval_status="approved",
        ),
        models.User(
            name="Student One",
            username="student1",
            password_hash=hashed_pw,
            role="student",
            approval_status="approved",
        ),
        models.User(
            name="Student Two",
            username="student2",
            password_hash=hashed_pw,
            role="student",
            approval_status="approved",
        ),
        models.User(
            name="Student Three",
            username="student3",
            password_hash=hashed_pw,
            role="student",
            approval_status="approved",
        ),
        models.User(
            name="Pending Student",
            username="pending_student",
            password_hash=hashed_pw,
            role="student",
            approval_status="pending",
        ),
        models.User(
            name="Network Analyst",
            username="analyst1",
            password_hash=hashed_pw,
            role="network_analyst",
            approval_status="approved",
        ),
    ]
    db.add_all(users)
    db.commit()
    for u in users:
        db.refresh(u)
    print(f"Seeded {len(users)} users (password for all seeded accounts: password123).")


def seed_sessions_and_assignments(db):
    now = datetime.utcnow()
    student1 = db.query(models.User).filter(models.User.username == "student1").first()
    student2 = db.query(models.User).filter(models.User.username == "student2").first()
    student3 = db.query(models.User).filter(models.User.username == "student3").first()
    admin = db.query(models.User).filter(models.User.username == "admin").first()
    analyst = db.query(models.User).filter(models.User.username == "analyst1").first()

    sessions = [
        # Active portal-style sessions
        models.Session(
            user_id=student1.id,
            ip_address="192.168.1.10",
            device_identifier="seed-device-student1",
            auth_source="portal_login",
            login_time=now - timedelta(days=5),
            last_heartbeat_at=now - timedelta(minutes=2),
            logout_time=None,
        ),
        models.Session(
            user_id=student2.id,
            ip_address="192.168.1.11",
            device_identifier="seed-device-student2",
            auth_source="portal_login",
            login_time=now - timedelta(days=4),
            last_heartbeat_at=now - timedelta(minutes=5),
            logout_time=None,
        ),
        models.Session(
            user_id=student3.id,
            ip_address="192.168.1.12",
            device_identifier="seed-device-student3",
            auth_source="portal_login",
            login_time=now - timedelta(days=3),
            last_heartbeat_at=now - timedelta(minutes=10),
            logout_time=None,
        ),
        # Closed session (student1 older visit) for history charts
        models.Session(
            user_id=student1.id,
            ip_address="192.168.1.50",
            device_identifier="seed-device-student1-old",
            auth_source="portal_login",
            login_time=now - timedelta(days=10),
            last_heartbeat_at=now - timedelta(days=9),
            logout_time=now - timedelta(days=9, hours=2),
        ),
        models.Session(
            user_id=admin.id,
            ip_address="127.0.0.1",
            device_identifier="seed-device-admin",
            auth_source="portal_login",
            login_time=now - timedelta(days=1),
            last_heartbeat_at=now - timedelta(hours=1),
            logout_time=None,
        ),
        models.Session(
            user_id=analyst.id,
            ip_address="192.168.1.20",
            device_identifier="seed-device-analyst",
            auth_source="wifi_portal",
            login_time=now - timedelta(days=2),
            last_heartbeat_at=now - timedelta(hours=3),
            logout_time=None,
        ),
    ]
    db.add_all(sessions)
    db.commit()
    for s in sessions:
        db.refresh(s)
    print(f"Seeded {len(sessions)} sessions.")

    assignments = []
    for s in sessions:
        assignments.append(
            models.SessionIPAssignment(
                session_id=s.session_id,
                ip_address=s.ip_address,
                assigned_at=s.login_time,
                released_at=s.logout_time,
            )
        )
    db.add_all(assignments)
    db.commit()
    print(f"Seeded {len(assignments)} session IP assignments.")
    return sessions


def seed_logs(db, sessions):
    random.seed(42)
    now = datetime.utcnow()
    cat_by_site = {c.website: c for c in db.query(models.Category).all()}
    logs = []
    for session in sessions:
        n_rows = 24 if session.logout_time is None else 12
        for i in range(n_rows):
            site = MOCK_WEBSITES[i % len(MOCK_WEBSITES)]
            cat = cat_by_site.get(site)
            if session.logout_time:
                span = (session.logout_time - session.login_time).total_seconds()
                if span <= 60:
                    span = 3600.0
                ts = session.login_time + timedelta(seconds=span * (i + 1) / (n_rows + 1))
                ts = min(ts, session.logout_time - timedelta(seconds=30))
            else:
                ts = now - timedelta(hours=i + random.randint(0, 6), minutes=random.randint(0, 59))
                if ts < session.login_time + timedelta(minutes=1):
                    ts = session.login_time + timedelta(minutes=i + 1)
            mb = round(random.uniform(0.05, 120.0), 4)
            logs.append(
                models.Log(
                    session_id=session.session_id,
                    website=site,
                    category_id=cat.id if cat else None,
                    data_used_mb=mb,
                    timestamp=ts,
                )
            )
    db.add_all(logs)
    db.commit()
    print(f"Seeded {len(logs)} traffic log rows.")


def seed_flagged_sites(db, admin):
    sites = [
        models.FlaggedSite(website="tiktok.com", is_active=0, created_by_user_id=admin.id),
        models.FlaggedSite(website="malware.example.test", is_active=1, created_by_user_id=admin.id),
    ]
    db.add_all(sites)
    db.commit()
    print(f"Seeded {len(sites)} flagged site rules (one inactive, one active test host).")


def seed_full_mock_dataset(db):
    """Assumes empty tables after reset (or first install)."""
    seed_categories(db)
    seed_users(db)
    seed_sessions_and_assignments(db)
    sessions = db.query(models.Session).order_by(models.Session.session_id.asc()).all()
    seed_logs(db, sessions)
    admin = db.query(models.User).filter(models.User.username == "admin").first()
    if admin:
        seed_flagged_sites(db, admin)
    print("Full mock dataset loaded.")


def seed_incremental_if_empty(db):
    """Original behavior: only fill tables that have no rows."""
    if not db.query(models.Category).first():
        seed_categories(db)
    if not db.query(models.User).first():
        seed_users(db)
    if not db.query(models.Session).first():
        seed_sessions_and_assignments(db)
    if not db.query(models.Log).first() and db.query(models.Session).first():
        sessions = db.query(models.Session).order_by(models.Session.session_id.asc()).all()
        seed_logs(db, sessions)
    elif not db.query(models.SessionIPAssignment).first() and db.query(models.Session).first():
        sessions = db.query(models.Session).all()
        assignments = []
        for s in sessions:
            assignments.append(
                models.SessionIPAssignment(
                    session_id=s.session_id,
                    ip_address=s.ip_address,
                    assigned_at=s.login_time,
                    released_at=s.logout_time,
                )
            )
        if assignments:
            db.add_all(assignments)
            db.commit()
            print("Session IP assignments seeded.")
    if not db.query(models.FlaggedSite).first():
        admin = db.query(models.User).filter(models.User.username == "admin").first()
        if admin:
            seed_flagged_sites(db, admin)


def init_db(reset: bool = False):
    if not ensure_database_exists():
        return

    if reset:
        reset_schema()
    else:
        create_tables_only()

    db = SessionLocal()
    try:
        if reset:
            seed_full_mock_dataset(db)
        else:
            seed_incremental_if_empty(db)
    finally:
        db.close()

    print("Database seeding completed.")


def main():
    parser = argparse.ArgumentParser(description="Create MySQL database, tables, and seed data.")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Drop all ORM tables and reload complete mock data (development only).",
    )
    args = parser.parse_args()
    init_db(reset=args.reset)


if __name__ == "__main__":
    main()
