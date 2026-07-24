# 🍨 سیستم سفارش آنلاین کافه‌بستنی

> سیستم مدیریت سفارش آنلاین برای کافه‌بستنی — مشتری بیرون کافه QR اسکن می‌کند، سفارش می‌دهد و یک QR مخصوص سفارشش می‌گیرد. داخل کافه، صندوق‌دار آن QR را با وب‌کم لپ‌تاپ اسکن می‌کند، سفارش کامل را می‌بیند و تحویل را ثبت می‌کند.

![Python](https://img.shields.io/badge/Python-3.11+-blue?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-green?logo=fastapi)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![SQLite](https://img.shields.io/badge/SQLite-local-lightblue?logo=sqlite)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?logo=tailwindcss)

---

## 📋 فهرست مطالب

- [معرفی](#-معرفی)
- [جریان اصلی](#-جریان-اصلی)
- [استک تکنولوژی](#-استک-تکنولوژی)
- [ساختار پروژه](#-ساختار-پروژه)
- [پیش‌نیازها](#-پیشنیازها)
- [راه‌اندازی](#-راهاندازی)
- [صفحه‌ها و مسیرها](#-صفحهها-و-مسیرها)
- [API Endpoints](#-api-endpoints)
- [مدل‌های دیتابیس](#-مدلهای-دیتابیس)
- [چرخه وضعیت سفارش](#-چرخه-وضعیت-سفارش)
- [اتصال موبایل مشتریان](#-اتصال-موبایل-مشتریان-شبکه-local)
- [نکته مهم وب‌کم](#-نکته-مهم-وبکم-پنل-صندوق)
- [بکاپ](#-بکاپ)
- [Milestoneها](#-milestoneها)

---

## 🎯 معرفی

این پروژه یک سیستم سفارش‌گیری آنلاین برای کافه‌بستنی‌هایی است که **آبمیوه، بستنی، دسر، شیرموز و قهوه** می‌فروشند. طراحی سیستم به‌گونه‌ای است که:

- **پرداخت** کاملاً حضوری است (نقدی/کارتخوان) — بدون درگاه پرداخت آنلاین
- **UI** فارسی و راست‌به‌چپ (RTL) با فونت Vazirmatn
- **استقرار** ساده است: SQLite local، بدون نیاز به سرور ابری
- **منوی مشتری** موبایل‌فرست؛ **پنل‌های صندوق و مدیریت** بهینه لپ‌تاپ

مستندات کامل فنی در [`spec.md`](spec.md) و جزئیات تسک‌ها در پوشه [`plan/`](plan/) است.

---

## 🔄 جریان اصلی

```
مشتری بیرون کافه ──اسکن QR منو──▶ صفحه منوی وب ──انتخاب آیتم‌ها──▶ ثبت سفارش
        │
        ▼
   دریافت QR کد مخصوص سفارش روی موبایل
        │
        ▼
مشتری داخل کافه ──نشون دادن QR──▶ صندوق‌دار با لپ‌تاپ اسکن می‌کنه
        │
        ▼
جزئیات سفارش (اقلام، قیمت، جمع کل) ──▶ آماده‌سازی ──▶ تحویل + پرداخت حضوری
```

---

## 🛠 استک تکنولوژی

| لایه | تکنولوژی |
|---|---|
| **Backend** | Python 3.11+ / FastAPI / SQLAlchemy 2 / Pydantic v2 / Uvicorn |
| **Database** | SQLite (فایل local) |
| **Frontend** | React 18 + TypeScript + Vite |
| **استایل** | Tailwind CSS (RTL) + فونت Vazirmatn |
| **تولید QR سفارش** | کتابخانه `qrcode` پایتون (base64 در پاسخ API) |
| **اسکن QR در مرورگر** | کتابخانه `html5-qrcode` (وب‌کم لپ‌تاپ در پنل صندوق) |
| **احراز هویت** | رمز عبور ثابت در `.env` → توکن JWT |

---

## 📁 ساختار پروژه

```
cafebastani01/
├── README.md
├── spec.md                       ← مشخصات کامل فنی
├── start.bat                     ← اجرای سریع (Windows)
├── plan/                         ← تسک‌های هر milestone
│   ├── milestone-1-todo.md
│   ├── milestone-2-todo.md
│   ├── milestone-3-todo.md
│   └── milestone-4-todo.md
├── backend/
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── main.py               ← نقطه ورود FastAPI + CORS
│       ├── config.py             ← تنظیمات از .env
│       ├── database.py           ← اتصال SQLite و Session
│       ├── models.py             ← مدل‌های SQLAlchemy
│       ├── schemas.py            ← اسکیماهای Pydantic
│       ├── auth.py               ← لاگین و بررسی توکن JWT
│       ├── qr.py                 ← تولید QR کد سفارش
│       └── routers/
│           ├── menu.py           ← endpointهای منو (عمومی)
│           ├── orders.py         ← ثبت و پیگیری سفارش
│           └── admin.py          ← CRUD منو/محصولات (محافظت‌شده)
└── frontend/
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx               ← روتینگ (React Router)
        ├── api/client.ts         ← لایه ارتباط با API
        ├── types.ts              ← تایپ‌های TypeScript
        ├── pages/
        │   ├── MenuPage.tsx      ← منوی مشتری (/)
        │   ├── OrderSuccessPage.tsx ← QR سفارش (/order/:code)
        │   ├── LoginPage.tsx     ← ورود به پنل‌ها (/login)
        │   ├── CashierPage.tsx   ← پنل صندوق (/cashier)
        │   └── AdminPage.tsx     ← پنل مدیریت منو (/admin)
        └── components/           ← کامپوننت‌های مشترک
```

---

## ✅ پیش‌نیازها

- **Python** 3.10 یا جدیدتر
- **Node.js** 18 یا جدیدتر

---

## 🚀 راه‌اندازی

### روش سریع (Windows)

فایل `start.bat` را در ریشه پروژه اجرا کنید — به‌صورت خودکار هر دو سرویس را راه‌اندازی می‌کند.

### راه‌اندازی دستی

#### ۱) بک‌اند (FastAPI)

در **ترمینال اول** (از ریشه پروژه):

```bat
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

| آدرس | توضیح |
|---|---|
| `http://127.0.0.1:8000` | سرور بک‌اند |
| `http://127.0.0.1:8000/docs` | Swagger UI (تست API) |

> ⚠️ **مهم**: در فایل `.env` حتماً مقدار `PANEL_PASSWORD` (پیش‌فرض `cafe1234`) و `SECRET_KEY` را عوض کنید.
>
> 📌 بار اول اجرا، دیتابیس `cafe.db` خودکار ساخته و با منوی نمونه پر می‌شود.

#### ۲) فرانت‌اند (React)

در **ترمینال دوم**:

```bat
cd frontend
npm install
npm run dev
```

فرانت روی `http://localhost:5173` بالا می‌آید و درخواست‌های `/api` را خودش به بک‌اند پراکسی می‌کند.

---

## 🗺 صفحه‌ها و مسیرها

| آدرس | صفحه | دسترسی |
|---|---|---|
| `/` | منوی مشتری (مقصد QR بیرون کافه) | عمومی |
| `/order/<کد>` | بلیت سفارش مشتری + QR کد | عمومی |
| `/login` | ورود به پنل‌ها | عمومی |
| `/cashier` | پنل صندوق: اسکن QR، سفارش دستی، سفارش‌های امروز | نیاز به لاگین |
| `/admin` | پنل مدیریت منو: دسته‌ها، محصولات، قیمت‌ها | نیاز به لاگین |

---

## 🔌 API Endpoints

**Base URL**: `/api`

### عمومی — منو و سفارش مشتری

| متد | مسیر | توضیح |
|---|---|---|
| `GET` | `/api/menu` | کل منو: دسته‌های فعال + محصولات موجود |
| `POST` | `/api/orders` | ثبت سفارش — قیمت‌ها از دیتابیس سرور خوانده می‌شوند |
| `GET` | `/api/orders/{code}` | مشاهده سفارش با کد (صفحه موفقیت مشتری) |

### احراز هویت

| متد | مسیر | توضیح |
|---|---|---|
| `POST` | `/api/auth/login` | `{password}` → `{token}` JWT |

### پنل صندوق (نیاز به توکن)

| متد | مسیر | توضیح |
|---|---|---|
| `GET` | `/api/cashier/orders/{code}` | اسکن QR — اگر pending باشد خودکار به preparing می‌رود |
| `GET` | `/api/cashier/orders?status=&date=` | لیست سفارش‌های امروز با فیلتر |
| `POST` | `/api/cashier/orders` | ثبت سفارش دستی (walk_in) |
| `PATCH` | `/api/cashier/orders/{id}/status` | تغییر وضعیت سفارش |

### پنل مدیریت (نیاز به توکن)

| متد | مسیر | توضیح |
|---|---|---|
| `GET/POST` | `/api/admin/categories` | لیست / ایجاد دسته |
| `PATCH/DELETE` | `/api/admin/categories/{id}` | ویرایش / حذف دسته |
| `GET/POST` | `/api/admin/products` | لیست / ایجاد محصول |
| `PATCH/DELETE` | `/api/admin/products/{id}` | ویرایش / حذف محصول |

---

## 🗄 مدل‌های دیتابیس

### Category (دسته‌بندی)
| فیلد | نوع | توضیح |
|---|---|---|
| `id` | INTEGER PK | |
| `name` | TEXT unique | مثل «آبمیوه»، «بستنی»، «دسر» |
| `display_order` | INTEGER | ترتیب نمایش در منو |
| `is_active` | BOOLEAN | مخفی کردن کل دسته از منو |

### Product (محصول)
| فیلد | نوع | توضیح |
|---|---|---|
| `id` | INTEGER PK | |
| `category_id` | FK → Category | |
| `name` | TEXT | مثل «آب هویج»، «بستنی سنتی» |
| `description` | TEXT nullable | توضیح کوتاه اختیاری |
| `price` | INTEGER | قیمت به تومان (عدد صحیح) |
| `is_available` | BOOLEAN | ناموجود موقت بدون حذف |
| `display_order` | INTEGER | ترتیب نمایش داخل دسته |

### Order (سفارش)
| فیلد | نوع | توضیح |
|---|---|---|
| `id` | INTEGER PK | |
| `code` | TEXT unique | کد یکتا (UUID کوتاه) — محتوای QR |
| `status` | TEXT enum | `pending/preparing/ready/completed/cancelled` |
| `source` | TEXT enum | `online` / `walk_in` |
| `customer_name` | TEXT nullable | اسم اختیاری مشتری |
| `note` | TEXT nullable | توضیحات مشتری |
| `total_amount` | INTEGER | جمع کل به تومان |

### OrderItem (قلم سفارش)
| فیلد | نوع | توضیح |
|---|---|---|
| `order_id` | FK → Order | |
| `product_id` | FK → Product | |
| `product_name` | TEXT | **snapshot** نام محصول در لحظه ثبت |
| `unit_price` | INTEGER | **snapshot** قیمت در لحظه ثبت |
| `quantity` | INTEGER | تعداد |

> 💡 **نکته**: اسم و قیمت در `OrderItem` کپی می‌شود تا تغییرات بعدی منو روی سفارش‌های قبلی تأثیر نگذارد.

---

## 🔁 چرخه وضعیت سفارش

```
pending (ثبت آنلاین)
    │
    ├──▶ preparing (بعد از اسکن QR یا ثبت دستی)
    │        │
    │        ├──▶ ready (آماده تحویل)
    │        │        │
    │        │        └──▶ completed (تحویل و تسویه)
    │        │
    │        └──▶ cancelled (لغو)
    │
    └──▶ cancelled (لغو از pending)
```

| وضعیت | معنی |
|---|---|
| `pending` | مشتری آنلاین ثبت کرده، هنوز به کافه نیامده |
| `preparing` | QR اسکن شد و در حال آماده‌سازی است |
| `ready` | آماده تحویل به مشتری |
| `completed` | تحویل داده شد و پول گرفته شد |
| `cancelled` | لغو شده (فقط از `pending` یا `preparing`) |

---

## 📱 اتصال موبایل مشتریان (شبکه local)

1. IP لپ‌تاپ را با دستور `ipconfig` پیدا کنید (مثلاً `192.168.1.20`)
2. موبایل و لپ‌تاپ باید روی یک وای‌فای باشند
3. آدرس منوی مشتری: `http://192.168.1.20:5173`
4. با همین آدرس یک QR کد بسازید (با هر ابزار آنلاین)، چاپ کنید و بیرون کافه بگذارید
5. اگر موبایل وصل نشد، در فایروال ویندوز پورت `5173` را برای شبکه خصوصی باز کنید

---

## 📷 نکته مهم وب‌کم (پنل صندوق)

مرورگر فقط روی **localhost یا HTTPS** اجازه دسترسی به دوربین می‌دهد. پس پنل صندوق را حتماً روی خود لپ‌تاپ با آدرس زیر باز کنید:

```
http://localhost:5173/cashier
```

اگر اسکن ممکن نبود، کد **۸ رقمی** زیر QR مشتری را دستی وارد کنید.

---

## 💾 بکاپ

کل دیتابیس یک فایل است:

```
backend/cafe.db
```

کپی گرفتن از همین فایل = بکاپ کامل تمام سفارش‌ها و منو.

---

## 🏁 Milestoneها

| # | عنوان | خروجی قابل تست |
|---|---|---|
| **1** | مدل‌های دیتابیس + Backend API پایه | API کامل منو/محصولات + ثبت سفارش، تست با Swagger `/docs` |
| **2** | صفحه منوی مشتری (React) | منوی موبایلی RTL، انتخاب آیتم، سبد خرید، ثبت سفارش |
| **3** | QR سفارش + پنل صندوق | نمایش QR به مشتری، اسکن با وب‌کم، لیست سفارش‌ها، walk-in |
| **4** | پنل مدیریت منو | CRUD کامل دسته/محصول با اعمال فوری روی منوی مشتری |

> **قانون کار**: بعد از اتمام هر milestone، توقف کامل تا تست و تایید، سپس شروع milestone بعدی.

---

## 📄 مجوز

این پروژه برای استفاده شخصی/تجاری توسعه داده شده است.
