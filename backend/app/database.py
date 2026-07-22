"""اتصال به دیتابیس SQLite و مدیریت Session"""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# فایل دیتابیس در پوشه backend ساخته می‌شود
DATABASE_URL = "sqlite:///./cafe.db"

# check_same_thread=False چون FastAPI ممکن است درخواست‌ها را در تردهای مختلف اجرا کند
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """کلاس پایه همه مدل‌ها"""


def get_db():
    """Dependency برای گرفتن session دیتابیس در هر درخواست"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
