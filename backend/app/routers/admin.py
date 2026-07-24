"""پنل مدیریت منو — CRUD دسته و محصول + آپلود عکس (نیاز به توکن)"""
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from .. import models
from ..auth import require_role
from ..database import get_db
from ..schemas import (
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    DeleteResult,
    ImageUploadResult,
    ProductCreate,
    ProductOut,
    ProductUpdate,
)
from ..storage import delete_product_image_file, save_product_image

# سقف حجم عکس محصول: ۵ مگابایت
MAX_IMAGE_BYTES = 5 * 1024 * 1024

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(require_role("admin"))],
)

# ---------------- دسته‌ها ----------------


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    """همه دسته‌ها، حتی غیرفعال‌ها — برای پنل مدیریت"""
    return (
        db.query(models.Category)
        .order_by(models.Category.display_order, models.Category.id)
        .all()
    )


@router.post("/categories", response_model=CategoryOut, status_code=201)
def create_category(body: CategoryCreate, db: Session = Depends(get_db)):
    duplicate = (
        db.query(models.Category).filter(models.Category.name == body.name).first()
    )
    if duplicate:
        raise HTTPException(status_code=400, detail="دسته‌ای با این نام وجود دارد")
    category = models.Category(name=body.name, display_order=body.display_order)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.patch("/categories/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: int, body: CategoryUpdate, db: Session = Depends(get_db)
):
    category = db.get(models.Category, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="دسته پیدا نشد")

    updates = body.model_dump(exclude_unset=True)
    if "name" in updates:
        duplicate = (
            db.query(models.Category)
            .filter(
                models.Category.name == updates["name"],
                models.Category.id != category_id,
            )
            .first()
        )
        if duplicate:
            raise HTTPException(status_code=400, detail="دسته‌ای با این نام وجود دارد")

    for field, value in updates.items():
        setattr(category, field, value)
    db.commit()
    db.refresh(category)
    return category


@router.delete("/categories/{category_id}", response_model=DeleteResult)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    category = db.get(models.Category, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="دسته پیدا نشد")
    if category.products:
        raise HTTPException(
            status_code=400,
            detail="این دسته محصول دارد — اول محصولاتش را حذف یا جابه‌جا کنید",
        )
    db.delete(category)
    db.commit()
    return DeleteResult(deleted=True, detail="دسته حذف شد")


# ---------------- محصولات ----------------


@router.get("/products", response_model=list[ProductOut])
def list_products(
    category_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """همه محصولات، حتی ناموجودها — با فیلتر اختیاری دسته"""
    query = db.query(models.Product)
    if category_id is not None:
        query = query.filter(models.Product.category_id == category_id)
    return query.order_by(
        models.Product.category_id,
        models.Product.display_order,
        models.Product.id,
    ).all()


@router.post("/products", response_model=ProductOut, status_code=201)
def create_product(body: ProductCreate, db: Session = Depends(get_db)):
    if db.get(models.Category, body.category_id) is None:
        raise HTTPException(status_code=400, detail="دسته انتخاب‌شده وجود ندارد")
    product = models.Product(**body.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.patch("/products/{product_id}", response_model=ProductOut)
def update_product(product_id: int, body: ProductUpdate, db: Session = Depends(get_db)):
    product = db.get(models.Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="محصول پیدا نشد")

    updates = body.model_dump(exclude_unset=True)
    if "category_id" in updates and db.get(models.Category, updates["category_id"]) is None:
        raise HTTPException(status_code=400, detail="دسته انتخاب‌شده وجود ندارد")

    for field, value in updates.items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


@router.delete("/products/{product_id}", response_model=DeleteResult)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    """حذف محصول. اگر محصول در سفارشی استفاده شده باشد، به‌جای حذف
    فقط ناموجود می‌شود تا تاریخچه سفارش‌ها سالم بماند."""
    product = db.get(models.Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="محصول پیدا نشد")

    used_in_orders = (
        db.query(models.OrderItem)
        .filter(models.OrderItem.product_id == product_id)
        .first()
    )
    if used_in_orders:
        product.is_available = False
        db.commit()
        return DeleteResult(
            deleted=False,
            detail="این محصول در سفارش‌های قبلی استفاده شده؛ به‌جای حذف، ناموجود شد",
        )

    # حذف واقعی محصول → فایل عکسش هم از دیسک پاک می‌شود
    delete_product_image_file(product.image_url)
    db.delete(product)
    db.commit()
    return DeleteResult(deleted=True, detail="محصول حذف شد")


# ---------------- عکس محصول ----------------


@router.post("/products/{product_id}/image", response_model=ImageUploadResult)
async def upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> ImageUploadResult:
    """آپلود عکس محصول: اعتبارسنجی نوع و حجم، ذخیره با نام یکتا،
    حذف عکس قبلی و ثبت آدرس وبی در دیتابیس."""
    product = db.get(models.Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="محصول پیدا نشد")

    # فقط فایل تصویری قبول می‌شود
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="فقط فایل تصویری مجاز است")

    data: bytes = await file.read()
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="فایل انتخاب‌شده خالی است")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=400, detail="حجم عکس باید کمتر از ۵ مگابایت باشد"
        )

    # عکس قبلی (اگر بود) از دیسک حذف و عکس جدید ذخیره می‌شود
    delete_product_image_file(product.image_url)
    product.image_url = save_product_image(data, file.filename, file.content_type)
    db.commit()
    db.refresh(product)
    return ImageUploadResult(image_url=product.image_url, detail="عکس ذخیره شد")


@router.delete("/products/{product_id}/image", response_model=DeleteResult)
def remove_product_image(
    product_id: int, db: Session = Depends(get_db)
) -> DeleteResult:
    """حذف عکس محصول — هم فایل فیزیکی از دیسک، هم ستون image_url در دیتابیس"""
    product = db.get(models.Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="محصول پیدا نشد")

    delete_product_image_file(product.image_url)
    product.image_url = None
    db.commit()
    return DeleteResult(deleted=True, detail="عکس حذف شد")


# ---------------- تنظیمات ----------------


from ..runtime_settings import runtime_settings
from ..schemas import ToggleResult


@router.patch("/settings/toggle", response_model=ToggleResult)
def toggle_cafe_status():
    """toggle حالت باز/بسته بودن کافه"""
    new_status = runtime_settings.toggle_is_open()
    return ToggleResult(
        is_open=new_status,
        detail="کافه باز شد" if new_status else "کافه بسته شد",
    )


@router.get("/settings/status", response_model=ToggleResult)
def get_cafe_status():
    """دریافت وضعیت فعلی کافه بدون تغییر"""
    return ToggleResult(
        is_open=runtime_settings.is_open,
        detail="کافه باز است" if runtime_settings.is_open else "کافه بسته است",
    )
