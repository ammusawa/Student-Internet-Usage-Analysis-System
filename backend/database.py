import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from dotenv import load_dotenv

load_dotenv()

USER = os.getenv("DB_USER", "root")
PASSWORD = os.getenv("DB_PASSWORD", "")
HOST = os.getenv("DB_HOST", "127.0.0.1")
PORT = os.getenv("DB_PORT", "3306")
NAME = os.getenv("DB_NAME", "student_usage_db")

# Use pymysql 
SQLALCHEMY_DATABASE_URL = f"mysql+pymysql://{USER}:{PASSWORD}@{HOST}:{PORT}/{NAME}"

# Special handling for DB creation if it doesn't exist
# We connect without the DB name first in a separate script, 
# but for the app to run it needs the DB to exist.
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
