"""نقطه ورود برنامه — سیستم سفارش کافه‌بستنی تی‌تی"""
import base64
import hashlib
import logging
import os
import re
import sqlite3
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from . import models  # noqa: F401 — لازم برای ثبت مدل‌ها قبل از create_all
from .auth import router as auth_router
from .config import settings
from .database import Base, SessionLocal, engine, run_sqlite_migrations
from .routers import admin, cashier, menu, orders, reports
from .seed import seed_if_empty
from .storage import PRODUCTS_DIR, STATIC_DIR, ensure_dirs
from .ws_manager import ws_manager

# ── پیکربندی لاگینگ stdlib — سطح از LOG_LEVEL خوانده می‌شود (پیش‌فرض INFO) ──
logging.basicConfig(
    level=getattr(logging, os.environ.get("LOG_LEVEL", "INFO").upper(), logging.INFO),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)

logger = logging.getLogger(__name__)

# ── مسیرهای مهم برای بکاپ ──
BACKEND_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BACKEND_DIR / "cafe.db"
BACKUPS_DIR = BACKEND_DIR / "backups"
FRONTEND_DIR = BACKEND_DIR / "static" / "frontend"
FRONTEND_ROOT = FRONTEND_DIR.resolve()  # مرجع مقایسه برای ضد path traversal

# ── زمان‌بند اجرای پس‌زمینه ──
scheduler = BackgroundScheduler()


def auto_expire_pending_orders():
    """سفارش‌های pending که بیش از ۶۰ دقیقه از created_at آن‌ها گذشته را لغو می‌کند"""
    db = SessionLocal()
    try:
        cutoff = datetime.now() - timedelta(minutes=60)
        stale_orders = (
            db.query(models.Order)
            .filter(models.Order.status == "pending")
            .filter(models.Order.created_at < cutoff)
            .all()
        )
        for order in stale_orders:
            order.status = "cancelled"
            order.updated_at = datetime.now()
        if stale_orders:
            db.commit()
    finally:
        db.close()


def auto_backup_database():
    """بکاپ خودکار شبانه فایل دیتابیس — فقط ۷ فایل آخر نگه داشته می‌شود.
    دیتابیس در حالت WAL اجراست؛ کپی خام فایل cafe.db بدون WAL ناقص می‌شود،
    پس اول checkpoint و بعد با backup API خود sqlite3 یکSnapshot سازگار ساخته می‌شود."""
    try:
        if not DB_PATH.exists():
            return
        BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
        today_str = datetime.now().strftime("%Y-%m-%d")
        backup_file = BACKUPS_DIR / f"cafe_{today_str}.db"

        src = sqlite3.connect(str(DB_PATH))
        try:
            # انتقال محتوای WAL به فایل اصلی (اگر مشغول باشد فقط هشدار می‌دهد؛
            # خود backup API در هر صورت محتوای WAL را هم کپی می‌کند)
            try:
                src.execute("PRAGMA wal_checkpoint(TRUNCATE)")
            except sqlite3.Error:
                logger.warning("checkpoint قبل از بکاپ انجام نشد (دیتابیس مشغول است)")
            dst = sqlite3.connect(str(backup_file))
            try:
                src.backup(dst)  # snapshot سازگار حتی با اتصال‌های همزمان
            finally:
                dst.close()
        finally:
            src.close()
        logger.info("بکاپ شبانه دیتابیس ذخیره شد: %s", backup_file)

        # حذف فایل‌های قدیمی‌تر از ۷ روز
        backups = sorted(BACKUPS_DIR.glob("cafe_*.db"), key=lambda f: f.stat().st_mtime)
        while len(backups) > 7:
            oldest = backups.pop(0)
            oldest.unlink(missing_ok=True)
    except Exception:
        # خطای بکاپ نباید برنامه اصلی را متوقف کند، ولی باید در لاگ دیده شود
        logger.exception("خطا در بکاپ خودکار دیتابیس")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """در استارت برنامه: ساخت جدول‌ها + migration خودکار + داده اولیه منو + راه‌اندازی زمان‌بند"""
    ensure_dirs()  # ساخت پوشه static/products اگر نبود
    Base.metadata.create_all(bind=engine)
    run_sqlite_migrations(engine)  # اضافه کردن ستون‌های جدید به دیتابیس‌های قدیمی

    # ── هشدارهای امنیتی: فقط هشدار می‌دهیم؛ استارت را متوقف نمی‌کنیم
    # (لاکال عمداً از رمزهای پیش‌فرض .env استفاده می‌کند) ──
    if settings.secret_key == "dev-secret-change-me":
        logger.warning(
            "SECRET_KEY هنوز مقدار پیش‌فرض «dev-secret-change-me» است — "
            "توکن‌های JWT قابل جعل هستند؛ حتماً در .env یک کلید تصادفی بگذارید"
        )
    elif len(settings.secret_key) < 32:
        logger.warning(
            "SECRET_KEY کوتاه‌تر از ۳۲ کاراکتر است — یک کلید تصادفی طولانی‌تر بگذارید"
        )
    if settings.cashier_password == "cafe1234":
        logger.warning(
            "رمز پنل صندوق هنوز مقدار پیش‌فرض «cafe1234» است — در .env آن را عوض کنید"
        )
    if settings.admin_password == "admin1234":
        logger.warning(
            "رمز پنل مدیریت هنوز مقدار پیش‌فرض «admin1234» است — در .env آن را عوض کنید"
        )

    # داده اولیه منو فقط وقتی SEED_ON_STARTUP=true باشد (پیش‌فرض true)
    if settings.seed_on_startup:
        db = SessionLocal()
        try:
            seed_if_empty(db)
        finally:
            db.close()
    else:
        logger.info("SEED_ON_STARTUP=false است — داده اولیه منو ساخته نشد")

    # ── راه‌اندازی زمان‌بند پس‌زمینه ──
    scheduler.add_job(
        auto_expire_pending_orders,
        "interval",
        minutes=15,
        id="auto_expire",
        replace_existing=True,
    )
    scheduler.add_job(
        auto_backup_database,
        "cron",
        hour=2,
        minute=0,
        id="auto_backup",
        replace_existing=True,
    )
    scheduler.start()

    yield  # برنامه در حال اجراست

    # ── توقف زمان‌بند و آزادسازی منابع در خروج ──
    scheduler.shutdown(wait=False)
    # بستن اتصال‌های باز WebSocket تا کلاینت‌ها سریع disconnect شوند
    await ws_manager.close_all()
    # بازگرداندن همه connectionهای pool دیتابیس
    engine.dispose()
    logger.info("برنامه با موفقیت متوقف شد")


app = FastAPI(
    title="سیستم سفارش کافه‌بستنی",
    description="API سفارش‌گیری آنلاین: منوی مشتری، پنل صندوق و پنل مدیریت",
    # مستندات فقط با DOCS_ENABLED=true (توسعه) در دسترس است
    docs_url="/docs" if settings.docs_enabled else None,
    redoc_url="/redoc" if settings.docs_enabled else None,
    openapi_url="/openapi.json" if settings.docs_enabled else None,
    lifespan=lifespan,
)

# CORS برای وقتی فرانت جدا از بک‌اند سرو می‌شود
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── هدرهای امنیتی + محدودیت حجم بدنه ──
# این middleware باید بعد از add_middleware(CORS) ثبت شود تا لایه بیرونی‌ترین باشد
# و روی همه پاسخ‌ها (حتی پاسخ‌های CORS) هدرها را اضافه کند.

# سقف کل برای همه درخواست‌ها — آپلود عکس محصول (حداکثر ۵ مگابایت) هم این‌جا جا می‌شود
MAX_BODY_BYTES = 6 * 1024 * 1024
# سقف بدنه برای درخواست‌های غیرآپلود (JSON) — جلوگیری از پر شدن حافظه
MAX_JSON_BYTES = 1 * 1024 * 1024

# CSP فرانت: هش اسکریپت‌های inline داخل index.html (ثبت service worker) محاسبه می‌شود
# تا مرورگر آن‌ها را بلاک نکند — بدون 'unsafe-inline' و بدون تغییر در فایل‌های فرانت
_INLINE_SCRIPT_RE = re.compile(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", re.DOTALL)


def _inline_script_hashes() -> str:
    """هش sha256 اسکریپت‌های inline داخل index.html برای افزودن به CSP"""
    index = FRONTEND_DIR / "index.html"
    if not index.is_file():
        return ""
    try:
        html = index.read_text(encoding="utf-8")
    except OSError:
        return ""
    tokens = []
    for match in _INLINE_SCRIPT_RE.finditer(html):
        digest = hashlib.sha256(match.group(1).encode("utf-8")).digest()
        tokens.append(f"'sha256-{base64.b64encode(digest).decode()}'")
    return (" " + " ".join(tokens)) if tokens else ""


CSP_POLICY = (
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; "
    "script-src 'self'" + _inline_script_hashes() + "; font-src 'self'; "
    "connect-src 'self' ws: wss:; object-src 'none'; base-uri 'self'"
)

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(self), microphone=()",
    "Content-Security-Policy": CSP_POLICY,
}


@app.middleware("http")
async def security_and_body_limit_middleware(request: Request, call_next):
    """هدرهای امنیتی روی همه پاسخ‌ها + رد درخواست‌های با بدنه خیلی بزرگ (413)"""
    # ── محدودیت حجم بدنه از روی Content-Length (بدون خواندن بدنه) ──
    content_length = request.headers.get("content-length")
    if content_length and content_length.isdigit():
        size = int(content_length)
        is_upload = (request.headers.get("content-type") or "").startswith(
            "multipart/form-data"
        )
        limit = MAX_BODY_BYTES if is_upload else MAX_JSON_BYTES
        if size > limit:
            return JSONResponse(
                status_code=413,
                content={"detail": "حجم بدنه درخواست بیش از حد مجاز است"},
                headers=SECURITY_HEADERS,
            )

    response = await call_next(request)
    for header, value in SECURITY_HEADERS.items():
        # /docs و /redoc از CDN بارگذاری می‌شوند (فقط حالت توسعه) → CSP آن‌ها را می‌شکست
        if header == "Content-Security-Policy" and request.url.path in (
            "/docs", "/redoc", "/openapi.json",
        ):
            continue
        response.headers.setdefault(header, value)
    return response


app.include_router(auth_router)
app.include_router(menu.router)
app.include_router(orders.router)
app.include_router(cashier.router)
app.include_router(admin.router)
app.include_router(reports.router)


@app.get("/api/health")
def health():
    """بررسی سلامت سرور و دیتابیس — در صورت قطعی دیتابیس 503 برمی‌گرداند"""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "ok": True, "db": True}
    except Exception:
        logger.exception("بررسی سلامت دیتابیس ناموفق بود")
        return JSONResponse(
            status_code=503,
            content={"status": "error", "ok": False, "db": False},
        )


@app.websocket("/ws/orders")
async def websocket_orders(websocket: WebSocket):
    """WebSocket endpoint برای اعلان سفارش جدید — کلاینت‌ها بدون احراز هویت متصل می‌شوند"""
    await ws_manager.connect(websocket)
    try:
        while True:
            # نگه‌داشتن اتصال باز — منتظر پیام از کلاینت (ping/pong)
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)


# سرو کردن فایل‌های استاتیک (عکس محصولات) از backend/static
# ensure_dirs قبل از mount لازم است چون StaticFiles وجود پوشه را همان لحظه چک می‌کند
ensure_dirs()


class CacheControlStaticFiles(StaticFiles):
    """سرو فایل‌های استاتیک با هدر Cache-Control دلخواه"""

    def __init__(self, *args, cache_control: str, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.cache_control = cache_control

    def file_response(
        self, full_path, stat_result, scope, status_code: int = 200
    ) -> Response:
        response = super().file_response(full_path, stat_result, scope, status_code)
        response.headers["Cache-Control"] = self.cache_control
        return response


# عکس‌های محصول اسم UUID دارند و هرگز جایگزین نمی‌شوند → کش طولانی مرورگر
# (این mount باید قبل از mount عمومی /static ثبت شود تا اولویت داشته باشد)
app.mount(
    "/static/products",
    CacheControlStaticFiles(
        directory=str(PRODUCTS_DIR), cache_control="max-age=31536000, immutable"
    ),
    name="product_images",
)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


def _frontend_file_response(path: Path) -> FileResponse:
    """سرو فایل فرانت با سیاست کش مناسب:
    service-worker.js نباید هیچ‌وقت کش شود (وگرنه دپلوی جدید دیر می‌رسد) و
    index.html همیشه باید revalidate شود تا اسامی فایل‌های /assets تازه بماند."""
    if path.name == "service-worker.js":
        cache_control = "no-cache, no-store"
    elif path.name == "index.html":
        cache_control = "no-cache"
    else:
        cache_control = "public, max-age=3600"  # آیکن‌ها و manifest — کش کوتاه
    return FileResponse(str(path), headers={"Cache-Control": cache_control})


# ── سرو کردن فرانت ساخته‌شده در حالت production ──
# این بلوک باید آخرین باشد تا همه API و WebSocket ابتدا بررسی شوند
if FRONTEND_DIR.is_dir():
    # اسم فایل‌های /assets همیشه hash دارد و بعد از هر build عوض می‌شود → کش یک‌ساله
    app.mount(
        "/assets",
        CacheControlStaticFiles(
            directory=str(FRONTEND_DIR / "assets"),
            cache_control="public, max-age=31536000, immutable",
        ),
        name="frontend_assets",
    )

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        """سرو کردن فایل‌های فرانت یا index.html برای مسیرهای SPA"""
        # ضد path traversal: مسیر resolve شده باید داخل FRONTEND_DIR بماند
        if full_path:
            try:
                candidate = (FRONTEND_DIR / full_path).resolve()
                if candidate.is_relative_to(FRONTEND_ROOT) and candidate.is_file():
                    return _frontend_file_response(candidate)
            except (OSError, ValueError):
                pass  # مسیر نامعتبر → به index.html برمی‌گردد
        # در غیر این صورت index.html را برگردان (برای React Router)
        index = FRONTEND_DIR / "index.html"
        if index.is_file():
            return _frontend_file_response(index)
        return {"detail": "not found"}
