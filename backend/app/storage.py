"""ذخیره و حذف امن فایل عکس محصولات در backend/static/products"""
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from PIL import Image

# مسیرها مستقل از cwd محاسبه می‌شوند: backend/app/storage.py → backend/
BACKEND_DIR: Path = Path(__file__).resolve().parent.parent
STATIC_DIR: Path = BACKEND_DIR / "static"
PRODUCTS_DIR: Path = STATIC_DIR / "products"

# پیشوند وبی که در دیتابیس ذخیره می‌شود
WEB_PREFIX = "/static/products/"

# سایز هدف ریسایز
TARGET_SIZE = (400, 400)

ALLOWED_EXTENSIONS: set[str] = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
CONTENT_TYPE_EXT: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def ensure_dirs() -> None:
    """ساخت پوشه static/products اگر وجود نداشت"""
    PRODUCTS_DIR.mkdir(parents=True, exist_ok=True)


def pick_extension(filename: str | None, content_type: str | None) -> str:
    """استخراج محتاطانه پسوند: اول از اسم فایل، بعد از mimetype، در نهایت jpg"""
    if filename:
        ext = Path(filename).suffix.lower()
        if ext in ALLOWED_EXTENSIONS:
            return ext
    if content_type in CONTENT_TYPE_EXT:
        return CONTENT_TYPE_EXT[content_type]
    return ".jpg"


def _resize_image(data: bytes, target_size: tuple[int, int] = TARGET_SIZE) -> bytes:
    """ریسایز عکس به سایز مشخص با حفظ کیفیت — خروجی JPEG"""
    img = Image.open(BytesIO(data))

    # تبدیل RGBA به RGB برای سازگاری با JPEG
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    # ریسایز با حفظ نسبت ابعاد و سپس crop به مربع
    img.thumbnail(target_size, Image.Resampling.LANCZOS)

    # ساخت بوم مربعی و قرار دادن تصویر در مرکز
    background = Image.new("RGB", target_size, (255, 255, 255))
    offset_x = (target_size[0] - img.width) // 2
    offset_y = (target_size[1] - img.height) // 2
    background.paste(img, (offset_x, offset_y))

    buf = BytesIO()
    background.save(buf, format="JPEG", quality=85, optimize=True)
    return buf.getvalue()


def save_product_image(
    data: bytes, filename: str | None, content_type: str | None
) -> str:
    """ذخیره bytes عکس با نام یکتا، ریسایز به 400x400، و برگرداندن آدرس وبی (/static/products/...)"""
    ensure_dirs()

    # ریسایز عکس
    try:
        resized_data = _resize_image(data)
    except Exception:
        # اگر ریسایز ناموفق بود، فایل اصلی ذخیره شود
        resized_data = data

    unique_name = uuid4().hex + ".jpg"  # خروجی همیشه JPEG پس از ریسایز
    (PRODUCTS_DIR / unique_name).write_bytes(resized_data)
    return WEB_PREFIX + unique_name


def delete_product_image_file(image_url: str | None) -> None:
    """حذف فایل فیزیکی عکس — فقط اگر واقعاً داخل static/products باشد.

    ضد path traversal: فقط اسم فایل (بدون هیچ مسیری) برداشته می‌شود و
    مسیر نهایی resolve شده باید داخل PRODUCTS_DIR بماند."""
    if not image_url or not image_url.startswith(WEB_PREFIX):
        return
    file_name = Path(image_url).name  # فقط اسم فایل، هر مسیر اضافه دور ریخته می‌شود
    target = (PRODUCTS_DIR / file_name).resolve()
    try:
        if target.is_relative_to(PRODUCTS_DIR.resolve()) and target.is_file():
            target.unlink()
    except OSError:
        # خطای حذف فایل نباید عملیات اصلی (دیتابیس) را بشکند
        pass
