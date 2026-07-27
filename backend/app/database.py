"""اتصال به دیتابیس SQLite و مدیریت Session + migration سبک"""
import os
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# فایل دیتابیس — اگر DATABASE_URL در environment variable تعریف شده باشد از آن استفاده می‌شود
# در غیر این صورت فایل cafe.db در پوشه backend ساخته می‌شود
_database_url = os.environ.get("DATABASE_URL")
if not _database_url:
    _backend_dir = Path(__file__).resolve().parent.parent
    _db_path = _backend_dir / "cafe.db"
    _database_url = f"sqlite:///{_db_path}"

connect_args = {}
if _database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(_database_url, connect_args=connect_args)

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

    دیتابیس‌های قدیمی که قبل از قابلیت‌های جدید ساخته شده‌اند، ستون‌های جدید
    ندارند — این تابع در استارت برنامه به‌صورت خودکار اضافه‌شان می‌کند.
    اجرای چندباره‌اش بی‌خطر است."""
    inspector = inspect(db_engine)
    if "products" not in inspector.get_table_names():
        return  # جدول هنوز ساخته نشده — create_all با ستون جدید می‌سازد

    # ── migration برای جدول products ──
    product_columns = {col["name"] for col in inspector.get_columns("products")}
    if "image_url" not in product_columns:
        with db_engine.begin() as conn:
            conn.execute(text("ALTER TABLE products ADD COLUMN image_url VARCHAR(500)"))

    # ── migration برای جدول orders ──
    if "orders" not in inspector.get_table_names():
        return
    order_columns = {col["name"] for col in inspector.get_columns("orders")}
    if "payment_method" not in order_columns:
        with db_engine.begin() as conn:
            conn.execute(text("ALTER TABLE orders ADD COLUMN payment_method VARCHAR(20)"))
    if "queue_number" not in order_columns:
        with db_engine.begin() as conn:
            conn.execute(text("ALTER TABLE orders ADD COLUMN queue_number INTEGER"))
    if "idempotency_key" not in order_columns:
        with db_engine.begin() as conn:
            conn.execute(text("ALTER TABLE orders ADD COLUMN idempotency_key VARCHAR(64)"))
