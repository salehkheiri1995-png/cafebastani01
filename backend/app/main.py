"""نقطه ورود برنامه — سیستم سفارش کافه‌بستنی"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401 — لازم برای ثبت مدل‌ها قبل از create_all
from .auth import router as auth_router
from .config import settings
from .database import Base, SessionLocal, engine
from .routers import admin, cashier, menu, orders
from .seed import seed_if_empty


@asynccontextmanager
async def lifespan(app: FastAPI):
    """در استارت برنامه: ساخت جدول‌ها + داده اولیه منو (اگر دیتابیس خالی بود)"""
    Base.metadata.create_all(bind=engine)
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


@app.get("/api/health")
def health():
    """بررسی سلامت سرور"""
    return {"status": "ok"}
