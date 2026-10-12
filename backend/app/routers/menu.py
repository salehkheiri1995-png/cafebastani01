"""endpoint عمومی منو — بدون نیاز به لاگین"""
import hashlib
import threading
import time

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from .. import models
from ..database import get_db
from ..runtime_settings import runtime_settings
from ..schemas import MenuCategoryOut, ProductOut

router = APIRouter(prefix="/api", tags=["menu"])

# ── کش سبک درون‌process برای منو ──
# پاسخ فقط به وضعیت باز/بسته بودن کافه بستگی دارد؛ کلید کش همان وضعیت است
# (کافه که بسته باشد، قبل از رسیدن به کش 503 برمی‌گردد و کش نادیده گرفته می‌شود)
MENU_CACHE_TTL = 5.0  # ثانیه
_menu_cache: dict[bool, tuple[float, list[MenuCategoryOut]]] = {}
_menu_cache_lock = threading.Lock()

# شمارنده نسخه منو — با هر invalidation یکتا می‌شود تا ETag عوض شود
# (تغییرات دسته‌بندی updated_at ندارند؛ این شمارنده آن‌ها را هم پوشش می‌دهد)
_menu_generation = 0

# منو عمومی است ولی شخصی (نه عمومی‌کش‌شدن در پراکسی)؛ هر بار باید revalidate شود
MENU_CACHE_CONTROL = "private, max-age=0, must-revalidate"


def invalidate_menu_cache() -> None:
    """پاک کردن کش منو — بعد از هر تغییر در منو از پنل مدیریت صدا زده می‌شود"""
    global _menu_generation
    with _menu_cache_lock:
        _menu_cache.clear()
        _menu_generation += 1


def _compute_menu_etag(db: Session) -> str:
    """ETag قوی منو از «نسخه» دیتابیس: بیشترین updated_at محصولات + تعداد محصولات
    و دسته‌ها + شمارنده invalidation درون‌process. تغییر هر کدام ETag را عوض می‌کند."""
    with _menu_cache_lock:
        generation = _menu_generation
    max_updated, product_count = (
        db.query(func.max(models.Product.updated_at), func.count(models.Product.id)).one()
    )
    category_count = db.query(func.count(models.Category.id)).scalar()
    raw = f"{generation}|{max_updated}|{product_count}|{category_count}"
    return '"' + hashlib.sha256(raw.encode()).hexdigest()[:32] + '"'


def _if_none_match_matches(header_value: str | None, etag: str) -> bool:
    """بررسی هدر If-None-Match طبق RFC 9110 (لیستی از ETagها یا «*»)"""
    if not header_value:
        return False
    candidates = [c.strip() for c in header_value.split(",")]
    return "*" in candidates or etag in candidates


@router.get("/menu", response_model=list[MenuCategoryOut])
def get_menu(request: Request, response: Response, db: Session = Depends(get_db)):
    """کل منو برای مشتری: دسته‌های فعال + فقط محصولات موجود،
    مرتب‌شده بر اساس ترتیب نمایش. اگر کافه تعطیل باشد خطای 503 برمی‌گرداند."""
    is_open = runtime_settings.is_open
    if not is_open:
        raise HTTPException(
            status_code=503,
            detail="کافه در حال حاضر پذیرش سفارش ندارد",
        )

    # ETag قبل از کش محاسبه می‌شود تا پاسخ 304 بدون بدنه هم هدر داشته باشد
    etag = _compute_menu_etag(db)
    if _if_none_match_matches(request.headers.get("if-none-match"), etag):
        return Response(
            status_code=304,
            headers={"ETag": etag, "Cache-Control": MENU_CACHE_CONTROL},
        )

    now = time.monotonic()
    with _menu_cache_lock:
        cached = _menu_cache.get(is_open)
        if cached is not None and now - cached[0] < MENU_CACHE_TTL:
            response.headers["ETag"] = etag
            response.headers["Cache-Control"] = MENU_CACHE_CONTROL
            return cached[1]

    categories = (
        db.query(models.Category)
        .options(selectinload(models.Category.products))  # جلوگیری از N+1
        .filter(models.Category.is_active.is_(True))
        .order_by(models.Category.display_order, models.Category.id)
        .all()
    )

    result: list[MenuCategoryOut] = []
    for cat in categories:
        products = sorted(
            (p for p in cat.products if p.is_available),
            key=lambda p: (p.display_order, p.id),
        )
        result.append(
            MenuCategoryOut(
                id=cat.id,
                name=cat.name,
                display_order=cat.display_order,
                products=[ProductOut.model_validate(p) for p in products],
            )
        )

    with _menu_cache_lock:
        _menu_cache[is_open] = (now, result)
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = MENU_CACHE_CONTROL
    return result
