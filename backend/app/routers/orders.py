"""ثبت و مشاهده سفارش توسط مشتری — بدون نیاز به لاگین"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..qr import make_qr_base64
from ..schemas import OrderCreate, OrderOut
from ..services import create_order
from ..ws_manager import ws_manager

router = APIRouter(prefix="/api/orders", tags=["orders"])


def order_to_out(order: models.Order, with_qr: bool = True) -> OrderOut:
    """تبدیل مدل سفارش به اسکیمای خروجی + افزودن تصویر QR در صورت نیاز"""
    out = OrderOut.model_validate(order)
    if with_qr:
        out.qr_image = make_qr_base64(order.code)
    return out


@router.post("", response_model=OrderOut, status_code=201)
async def place_order(body: OrderCreate, db: Session = Depends(get_db)):
    """ثبت سفارش آنلاین مشتری — وضعیت اولیه pending.
    در پاسخ، تصویر QR کد سفارش هم برمی‌گردد تا به مشتری نمایش داده شود.
    همچنین اعلان WebSocket به پنل صندوق ارسال می‌شود."""
    order = create_order(db, body, source="online", status="pending")

    # ارسال اعلان WebSocket به همه کلاینت‌های متصل
    await ws_manager.broadcast({
        "type": "new_order",
        "order_id": order.id,
        "code": order.code,
        "total": order.total_amount,
    })

    return order_to_out(order)


@router.get("/{code}", response_model=OrderOut)
def get_order(code: str, db: Session = Depends(get_db)):
    """مشاهده سفارش با کد — برای صفحه موفقیت مشتری (همیشه قابل بازکردن)"""
    order = (
        db.query(models.Order)
        .filter(models.Order.code == code.strip().upper())
        .first()
    )
    if order is None:
        raise HTTPException(status_code=404, detail="سفارشی با این کد پیدا نشد")
    return order_to_out(order)
