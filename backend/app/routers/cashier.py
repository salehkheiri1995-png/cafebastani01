"""پنل صندوق — اسکن QR، سفارش دستی، لیست امروز، تغییر وضعیت (نیاز به توکن)"""
from datetime import datetime, time

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models
from ..auth import require_auth
from ..database import get_db
from ..schemas import OrderCreate, OrderOut, StatusUpdate
from ..services import create_order
from .orders import order_to_out

router = APIRouter(
    prefix="/api/cashier",
    tags=["cashier"],
    dependencies=[Depends(require_auth)],
)


@router.get("/orders", response_model=list[OrderOut])
def today_orders(
    status: str | None = Query(default=None, description="فیلتر وضعیت"),
    db: Session = Depends(get_db),
):
    """لیست سفارش‌های امروز (جدیدترین اول) با فیلتر اختیاری وضعیت"""
    start_of_today = datetime.combine(datetime.now().date(), time.min)
    query = db.query(models.Order).filter(models.Order.created_at >= start_of_today)
    if status:
        query = query.filter(models.Order.status == status)
    orders = query.order_by(models.Order.created_at.desc()).all()
    return [order_to_out(o, with_qr=False) for o in orders]


@router.get("/orders/{code}", response_model=OrderOut)
def scan_order(code: str, db: Session = Depends(get_db)):
    """بازیابی سفارش بعد از اسکن QR (یا ورود دستی کد).
    اگر سفارش pending باشد، خودکار وارد مرحله آماده‌سازی (preparing) می‌شود."""
    order = (
        db.query(models.Order)
        .filter(models.Order.code == code.strip().upper())
        .first()
    )
    if order is None:
        raise HTTPException(status_code=404, detail="سفارشی با این کد پیدا نشد")

    if order.status == "pending":
        order.status = "preparing"
        db.commit()
        db.refresh(order)

    return order_to_out(order, with_qr=False)


@router.post("/orders", response_model=OrderOut, status_code=201)
def walk_in_order(body: OrderCreate, db: Session = Depends(get_db)):
    """ثبت سفارش حضوری برای مشتری بدون موبایل — مستقیم وارد آماده‌سازی می‌شود"""
    order = create_order(db, body, source="walk_in", status="preparing")
    return order_to_out(order, with_qr=False)


@router.patch("/orders/{order_id}/status", response_model=OrderOut)
def update_status(order_id: int, body: StatusUpdate, db: Session = Depends(get_db)):
    """تغییر وضعیت سفارش با اعتبارسنجی گذار مجاز"""
    order = db.get(models.Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="سفارش پیدا نشد")

    if body.status not in models.ORDER_STATUSES:
        raise HTTPException(status_code=400, detail="وضعیت نامعتبر است")

    if body.status not in models.ALLOWED_TRANSITIONS[order.status]:
        raise HTTPException(
            status_code=400,
            detail=f"تغییر وضعیت از «{order.status}» به «{body.status}» مجاز نیست",
        )

    order.status = body.status
    db.commit()
    db.refresh(order)
    return order_to_out(order, with_qr=False)
