"""منطق مشترک ساخت سفارش — هم برای سفارش آنلاین مشتری هم سفارش دستی صندوق"""
import threading
import uuid
from datetime import datetime, time

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from . import models
from .schemas import OrderCreate

# تعداد تلاش برای ساخت کد سفارش یکتا در صورت برخورد (race بین دو ثبت همزمان)
MAX_CODE_ATTEMPTS = 4  # ۱ تلاش اولیه + ۳ تلاش مجدد

# قفل ثبت سفارش: شماره صف از max+1 محاسبه می‌شود؛ بدون قفل، دو ثبت همزمان
# (چند thread از threadpool) می‌توانند یک شماره بگیرند. uvicorn تک‌پردازش اجرا
# می‌شود و SQLite هم نوشتن را سریالایز می‌کند، پس یک قفل ساده کافی است.
_order_create_lock = threading.Lock()


def generate_order_code(db: Session) -> str:
    """تولید کد یکتای ۸ کاراکتری سفارش (محتوای QR)"""
    while True:
        code = uuid.uuid4().hex[:8].upper()
        exists = db.query(models.Order).filter(models.Order.code == code).first()
        if exists is None:
            return code


def get_products_with_category(db: Session, product_ids: list[int]) -> dict[int, models.Product]:
    """گرفتن محصولات به همراه دسته‌شان در یک کوئری — جلوگیری از N+1
    (بررسی product.category.is_active بدون کوئری جدا برای هر آیتم انجام می‌شود)"""
    unique_ids = list(dict.fromkeys(product_ids))
    products = (
        db.query(models.Product)
        .options(selectinload(models.Product.category))
        .filter(models.Product.id.in_(unique_ids))
        .all()
    )
    return {p.id: p for p in products}


def get_next_queue_number(db: Session) -> int:
    """شماره صف بعدی از ردیف مشترکِ سفارش‌های امروز — فرقی نمی‌کند سفارش
    آنلاین باشد یا دستی؛ همه از یک دنباله واحد جلو می‌روند"""
    start_of_today = datetime.combine(datetime.now().date(), time.min)
    max_queue = (
        db.query(models.Order.queue_number)
        .filter(models.Order.created_at >= start_of_today)
        .filter(models.Order.queue_number.isnot(None))
        .order_by(models.Order.queue_number.desc())
        .first()
    )
    if max_queue and max_queue[0]:
        return max_queue[0] + 1
    return 1


def create_order(db: Session, body: OrderCreate, source: str, status: str) -> models.Order:
    """ساخت سفارش با اسنپ‌شات اسم و قیمت محصول.
    قیمت‌ها همیشه از دیتابیس خوانده می‌شوند، نه از کلاینت — تا تغییر قیمت مدیر
    بلافاصله اعمال شود و کسی نتواند قیمت دستکاری‌شده بفرستد."""

    # ── بررسی idempotency (میانبر — رقابت واقعی با ایندکس یکتا و IntegrityError حل می‌شود) ──
    if body.idempotency_key:
        existing = (
            db.query(models.Order)
            .filter(models.Order.idempotency_key == body.idempotency_key)
            .first()
        )
        if existing is not None:
            return existing

    # ── خواندن همه محصولات با دسته‌شان در یک کوئری (جلوگیری از N+1) ──
    products = get_products_with_category(db, [item.product_id for item in body.items])

    item_rows: list[dict] = []
    total = 0

    for item in body.items:
        product = products.get(item.product_id)
        if (
            product is None
            or not product.is_available
            or not product.category.is_active
        ):
            name = product.name if product else f"با شناسه {item.product_id}"
            raise HTTPException(status_code=400, detail=f"محصول «{name}» موجود نیست")

        total += product.price * item.quantity
        item_rows.append(
            {
                "product_id": product.id,
                "product_name": product.name,  # اسنپ‌شات اسم در لحظه ثبت
                "unit_price": product.price,  # اسنپ‌شات قیمت در لحظه ثبت
                "quantity": item.quantity,
            }
        )

    # ── ثبت با مدیریت برخورد (race) ──
    # ایندکس یکتای code و idempotency_key برخورد همزمان را تبدیل به IntegrityError
    # می‌کند: برخورد کد سفارش → کد جدید ساخته می‌شود؛ برخورد idempotency_key →
    # سفارش قبلاً ثبت‌شده همان برمی‌گردد (پاسخ تکراری نمی‌سازد)
    #
    # شماره صف برای «همه» سفارش‌ها (آنلاین و دستی) داخل قفل محاسبه می‌شود تا
    # دنباله واحدی داشته باشند و دو ثبت همزمان شماره یکسان نگیرند
    with _order_create_lock:
        queue_num = get_next_queue_number(db)

        for _attempt in range(MAX_CODE_ATTEMPTS):
            order = models.Order(
                code=generate_order_code(db),
                status=status,
                source=source,
                customer_name=(body.customer_name or None),
                note=(body.note or None),
                total_amount=total,
                idempotency_key=body.idempotency_key,
                queue_number=queue_num,
                items=[models.OrderItem(**row) for row in item_rows],
            )
            db.add(order)
            try:
                db.commit()
                db.refresh(order)
                return order
            except IntegrityError:
                db.rollback()
                # اگر همین idempotency_key قبلاً سفارش ثبت کرده باشد، همان را برمی‌گردانیم
                if body.idempotency_key:
                    existing = (
                        db.query(models.Order)
                        .filter(models.Order.idempotency_key == body.idempotency_key)
                        .first()
                    )
                    if existing is not None:
                        return existing
                # برخورد کد سفارش → در تلاش بعدی کد جدید ساخته می‌شود

    # هیچ کد یکتایی پیدا نشد (یا خطای دیگری بود) — تداخل سرور
    raise HTTPException(
        status_code=409,
        detail="ثبت سفارش همزمان انجام شد — لطفاً دوباره تلاش کنید",
    )
