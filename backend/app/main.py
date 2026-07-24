"""نقطه ورود برنامه — سیستم سفارش کافه‌بستنی تی‌تی"""
import shutil
from contextlib import asynccontextmanager
from datetime import datetime, time, timedelta
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import models  # noqa: F401 — لازم برای ثبت مدل‌ها قبل از create_all
from .auth import router as auth_router
from .config import settings
from .database import Base, SessionLocal, engine, run_sqlite_migrations
from .routers import admin, cashier, menu, orders, reports
from .seed import seed_if_empty
from .storage import STATIC_DIR, ensure_dirs
from .ws_manager import ws_manager

# ── مسیرهای مهم برای بکاپ ──
BACKEND_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BACKEND_DIR / "cafe.db"
BACKUPS_DIR = BACKEND_DIR / "backups"

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
    """بکاپ خودکار شبانه فایل دیتابیس — فقط ۷ فایل آخر نگه داشته می‌شود"""
    try:
        if not DB_PATH.exists():
            return
        BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
        today_str = datetime.now().strftime("%Y-%m-%d")
        backup_file = BACKUPS_DIR / f"cafe_{today_str}.db"
        shutil.copy2(str(DB_PATH), str(backup_file))

        # حذف فایل‌های قدیمی‌تر از ۷ روز
        backups = sorted(BACKUPS_DIR.glob("cafe_*.db"), key=lambda f: f.stat().st_mtime)
        while len(backups) > 7:
            oldest = backups.pop(0)
            oldest.unlink(missing_ok=True)
    except Exception:
        pass  # خطای بکاپ نباید برنامه اصلی را متوقف کند


@asynccontextmanager
async def lifespan(app: FastAPI):
    """در استارت برنامه: ساخت جدول‌ها + migration خودکار + داده اولیه منو + راه‌اندازی زمان‌بند"""
    ensure_dirs()  # ساخت پوشه static/products اگر نبود
    Base.metadata.create_all(bind=engine)
    run_sqlite_migrations(engine)  # اضافه کردن ستون‌های جدید به دیتابیس‌های قدیمی
    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()

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

    # ── توقف زمان‌بند در خروج ──
    scheduler.shutdown(wait=False)


app = FastAPI(
    title="سیستم سفارش کافه‌بستنی",
    description="API سفارش‌گیری آنلاین: منوی مشتری، پنل صندوق و پنل مدیریت",
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

app.include_router(auth_router)
app.include_router(menu.router)
app.include_router(orders.router)
app.include_router(cashier.router)
app.include_router(admin.router)
app.include_router(reports.router)

# سرو کردن فایل‌های استاتیک (عکس محصولات) از backend/static
# ensure_dirs قبل از mount لازم است چون StaticFiles وجود پوشه را همان لحظه چک می‌کند
ensure_dirs()
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/api/health")
def health():
    """بررسی سلامت سرور"""
    return {"status": "ok"}


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
