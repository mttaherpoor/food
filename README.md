# فودسک | Foodesk

سامانه رزرو غذای سازمانی با رابط فارسی و راست‌به‌چپ (RTL)، مبتنی بر Django REST Framework و React.

## فهرست مستندات

- [Backend](#backend)
- [Excel Import](#excel-sample-data)
- [Frontend](#frontend)
- [Authentication](#authentication)
- [Secrets](#secrets)
- [Branding](#مدیریت-branding)
- [Environment](#متغیرهای-محیطی)
- [Testing](#تست-و-کیفیت-کد)
- [Production](#ملاحظات-production)

## Backend

Django REST Framework API for the food reservation system.

## Local Docker development

1. Copy each `secrets/*.example.txt` file to its corresponding `*.txt` file
   and replace the placeholder with a strong local value.
2. Optionally copy `.env.example` to `.env` for non-sensitive configuration.
3. Start the services with `docker compose up --build` from the repository root.
4. Open `/api/v1/health`, `/api/v1/schema`, or `/api/v1/docs` on port 8000.

Employees can read their own reservation history at `GET /api/v1/reservations`.
The weekly menu is available at `GET /api/v1/reservations/weekly?start=YYYY-MM-DD`.
HR and Viewer can read the daily summary at
`GET /api/v1/reports/daily?from=YYYY-MM-DD&to=YYYY-MM-DD`. Viewer access to food,
side, drink, and menu catalogs is read-only.

Database migrations are intentionally not applied automatically by the image.
Run them only as an explicit reviewed operation.

## Excel sample data

Catalog prices are whole amounts in Toman.

Validate the sample workbooks without changing the database:

```bash
python manage.py import_employees sample_data/sample_employees.xlsx --dry-run
python manage.py import_catalog sample_data/sample_catalog.xlsx --dry-run
python manage.py import_monthly_menu sample_data/sample_monthly_menu.xlsx --dry-run
```

Remove `--dry-run` to import the records. Imports are create-only and atomic: an
invalid or existing personnel number or catalog name prevents the entire workbook from being
written. Employee passwords initially equal their personnel numbers and must be
changed at first sign-in.

The employee workbook contains personnel number, building number, department
number, and active status. Employee names are not imported.

Monthly menu workbooks contain exactly three sheets: `Foods`, `Sides`, and
`Drinks`. The `Foods` columns are `date`, `name`, `price_toman`,
`container_price_toman`, and `special_container_price_toman`. Dates may be Excel
dates or `YYYY-MM-DD`; food names must already exist in the food catalog. The
menu price is the food price plus the higher of the two container prices. The
`Sides` and `Drinks` sheets use `name` and `price_toman`; new options are added
to the catalog and existing names with changed prices are rejected. Duplicate
menu dates in the workbook are rejected. Existing matching menu dates and prices
are left unchanged so reimporting the same file is safe; a date with different
food or price is rejected instead of overwriting menu history. Import is atomic
and supports `--dry-run`.

---

## Frontend

> نکته: توضیحات استقرار Nginx در مستندات قبلی وجود داشته است.
> این بخش باید پیش از استفاده عملیاتی با Docker Compose فعلی تطبیق داده شود.

The frontend is a Persian, right-to-left React PWA built with Vite and TypeScript.

## Local development

Frontend با React، TypeScript، Vite و Tailwind CSS 4 توسعه داده شده است.

در Docker Compose فعلی، Frontend با Vite Development Server
روی پورت `5173` اجرا می‌شود. Nginx در این Compose وجود ندارد.

برای راه‌اندازی از ریشه پروژه:

1. فایل‌های Secret را با استفاده از نمونه‌های `secrets/` ایجاد کنید.
2. فایل `.env.example` را به `.env` کپی و تنظیم کنید.
3. شبکه `shared_net` را در صورت نبود ایجاد کنید.
4. پوشه `/opt/food/media` را روی میزبان ایجاد کنید.
5. دستور `docker compose up --build -d` را اجرا کنید.
6. Migrationها را با دستور زیر اعمال کنید:

`docker compose exec -T backend python manage.py migrate`

آدرس‌های Development:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- Health: `http://localhost:8000/api/v1/health`
- Schema: `http://localhost:8000/api/v1/schema`
- API Docs: `http://localhost:8000/api/v1/docs`

Vite درخواست‌های `/api` را به Backend هدایت می‌کند.

## Authentication

The app checks `/api/v1/auth/session` before showing protected pages. An anonymous
visitor is sent to `/login`; after signing in, the requested page is restored.
Accounts flagged for an initial password change must update their password before
using reservations, history, reports, or catalog management. Session cookies and
Django CSRF protection are used on the same origin.

---

## Secrets

Docker Compose mounts each value in this directory as a separate file under
`/run/secrets` inside the relevant container.

Create the local files before starting the stack:

- `django_secret_key.txt`
- `postgres_password.txt`

The real `*.txt` files are ignored by Git. The `*.example.txt` files document
the expected format and must never contain production credentials.

Docker Compose secrets protect values from being placed in container
environment variables, but the source files are not encrypted at rest. Keep
filesystem permissions appropriately restricted and use a production secret
manager outside local development.

---

## مدیریت Branding

نام پیش‌فرض سامانه **فودسک (Foodesk)** و توضیح آن
«سامانه رزرو غذای سازمانی» است.

تنظیمات Branding از طریق مدل Singleton به نام `core.SiteSettings`
در PostgreSQL نگهداری می‌شوند.

تنها Super Admin فعال اجازه مشاهده و تغییر آن‌ها را در Django Unfold دارد.

فیلدهای قابل تنظیم:

- `site_name`: نام فارسی
- `site_name_en`: نام انگلیسی
- `site_description`: توضیحات
- `logo`: لوگوی سامانه
- `favicon`: آیکون مرورگر

فرمت‌های PNG، JPEG و WebP برای تصاویر Branding پشتیبانی می‌شوند.
برای امنیت، آپلود SVG مجاز نیست. محدودیت تصاویر ۲ MiB و
۴ میلیون پیکسل است.

API عمومی `GET /api/v1/config` تنظیمات را به React ارائه می‌دهد.
این Endpoint نیازی به ورود ندارد و فقط خواندنی است.

عنوان و تصاویر Django Unfold نیز از همین تنظیمات دریافت می‌شوند.
تا زمان آپلود تصویر، آیکون پیش‌فرض استفاده می‌شود.

نام و آیکون PWA در Manifest فعلی استاتیک هستند و تغییر تنظیمات
Admin الزاماً نام نسخه‌های نصب‌شده PWA را به‌روزرسانی نمی‌کند.

## متغیرهای محیطی

فایل `.env.example` تنظیمات نمونه Development را نگهداری می‌کند.

- `DJANGO_SETTINGS_MODULE`: ماژول تنظیمات Django
- `DJANGO_DEBUG`: حالت Debug
- `DJANGO_ALLOWED_HOSTS`: میزبان‌های مجاز
- `DJANGO_CSRF_TRUSTED_ORIGINS`: Originهای مورد اعتماد
- `POSTGRES_DB`: نام پایگاه داده
- `POSTGRES_USER`: نام کاربری PostgreSQL
- `DOCKER_COMPOSE_RESERVATION_CUTOFF_HOUR`: ساعت پایان رزرو

متغیر `DOCKER_COMPOSE_RESERVATION_CUTOFF_HOUR` توسط Docker Compose
به `RESERVATION_CUTOFF_HOUR` در کانتینر Backend منتقل می‌شود.

مقدار پیش‌فرض `10` است و فقط اعداد صحیح `0` تا `23` پذیرفته می‌شوند.

مهلت رزرو، ساعت تعیین‌شده در **روز قبل از تاریخ منو** و با
منطقه زمانی `Asia/Tehran` است.

برای اعمال تغییر ENV، کانتینر Backend باید با محیط جدید بازایجاد شود.

## تست و کیفیت کد

دستورات Backend:

```bash
docker compose exec -T backend python manage.py check
docker compose exec -T backend python manage.py test
docker compose exec -T backend ruff check .
docker compose exec -T backend python manage.py makemigrations --check --dry-run
```

دستورات Frontend:

```bash
docker compose exec -T frontend pnpm typecheck
docker compose exec -T frontend pnpm lint
docker compose exec -T frontend pnpm test:run
```

Backend از Django Test Runner استفاده می‌کند، نه pytest.

## ملاحظات Production

Docker Compose فعلی مخصوص Development است و نباید بدون
آماده‌سازی امنیتی برای Production استفاده شود.

- Backend فعلاً با Django `runserver` اجرا می‌شود.
- Frontend با Vite Development Server اجرا می‌شود.
- `DJANGO_DEBUG=true` مخصوص محیط توسعه است.
- PostgreSQL روی شبکه داخلی `food_reservation_internal` است.
- Frontend و Backend به شبکه External `shared_net` متصل هستند.
- اطلاعات دیتابیس در Volume `postgres_data` ذخیره می‌شوند.
- فایل‌های Media در Volume `food_media` ذخیره می‌شوند که
  به مسیر `/opt/food/media` روی میزبان متصل است.
- `MEDIA_URL` برابر `/media/` و `MEDIA_ROOT` برابر `/app/media` است.
- Static و Media در Production به فایل‌رسانی مناسب نیاز دارند.
- HTTPS، تنظیمات Cookie و CSRF، مدیریت Secrets و پشتیبان‌گیری
  باید پیش از استقرار عملیاتی بررسی شوند.
