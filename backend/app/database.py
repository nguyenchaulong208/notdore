from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

# ============================================================
# 1. KHAI BÁO BASE CHO SQLALCHEMY
# ============================================================

Base = declarative_base()

# ============================================================
# 2. KHAI BÁO THÔNG TIN KẾT NỐI DATABASE
# ============================================================

# Bạn có thể đặt biến môi trường hoặc sửa trực tiếp
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASS", "your_password")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "documents_db")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# ============================================================
# 3. TẠO ENGINE & SESSION
# ============================================================

engine = create_engine(
    DATABASE_URL,
    echo=False,              # bật True nếu muốn log SQL
    future=True
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True
)

# ============================================================
# 4. HÀM LẤY SESSION CHO FASTAPI
# ============================================================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
