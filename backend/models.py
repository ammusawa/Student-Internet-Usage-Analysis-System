from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    username = Column(String(50), unique=True, index=True)
    password_hash = Column(String(200))
    role = Column(String(50), default="student")
    approval_status = Column(String(20), default="approved", index=True)
    approved_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    profile_image_url = Column(String(255), nullable=True)
    
    sessions = relationship("Session", back_populates="user")

class Session(Base):
    __tablename__ = "sessions"

    session_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    ip_address = Column(String(45), index=True)
    device_identifier = Column(String(128), nullable=True, index=True)
    auth_source = Column(String(50), default="wifi_portal")
    login_time = Column(DateTime, default=datetime.datetime.utcnow)
    last_heartbeat_at = Column(DateTime, nullable=True, default=datetime.datetime.utcnow)
    logout_time = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="sessions")
    logs = relationship("Log", back_populates="session")
    ip_assignments = relationship("SessionIPAssignment", back_populates="session")

class SessionIPAssignment(Base):
    __tablename__ = "session_ip_assignments"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.session_id"), index=True)
    ip_address = Column(String(45), index=True)
    assigned_at = Column(DateTime, default=datetime.datetime.utcnow)
    released_at = Column(DateTime, nullable=True)

    session = relationship("Session", back_populates="ip_assignments")

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    website = Column(String(255), unique=True, index=True)
    category = Column(String(100))
    
    logs = relationship("Log", back_populates="category_rel")

class FlaggedSite(Base):
    __tablename__ = "flagged_sites"

    id = Column(Integer, primary_key=True, index=True)
    website = Column(String(255), unique=True, index=True)
    is_active = Column(Integer, default=1)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Log(Base):
    __tablename__ = "logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.session_id"))
    website = Column(String(255), index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    data_used_mb = Column(Float)
    timestamp = Column(DateTime)

    session = relationship("Session", back_populates="logs")
    category_rel = relationship("Category", back_populates="logs")
