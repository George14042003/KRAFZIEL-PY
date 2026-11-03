import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]

# Sized for ~250 concurrent interviews on one process: every bot interview pings the API every
# 5s and every API request borrows a connection briefly. SQLAlchemy's default (5 + 10 overflow)
# runs dry long before that and requests then fail with a pool timeout. Keep
# (DB_POOL_SIZE + DB_MAX_OVERFLOW) x worker processes under Postgres' max_connections.
engine = create_engine(
    DATABASE_URL,
    pool_size=int(os.environ.get("DB_POOL_SIZE", "20")),
    max_overflow=int(os.environ.get("DB_MAX_OVERFLOW", "40")),
    pool_timeout=int(os.environ.get("DB_POOL_TIMEOUT", "15")),
    pool_recycle=1800,
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
