"""نقطه ورود برنامه — سیستم سفارش کافه‌بستنی تی‌تی"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import models  # noqa: F401 — لازم برای ثبت مدل‌ها قبل از create_all
from .auth import router as auth_router
from .config import settings
from .database import Base, SessionLocal, engine, run_sqlite_migrations
from .routers import admin, cashier, menu, orders, reports
from .seed import seed_if_empty
from .storage import STATIC_DIR, ensure_dirs


@asynccontextmanager
async def lifespan(app: FastAPI):
    """در استارت برنامه: ساخت جدول‌ها + migration خودکار + داده اولیه منو"""
    ensure_dirs()  # ساخت پوشه static/products اگر نبود
    Base.metadata.create_all(bind=engine)
    run_sqlite_migrations(engine)  # اضافه کردن image_url به دیتابیس‌های قدیمی
    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()
    yield


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
