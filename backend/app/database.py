"""اتصال به دیتابیس SQLite و مدیریت Session + migration سبک"""
import logging
import os
from pathlib import Path

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

logger = logging.getLogger(__name__)

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

engine = create_engine(
    _database_url,
    connect_args=connect_args,
    pool_pre_ping=True,  # بررسی سلامت اتصال قبل از هر استفاده (جلوگیری از «database is locked» و اتصال مرده)
)


if _database_url.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection, connection_record) -> None:
        """تنظیم PRAGMAهای پایداری روی همه اتصال‌های SQLite.
        این PRAGMAها باید روی هر اتصال جداگانه اجرا شوند (به‌جز journal_mode که
        روی خود فایل دیتابیس می‌نشیند ولی اجرای دوباره‌اش بی‌خطر است)."""
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA journal_mode=WAL")  # همزمانی خواندن/نوشتن
            cursor.execute("PRAGMA synchronous=NORMAL")  # تعادل سرعت و امنیت با WAL
            cursor.execute("PRAGMA busy_timeout=5000")  # انتظار برای قفل به‌جای خطای فوری
            cursor.execute("PRAGMA foreign_keys=ON")  # اعمال کلیدهای خارجی
        finally:
            cursor.close()

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

    # ── ایندکس‌ها: create_all فقط جدول‌های جدید را می‌سازد، پس ایندکس‌های جدید
    # باید جداگانه روی دیتابیس‌های قدیمی ساخته شوند ──
    tables = set(inspector.get_table_names())
    index_statements: list[str] = []
    if "products" in tables:
        index_statements.append(
            "CREATE INDEX IF NOT EXISTS ix_products_category_id ON products (category_id)"
        )
    if "order_items" in tables:
        index_statements += [
            "CREATE INDEX IF NOT EXISTS ix_order_items_order_id ON order_items (order_id)",
            "CREATE INDEX IF NOT EXISTS ix_order_items_product_id ON order_items (product_id)",
        ]
    if "orders" in tables:
        index_statements += [
            # ایندکس یکتای idempotency_key جداگانه و بعد از اینجا ساخته می‌شود
            # ایندکس‌های رسمی orders (ایجاد قبل از حذف ایندکس‌های تکراری پایین)
            "CREATE INDEX IF NOT EXISTS ix_order_created_at ON orders (created_at)",
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_order_code ON orders (code)",
            # ایندکس‌های تکراری که قبلاً همراه index=True در مدل ساخته می‌شدند
            "DROP INDEX IF EXISTS ix_orders_created_at",
            "DROP INDEX IF EXISTS ix_orders_code",
        ]
    if index_statements:
        with db_engine.begin() as conn:
            for statement in index_statements:
                conn.execute(text(statement))

    # ── ایندکس یکتای idempotency_key ──
    # قبلاً غیریکتا بود؛ اگر داده تکراری وجود نداشته باشد به ایندکس UNIQUE ارتقا داده
    # می‌شود (چند مقدار NULL در SQLite برای UNIQUE بی‌خطر است). اگر ساختش شکست
    # بخورد (داده تکراری قدیمی یا خطای دیگر) فقط هشدار ثبت می‌شود تا برنامه بالا بیاید.
    if "orders" in tables:
        try:
            with db_engine.begin() as conn:
                duplicate = conn.execute(text(
                    "SELECT idempotency_key FROM orders "
                    "WHERE idempotency_key IS NOT NULL "
                    "GROUP BY idempotency_key HAVING COUNT(*) > 1 LIMIT 1"
                )).first()
                if duplicate is not None:
                    logger.warning(
                        "idempotency_keyهای تکراری در جدول orders وجود دارد؛ "
                        "ایندکس یکتا ساخته نشد — مقادیر تکراری را دستی پاک کنید"
                    )
                else:
                    # ایندکس قدیمی غیریکتا باید اول حذف شود تا UNIQUE جدید ساخته شود
                    conn.execute(text("DROP INDEX IF EXISTS ix_orders_idempotency_key"))
                    conn.execute(text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS ix_orders_idempotency_key "
                        "ON orders (idempotency_key)"
                    ))
        except Exception:
            logger.exception("ساخت ایندکس یکتای idempotency_key ناموفق بود")
