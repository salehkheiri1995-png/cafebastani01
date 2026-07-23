"""ذخیره و حذف امن فایل عکس محصولات در backend/static/products"""
from pathlib import Path
from uuid import uuid4

# مسیرها مستقل از cwd محاسبه می‌شوند: backend/app/storage.py → backend/
BACKEND_DIR: Path = Path(__file__).resolve().parent.parent
STATIC_DIR: Path = BACKEND_DIR / "static"
PRODUCTS_DIR: Path = STATIC_DIR / "products"

# پیشوند وبی که در دیتابیس ذخیره می‌شود
WEB_PREFIX = "/static/products/"

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


def save_product_image(
    data: bytes, filename: str | None, content_type: str | None
) -> str:
    """ذخیره bytes عکس با نام یکتا و برگرداندن آدرس وبی (/static/products/...)"""
    ensure_dirs()
    unique_name = uuid4().hex + pick_extension(filename, content_type)
    (PRODUCTS_DIR / unique_name).write_bytes(data)
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
