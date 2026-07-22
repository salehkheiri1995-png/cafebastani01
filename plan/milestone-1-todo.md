# Milestone 1 — مدل‌های دیتابیس و Backend API پایه

هدف: بک‌اند FastAPI کامل با SQLite که همه endpointهای منو، سفارش، صندوق و مدیریت را داشته باشد و با Swagger UI (`/docs`) قابل تست باشد. (فرانت هنوز ساخته نمی‌شود.)

## راه‌اندازی پروژه
- [x] ساخت پوشه `backend/` با ساختار `app/` طبق spec
- [x] `requirements.txt`: fastapi، uvicorn، sqlalchemy، pydantic، pydantic-settings، qrcode[pil]، python-jose (JWT)، python-multipart
- [x] `config.py` + `.env.example`: رمز پنل (`PANEL_PASSWORD`)، کلید JWT (`SECRET_KEY`)، origin فرانت برای CORS
- [x] `main.py`: ساخت اپ FastAPI، اتصال روترها، تنظیم CORS

## دیتابیس و مدل‌ها
- [x] `database.py`: انجین SQLite (`cafe.db`)، SessionLocal، dependency گرفتن session
- [x] `models.py`: مدل‌های Category، Product، Order، OrderItem دقیقاً طبق جدول‌های spec (با روابط و اسنپ‌شات قیمت)
- [x] ساخت خودکار جدول‌ها موقع استارت اپ
- [x] اسکریپت seed: دسته‌های اولیه (آبمیوه، بستنی، دسر، شیرموز، قهوه) + چند محصول نمونه با قیمت — فقط اگر دیتابیس خالی باشد

## اسکیماها و احراز هویت
- [x] `schemas.py`: اسکیماهای Pydantic برای ورودی/خروجی همه endpointها (MenuResponse، OrderCreate، OrderResponse، ProductCreate/Update، ...)
- [x] `auth.py`: endpoint `POST /api/auth/login` (مقایسه رمز با env، صدور JWT) + dependency `require_auth` برای مسیرهای محافظت‌شده

## Endpointهای عمومی
- [x] `GET /api/menu`: دسته‌های فعال + محصولات available، مرتب با display_order
- [x] `POST /api/orders`: اعتبارسنجی آیتم‌ها، خواندن قیمت از دیتابیس (نه کلاینت)، ساخت کد یکتای سفارش، محاسبه total، ذخیره Order + OrderItemها با اسنپ‌شات
- [x] `GET /api/orders/{code}`: جزئیات سفارش با کد

## Endpointهای صندوق (محافظت‌شده)
- [x] `GET /api/cashier/orders/{code}`: بازیابی سفارش + گذار خودکار pending→preparing
- [x] `GET /api/cashier/orders`: لیست سفارش‌های امروز با فیلتر status
- [x] `POST /api/cashier/orders`: ثبت سفارش دستی walk_in با وضعیت preparing
- [x] `PATCH /api/cashier/orders/{id}/status`: تغییر وضعیت با اعتبارسنجی گذار مجاز (طبق دیاگرام spec)

## Endpointهای مدیریت (محافظت‌شده)
- [x] CRUD کامل `/api/admin/categories` (حذف فقط وقتی محصول ندارد)
- [x] CRUD کامل `/api/admin/products` (حذف محصولِ استفاده‌شده در سفارش → تبدیل به ناموجود)

## تولید QR
- [x] `qr.py`: تابع تولید QR از کد سفارش → PNG → base64 (در پاسخ POST /api/orders و GET /api/orders/{code})

## تست و تحویل
- [x] تست دستی همه endpointها از Swagger UI: ثبت سفارش، اسکن‌مانند با code، تغییر وضعیت‌ها، CRUD منو
- [x] تست سناریوهای خطا: محصول ناموجود، quantity صفر، گذار وضعیت غیرمجاز، توکن نامعتبر
- [x] README کوتاه داخل backend: نحوه اجرا (`pip install -r requirements.txt` و `uvicorn app.main:app --reload`)

✅ معیار پذیرش: کارفرما با باز کردن `/docs` بتواند یک سفارش ثبت کند، با کدش بازیابی کند، وضعیتش را تا completed ببرد، و قیمت یک محصول را از مسیر admin عوض کند.
