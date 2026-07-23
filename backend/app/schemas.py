"""اسکیماهای Pydantic برای ورودی/خروجی API"""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

# ---------- احراز هویت ----------


class LoginIn(BaseModel):
    password: str


class TokenOut(BaseModel):
    token: str


# ---------- دسته‌بندی ----------


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    display_order: int
    is_active: bool


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    display_order: int = 0


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    display_order: int | None = None
    is_active: bool | None = None


# ---------- محصول ----------


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int
    name: str
    description: str | None = None
    price: int
    image_url: str | None = None
    is_available: bool
    display_order: int


class ProductCreate(BaseModel):
    category_id: int
    name: str = Field(min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=500)
    price: int = Field(gt=0, description="قیمت به تومان")
    is_available: bool = True
    display_order: int = 0


class ProductUpdate(BaseModel):
    category_id: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=500)
    price: int | None = Field(default=None, gt=0)
    is_available: bool | None = None
    display_order: int | None = None


# ---------- منوی مشتری ----------


class MenuCategoryOut(BaseModel):
    id: int
    name: str
    display_order: int
    products: list[ProductOut]


# ---------- سفارش ----------


class OrderItemIn(BaseModel):
    product_id: int
    quantity: int = Field(gt=0, le=50)


class OrderCreate(BaseModel):
    items: list[OrderItemIn] = Field(min_length=1)
    customer_name: str | None = Field(default=None, max_length=100)
    note: str | None = Field(default=None, max_length=500)


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: int
    product_name: str
    unit_price: int
    quantity: int


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    status: str
    source: str
    customer_name: str | None = None
    note: str | None = None
    total_amount: int
    created_at: datetime
    items: list[OrderItemOut]
    qr_image: str | None = None


class StatusUpdate(BaseModel):
    status: str


class DeleteResult(BaseModel):
    deleted: bool
    detail: str


class ImageUploadResult(BaseModel):
    """پاسخ آپلود موفق عکس محصول"""

    image_url: str
    detail: str


# ---------- ویرایش سفارش ----------


class OrderEditIn(BaseModel):
    """ورودی ویرایش سفارش — لیست کامل آیتم‌های جدید (جایگزین می‌شود)"""
    items: list[OrderItemIn] = Field(min_length=1, description="لیست کامل آیتم‌های جدید")


class OrderEditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    before_snapshot: str
    after_snapshot: str
    old_total: int
    new_total: int
    edited_at: datetime
