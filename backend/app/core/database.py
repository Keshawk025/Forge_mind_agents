import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

# Attempt PostgreSQL, fallback to local SQLite
db_url = settings.DATABASE_URL
try:
    engine = create_engine(
        db_url,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20
    )
    # Verify connection
    with engine.connect() as conn:
        pass
    print("Successfully connected to PostgreSQL.")
except Exception as e:
    # Construct sqlite path in the workspace app directory
    base_dir = os.path.abspath(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    sqlite_path = os.path.join(base_dir, "forgemind.db")
    db_url = f"sqlite:///{sqlite_path}"
    print(f"PostgreSQL connection failed: {e}. Falling back to SQLite database at: {sqlite_path}")
    engine = create_engine(
        db_url,
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
