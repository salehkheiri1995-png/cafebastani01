"""پنل صندوق — اسکن QR، سفارش دستی، لیست امروز، تغییر وضعیت، ویرایش سفارش (نیاز به توکن)"""
import json
from datetime import datetime, time

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models
from ..auth import require_auth
from ..database import get_db
from ..schemas import OrderCreate, OrderEditIn, OrderEditLogOut, OrderOut, StatusUpdate
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


@router.patch("/orders/{order_id}/items", response_model=OrderOut)
def edit_order_items(order_id: int, body: OrderEditIn, db: Session = Depends(get_db)):
    """ویرایش آیتم‌های سفارش — فقط برای سفارش‌های pending یا preparing مجاز است.
    لیست آیتم‌های ارسال‌شده، آیتم‌های قبلی را کاملاً جایگزین می‌کند.
    تغییرات در جدول order_edit_logs ثبت می‌شود."""
    order = db.get(models.Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="سفارش پیدا نشد")

    if order.status not in models.EDITABLE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"سفارش با وضعیت «{order.status}» قابل ویرایش نیست. فقط pending و preparing قابل ویرایش هستند.",
        )

    # snapshot قبل از ویرایش
    before_items = [
        {"product_id": it.product_id, "product_name": it.product_name,
         "unit_price": it.unit_price, "quantity": it.quantity}
        for it in order.items
    ]
    old_total = order.total_amount

    # ساخت آیتم‌های جدید با قیمت لحظه‌ای از دیتابیس
    new_items: list[models.OrderItem] = []
    new_total = 0
    for item_in in body.items:
        product = db.get(models.Product, item_in.product_id)
        if product is None or not product.is_available or not product.category.is_active:
            name = product.name if product else f"id={item_in.product_id}"
            raise HTTPException(status_code=400, detail=f"محصول «{name}» موجود نیست")
        new_total += product.price * item_in.quantity
        new_items.append(
            models.OrderItem(
                order_id=order.id,
                product_id=product.id,
                product_name=product.name,
                unit_price=product.price,
                quantity=item_in.quantity,
            )
        )

    # snapshot بعد از ویرایش
    after_items = [
        {"product_id": it.product_id, "product_name": it.product_name,
         "unit_price": it.unit_price, "quantity": it.quantity}
        for it in new_items
    ]

    # حذف آیتم‌های قدیمی و جایگزینی با جدید
    for old_item in list(order.items):
        db.delete(old_item)
    db.flush()

    for new_item in new_items:
        db.add(new_item)

    order.total_amount = new_total
    order.updated_at = datetime.now()

    # ثبت لاگ تغییرات
    log = models.OrderEditLog(
        order_id=order.id,
        before_snapshot=json.dumps(before_items, ensure_ascii=False),
        after_snapshot=json.dumps(after_items, ensure_ascii=False),
        old_total=old_total,
        new_total=new_total,
    )
    db.add(log)
    db.commit()
    db.refresh(order)
    return order_to_out(order, with_qr=False)


@router.get("/orders/{order_id}/edit-logs", response_model=list[OrderEditLogOut])
def get_edit_logs(order_id: int, db: Session = Depends(get_db)):
    """دریافت تاریخچه ویرایش‌های یک سفارش"""
    order = db.get(models.Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="سفارش پیدا نشد")
    logs = (
        db.query(models.OrderEditLog)
        .filter(models.OrderEditLog.order_id == order_id)
        .order_by(models.OrderEditLog.edited_at.desc())
        .all()
    )
    return logs
