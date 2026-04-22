import pandas as pd
from typing import List
from sqlalchemy.orm import Session
from datetime import datetime
import io
import models

def process_proxy_logs(file_bytes: bytes, db: Session):
    # 1. Read CSV into Pandas DataFrame
    # Expected columns: timestamp, ip_address, website_url, bytes_used
    
    # Try decoding assuming UTF-8
    try:
        content = file_bytes.decode('utf-8')
    except UnicodeDecodeError:
        content = file_bytes.decode('latin-1')
        
    df = pd.read_csv(io.StringIO(content))
    
    # Standardize column names (allow for some flexibility)
    df.columns = [col.strip().lower() for col in df.columns]
    
    # Needs to find columns that match logic
    col_mapping = {
        'timestamp': None,
        'ip_address': None,
        'url': None,
        'bytes': None
    }
    
    for col in df.columns:
        if 'time' in col or 'date' in col: col_mapping['timestamp'] = col
        elif 'ip' in col: col_mapping['ip_address'] = col
        elif 'url' in col or 'domain' in col or 'website' in col: col_mapping['url'] = col
        elif 'byte' in col or 'size' in col or 'data' in col: col_mapping['bytes'] = col
            
    # Fallbacks if columns are perfectly named
    ts_col = col_mapping['timestamp'] or 'timestamp'
    ip_col = col_mapping['ip_address'] or 'ip_address'
    url_col = col_mapping['url'] or 'website'
    byte_col = col_mapping['bytes'] or 'bytes'

    # Convert bytes to MB
    # Drop rows with missing critical info
    df = df.dropna(subset=[ts_col, ip_col, url_col, byte_col])
    
    df['data_used_mb'] = pd.to_numeric(df[byte_col], errors='coerce') / (1024 * 1024)
    df['timestamp'] = pd.to_datetime(df[ts_col], errors='coerce')
    
    # Drop any rows where parsing failed
    df = df.dropna(subset=['data_used_mb', 'timestamp'])
    
    # Clean URLs (extract domain if it's a full URL)
    def clean_url(url_val):
        url_str = str(url_val)
        if "://" in url_str:
            return url_str.split("://")[1].split("/")[0]
        return url_str.split("/")[0]
        
    df['website'] = df[url_col].apply(clean_url)
    
    inserted_count = 0
    # Process row by row to map to sessions and categories
    # In a full PROD environment we would vectorize, but for mapping complex session logic row-iteration is safest
    for _, row in df.iterrows():
        log_ts = row['timestamp']
        ip = row[ip_col]
        website = row['website']
        mb = row['data_used_mb']
        
        # Resolve by IP assignment timeline first (supports DHCP IP changes).
        active_assignment = db.query(models.SessionIPAssignment).filter(
            models.SessionIPAssignment.ip_address == ip,
            models.SessionIPAssignment.assigned_at <= log_ts,
            (models.SessionIPAssignment.released_at == None) | (models.SessionIPAssignment.released_at >= log_ts)
        ).order_by(models.SessionIPAssignment.assigned_at.desc()).first()

        active_session = None
        if active_assignment:
            active_session = db.query(models.Session).filter(
                models.Session.session_id == active_assignment.session_id,
                models.Session.login_time <= log_ts,
                (models.Session.logout_time == None) | (models.Session.logout_time >= log_ts)
            ).first()

        # Backward-compatible fallback for older rows where no assignment exists.
        if not active_session:
            active_session = db.query(models.Session).filter(
                models.Session.ip_address == ip,
                models.Session.login_time <= log_ts,
                (models.Session.logout_time == None) | (models.Session.logout_time >= log_ts)
            ).order_by(models.Session.login_time.desc()).first()
        
        if not active_session:
            # If no active session, skip or assign to a dummy "Unauthenticated" session.
            # We'll skip for strictness
            continue
            
        # Check category
        cat = db.query(models.Category).filter(models.Category.website == website).first()
        cat_id = cat.id if cat else None
        
        # If category doesn't exist, maybe we create it as 'Uncategorized'?
        if not cat:
            new_cat = models.Category(website=website, category="Uncategorized")
            db.add(new_cat)
            db.commit()
            db.refresh(new_cat)
            cat_id = new_cat.id
            
        # Create Log
        new_log = models.Log(
            session_id=active_session.session_id,
            website=website,
            category_id=cat_id,
            data_used_mb=mb,
            timestamp=log_ts
        )
        db.add(new_log)
        inserted_count += 1
        
    db.commit()
    return inserted_count
