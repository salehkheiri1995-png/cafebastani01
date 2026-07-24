"""endpoint عمومی منو — بدون نیاز به لاگین"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..runtime_settings import runtime_settings
from ..schemas import MenuCategoryOut, ProductOut

router = APIRouter(prefix="/api", tags=["menu"])


@router.get("/menu", response_model=list[MenuCategoryOut])
def get_menu(db: Session = Depends(get_db)):
    """کل منو برای مشتری: دسته‌های فعال + فقط محصولات موجود،
    مرتب‌شده بر اساس ترتیب نمایش. اگر کافه تعطیل باشد خطای 507 برمی‌گرداند."""
    if not runtime_settings.is_open:
        raise HTTPException(
            status_code=503,
            detail="کافه در حال حاضر پذیرش سفارش ندارد",
        )
    categories = (
        db.query(models.Category)
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
    return result
