"""ثبت و مشاهده سفارش توسط مشتری — بدون نیاز به لاگین"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..qr import make_qr_base64
from ..rate_limit import SlidingWindowLimiter, client_ip
from ..runtime_settings import runtime_settings
from ..schemas import OrderCreate, OrderOut
from ..services import create_order
from ..ws_manager import ws_manager

router = APIRouter(prefix="/api/orders", tags=["orders"])

# ── Rate Limiting برای ثبت سفارش آنلاین ──
order_limiter = SlidingWindowLimiter(
    max_requests=20,  # حداکثر ۲۰ سفارش در دقیقه برای هر IP
    window_seconds=60,
    detail="تعداد سفارش بیش از حد مجاز است — لطفاً کمی صبر کنید و دوباره تلاش کنید",
)

# ── Rate Limiting برای مشاهده وضعیت سفارش (بدون لاگین، قابل حدس زدن) ──
order_view_limiter = SlidingWindowLimiter(
    max_requests=60,  # حداکثر ۶۰ درخواست در دقیقه برای هر IP
    window_seconds=60,
    detail="تعداد درخواست بیش از حد مجاز است — لطفاً کمی صبر کنید",
)


def order_to_out(order: models.Order, with_qr: bool = True) -> OrderOut:
    """تبدیل مدل سفارش به اسکیمای خروجی + افزودن تصویر QR در صورت نیاز"""
    out = OrderOut.model_validate(order)
    if with_qr:
        out.qr_image = make_qr_base64(order.code)
    return out


# عمداً def است نه async def: کل کار endpoint (دیتابیس + تولید QR) همزمانی است
# و FastAPI آن را در threadpool اجرا می‌کند تا event loop بلاک نشود.
@router.post("", response_model=OrderOut, status_code=201)
def place_order(body: OrderCreate, request: Request, db: Session = Depends(get_db)):
    """ثبت سفارش آنلاین مشتری — وضعیت اولیه pending.
    در پاسخ، تصویر QR کد سفارش هم برمی‌گردد تا به مشتری نمایش داده شود.
    همچنین اعلان WebSocket به پنل صندوق ارسال می‌شود."""
    if not runtime_settings.is_open:
        raise HTTPException(
            status_code=503,
            detail="کافه در حال حاضر پذیرش سفارش ندارد",
        )
    order_limiter.check(client_ip(request))
    order = create_order(db, body, source="online", status="pending")

    # ارسال اعلان WebSocket به همه کلاینت‌های متصل — حداقلی که پنل صندوق لازم دارد؛
    # خود سفارش جداگانه از REST واکشی می‌شود
    ws_manager.broadcast_threadsafe({
        "type": "new_order",
        "code": order.code,
    })

    return order_to_out(order)


@router.get("/{code}", response_model=OrderOut)
def get_order(code: str, request: Request, db: Session = Depends(get_db)):
    """مشاهده سفارش با کد — برای صفحه موفقیت مشتری (همیشه قابل بازکردن)"""
    # مسیر عمومی و بدون لاگین → محدودسازی نرخ بر اساس IP
    order_view_limiter.check(client_ip(request))
    order = (
        db.query(models.Order)
        .filter(models.Order.code == code.strip().upper())
        .first()
    )
    if order is None:
        raise HTTPException(status_code=404, detail="سفارشی با این کد پیدا نشد")
    return order_to_out(order)
