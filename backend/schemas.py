from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    session_id: Optional[int] = None

class UserOut(BaseModel):
    id: int
    name: str
    username: str
    role: str
    approval_status: str
    profile_image_url: Optional[str] = None

    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    name: str
    username: str
    password: str
    role: str

class UserProfileUpdate(BaseModel):
    name: str
    username: str
    password: Optional[str] = None

class StudentRegister(BaseModel):
    name: str
    username: str
    password: str

class UsageSummary(BaseModel):
    total_data_mb: float
    total_users: int
    top_website: str

class TopUser(BaseModel):
    username: str
    data_mb: float

class TopWebsite(BaseModel):
    website: str
    data_mb: float
    category: Optional[str]

class UsageByCategory(BaseModel):
    category: str
    data_mb: float

class TrendPoint(BaseModel):
    date: str
    data_mb: float

class TrafficLog(BaseModel):
    website: str
    data_mb: float
    timestamp: str
    username: str

class UserActivity(BaseModel):
    username: str
    total_data_mb: float
    top_sites: List[str]

class TrafficDetails(BaseModel):
    website: str
    total_data_mb: float
    users: List[str]

class LogExportItem(BaseModel):
    log_id: int
    timestamp: datetime
    website: str
    data_used_mb: float
    username: str
    user_id: int
    role: str
    session_id: int
    ip_address: str

class UserActivityDetails(BaseModel):
    username: str
    total_data_mb: float
    visited_sites: List[str]

class UserTrafficDetails(BaseModel):
    user_id: int
    username: str
    total_data_mb: float
    accessed_sites: List[str]

class WifiConnectRequest(BaseModel):
    user_id: int
    ip_address: str
    device_identifier: Optional[str] = None
    auth_source: str = "wifi_portal"
    connected_at: Optional[datetime] = None

class IpChangeRequest(BaseModel):
    ip_address: str
    changed_at: Optional[datetime] = None

class DisconnectRequest(BaseModel):
    disconnected_at: Optional[datetime] = None

class SessionOut(BaseModel):
    session_id: int
    user_id: int
    ip_address: str
    device_identifier: Optional[str]
    auth_source: str
    login_time: datetime
    last_heartbeat_at: Optional[datetime]
    logout_time: Optional[datetime]

    class Config:
        from_attributes = True

class SessionListItem(BaseModel):
    session_id: int
    user_id: int
    username: str
    ip_address: str
    device_identifier: Optional[str]
    auth_source: str
    login_time: datetime
    last_heartbeat_at: Optional[datetime]
    logout_time: Optional[datetime]

class PortalStatus(BaseModel):
    session_id: int
    ip_address: str
    login_time: datetime
    last_heartbeat_at: Optional[datetime]
    is_online: bool

class OnlineUserItem(BaseModel):
    user_id: int
    username: str
    ip_address: str
    device_identifier: Optional[str]
    last_heartbeat_at: Optional[datetime]

class ProxyActiveClientItem(BaseModel):
    ip_address: str
    username: str
    website_count: int
    total_data_mb: float
    last_seen_at: datetime

class SiteUserTraffic(BaseModel):
    session_id: int
    username: str
    ip_address: str
    role: str
    total_data_mb: float
    last_seen_at: datetime

class NetworkEventRequest(BaseModel):
    event_type: str
    username: str
    ip_address: str
    device_identifier: Optional[str] = None
    event_time: Optional[datetime] = None

class NetworkEventResponse(BaseModel):
    message: str
    session_id: Optional[int] = None

class TopVisitedSiteAnalysis(BaseModel):
    website: str
    visits: int
    total_data_mb: float
    user_id: Optional[int] = None
    username: Optional[str] = None

class FlaggedSiteCreate(BaseModel):
    website: str

class FlaggedSiteOut(BaseModel):
    id: int
    website: str
    is_active: int
    created_by_user_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
