"""منطق مشترک ساخت سفارش — هم برای سفارش آنلاین مشتری هم سفارش دستی صندوق"""
import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from . import models
from .schemas import OrderCreate


def generate_order_code(db: Session) -> str:
    """تولید کد یکتای ۸ کاراکتری سفارش (محتوای QR)"""
    while True:
        code = uuid.uuid4().hex[:8].upper()
        exists = db.query(models.Order).filter(models.Order.code == code).first()
        if exists is None:
            return code


def create_order(db: Session, body: OrderCreate, source: str, status: str) -> models.Order:
    """ساخت سفارش با اسنپ‌شات اسم و قیمت محصول.
    قیمت‌ها همیشه از دیتابیس خوانده می‌شوند، نه از کلاینت — تا تغییر قیمت مدیر
    بلافاصله اعمال شود و کسی نتواند قیمت دستکاری‌شده بفرستد."""
    items: list[models.OrderItem] = []
    total = 0

    for item in body.items:
        product = db.get(models.Product, item.product_id)
        if (
            product is None
            or not product.is_available
            or not product.category.is_active
        ):
            name = product.name if product else f"با شناسه {item.product_id}"
            raise HTTPException(status_code=400, detail=f"محصول «{name}» موجود نیست")

        total += product.price * item.quantity
        items.append(
            models.OrderItem(
                product_id=product.id,
                product_name=product.name,  # اسنپ‌شات اسم در لحظه ثبت
                unit_price=product.price,  # اسنپ‌شات قیمت در لحظه ثبت
                quantity=item.quantity,
            )
        )

    order = models.Order(
        code=generate_order_code(db),
        status=status,
        source=source,
        customer_name=(body.customer_name or None),
        note=(body.note or None),
        total_amount=total,
        items=items,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order
