"""داده اولیه منو — فقط وقتی دیتابیس خالی است اجرا می‌شود"""
from sqlalchemy.orm import Session

from . import models

# منوی نمونه: دسته → [(اسم محصول، قیمت به تومان)]
SEED_MENU: dict[str, list[tuple[str, int]]] = {
    "آبمیوه": [
        ("آب هویج", 60_000),
        ("آب طالبی", 70_000),
        ("آب انار", 90_000),
        ("معجون", 120_000),
    ],
    "بستنی": [
        ("بستنی سنتی زعفرانی", 80_000),
        ("بستنی شاتوت", 75_000),
        ("فالوده شیرازی", 65_000),
        ("فالوده بستنی", 85_000),
    ],
    "دسر": [
        ("کیک شکلاتی", 95_000),
        ("تیرامیسو", 120_000),
        ("ژله بستنی", 60_000),
    ],
    "شیرموز": [
        ("شیرموز", 85_000),
        ("شیرموز بستنی", 100_000),
        ("شیر پسته", 130_000),
    ],
    "قهوه": [
        ("اسپرسو", 55_000),
        ("لاته", 75_000),
        ("کاپوچینو", 75_000),
        ("آیس‌لاته", 85_000),
    ],
}


def seed_if_empty(db: Session) -> None:
    """اگر هیچ دسته‌ای وجود نداشت، منوی نمونه را می‌سازد"""
    if db.query(models.Category).first() is not None:
        return

    for i, (cat_name, products) in enumerate(SEED_MENU.items()):
        category = models.Category(name=cat_name, display_order=i)
        db.add(category)
        db.flush()  # برای گرفتن id دسته قبل از commit
        for j, (product_name, price) in enumerate(products):
            db.add(
                models.Product(
                    category_id=category.id,
                    name=product_name,
                    price=price,
                    display_order=j,
                )
            )
    db.commit()
