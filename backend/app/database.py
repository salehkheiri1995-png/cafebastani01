"""اتصال به دیتابیس SQLite و مدیریت Session + migration سبک"""
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
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


def run_sqlite_migrations(db_engine: Engine) -> None:
    """migration سبک برای SQLite (بدون Alembic).

    دیتابیس‌های قدیمی که قبل از قابلیت عکس ساخته شده‌اند، ستون image_url
    ندارند — این تابع در استارت برنامه به‌صورت خودکار اضافه‌اش می‌کند.
    اجرای چندباره‌اش بی‌خطر است."""
    inspector = inspect(db_engine)
    if "products" not in inspector.get_table_names():
        return  # جدول هنوز ساخته نشده — create_all با ستون جدید می‌سازد
    columns = {col["name"] for col in inspector.get_columns("products")}
    if "image_url" not in columns:
        with db_engine.begin() as conn:
            conn.execute(text("ALTER TABLE products ADD COLUMN image_url VARCHAR(500)"))
