# فودسک | Foodesk

**سامانه رزرو غذای سازمانی** با رابط کاربری فارسی و راست‌به‌چپ (RTL) برای مدیریت رزرو غذای کارکنان.

**زبان:** [English](README.md) | فارسی

## فناوری‌های پروژه

- **Backend:** پایتون ۳.۱۳، Django 6.1، Django REST Framework، Django Unfold و drf-spectacular
- **Frontend:** React 19، TypeScript، Vite، Tailwind CSS 4، Axios و pnpm؛ رابط واکنش‌گرا و PWA
- **پایگاه داده:** PostgreSQL 17
- **زیرساخت توسعه:** Docker Compose، Docker Secrets و Volumeهای پایدار
- **تقویم:** ورودی تاریخ شمسی و خروجی Excel با تاریخ شمسی؛ تاریخ‌های Query در API در مسیرهای مشخص‌شده با قالب `YYYY-MM-DD` هستند

## راه‌اندازی محیط توسعه

فایل `docker-compose.yml` فعلی برای **Development** تنظیم شده، نه Production. Frontend از **Vite Development Server** استفاده می‌کند و Nginx در این Compose وجود ندارد. Backend نیز با `runserver` اجرا می‌شود.

۱. فایل‌های `secrets/django_secret_key.txt` و `secrets/postgres_password.txt` را از روی فایل‌های `.example.txt` بسازید و مقادیر امن قرار دهید. فایل‌های واقعی را Commit نکنید.
۲. در صورت نیاز `.env.example` را به `.env` کپی و تنظیمات را بازبینی کنید.
۳. شبکه خارجی Docker با نام `shared_net` باید موجود باشد؛ در غیر این صورت `docker network create shared_net` را اجرا کنید.
۴. مسیر `/opt/food/media` باید روی میزبان Docker وجود داشته باشد. Volume مربوط به Media از این **مسیر مطلق** استفاده می‌کند؛ در سایر مسیرهای استقرار، Compose را متناسب اصلاح کنید.
۵. سرویس‌ها را اجرا و Migration را به‌صورت دستی اعمال کنید:

```bash
docker compose up --build -d
docker compose exec -T backend python manage.py migrate
```

| سرویس | آدرس محیط توسعه |
|---|---|
| رابط کاربری | `http://localhost:5173` |
| Backend | `http://localhost:8000` |
| بررسی سلامت | `http://localhost:8000/api/v1/health` |
| OpenAPI Schema | `http://localhost:8000/api/v1/schema` |
| مستندات API | `http://localhost:8000/api/v1/docs` |

در محیط توسعه، Vite درخواست‌های `/api` را به Django هدایت می‌کند. Migrationها در فرایند Build به‌صورت خودکار اجرا نمی‌شوند.

## احراز هویت، نقش‌ها و API

احراز هویت با Session جنگو و حفاظت CSRF انجام می‌شود. سامانه ابتدا `/api/v1/auth/session` را بررسی کرده و کاربران واردنشده را به `/login` هدایت می‌کند. در مواردی که تغییر رمز اولیه الزامی است، دسترسی به بخش‌های محافظت‌شده تا زمان تغییر رمز محدود می‌شود. **Username کارکنان همان کد پرسنلی است.**

مجوزها در Backend بررسی می‌شوند. Super Admin به مدیریت کامل سامانه دسترسی دارد؛ نقش `hrFood` مجوزهای مشخصی برای مدیریت کارکنان دارد. سایر دسترسی‌ها، از جمله گزارش‌ها، تابع Permissionهای Django و سیاست‌های Endpointها هستند.

| Endpoint | کاربرد |
|---|---|
| `GET /api/v1/config` | دریافت عمومی و فقط‌خواندنی تنظیمات Branding |
| `GET /api/v1/auth/session` | بررسی نشست جاری |
| `GET /api/v1/reservations` | تاریخچه رزرو کاربر |
| `GET /api/v1/reservations/weekly?start=YYYY-MM-DD` | نمای هفتگی رزرو |
| `GET /api/v1/reports/daily?from=YYYY-MM-DD&to=YYYY-MM-DD` | گزارش روزانه برای کاربران مجاز |
| `GET /api/v1/reports/daily/export?from=YYYY-MM-DD&to=YYYY-MM-DD` | خروجی Excel گزارش روزانه با نمایش تاریخ شمسی، با رعایت مجوزها |

برای فهرست کامل و دقیق Endpointها به OpenAPI Schema مراجعه کنید.

## واردکردن اطلاعات از Excel

فایل‌های نمونه در `backend/sample_data/` هستند. دستورات زیر در کانتینر **Backend** اجرا می‌شوند و مسیرها نسبت به `/app` هستند:

```bash
docker compose exec -T backend python manage.py import_employees sample_data/sample_employees.xlsx --dry-run
docker compose exec -T backend python manage.py import_catalog sample_data/sample_catalog.xlsx --dry-run
docker compose exec -T backend python manage.py import_monthly_menu sample_data/sample_monthly_menu.xlsx --dry-run
```

فقط بعد از بررسی نتیجه اعتبارسنجی، `--dry-run` را حذف کنید. بر اساس مستندات فعلی، Importها Atomic هستند و تعارض‌ها را پیش از درج بررسی می‌کنند. قیمت‌های Catalog و Menu در این فرایند **اعداد صحیح به تومان** هستند؛ فیلدهایی مانند `price_toman` را نباید با قیمت ریالی فایل‌های دیگر اشتباه گرفت.

فایل کارکنان شامل کد پرسنلی، شماره ساختمان، شماره دپارتمان و وضعیت فعال‌بودن است؛ نام کارکنان در این فرایند Import نمی‌شود. رمز اولیه کارکنان واردشده برابر کد پرسنلی است و باید در اولین ورود تغییر کند.

فایل منوی ماهانه سه Sheet به نام‌های `Foods`، `Sides` و `Drinks` دارد. در `Foods` ستون‌های `date`، `name`، `price_toman`، `container_price_toman` و `special_container_price_toman` استفاده می‌شوند. تاریخ می‌تواند Excel Date یا `YYYY-MM-DD` باشد و نام غذا باید از پیش در Catalog وجود داشته باشد. قیمت منو برابر قیمت غذا به‌علاوه بزرگ‌ترین مقدار از دو قیمت ظرف است. Sheetهای `Sides` و `Drinks` دارای `name` و `price_toman` هستند.

تاریخ‌های تکراری در فایل پذیرفته نمی‌شوند. Import مجدد اطلاعات یکسان، رکوردهای موجود را تغییر نمی‌دهد؛ تغییر غذا یا قیمت برای تاریخ موجود رد می‌شود تا تاریخچه منو بازنویسی نشود. نام‌های موجود Catalog با قیمت متفاوت نیز طبق منطق Import مستندشده رد می‌شوند.

## مدیریت Branding

نام پیش‌فرض: **فودسک / Foodesk**؛ توضیحات: **سامانه رزرو غذای سازمانی**.

مدل Singleton با نام `core.SiteSettings` در PostgreSQL فیلدهای `site_name`، `site_name_en`، `site_description`، `logo` و `favicon` را نگهداری می‌کند. فقط **Super Admin فعال** می‌تواند از پنل Django Unfold این رکورد را مدیریت کند. Endpoint عمومی `GET /api/v1/config` اطلاعات Branding و در صورت آپلود، URL تصاویر را به React ارائه می‌دهد.

فرمت‌های مجاز تصویر PNG، JPEG و WebP با اعتبارسنجی Backend هستند (حداکثر ۲ MiB و ۴ میلیون پیکسل)؛ آپلود SVG مجاز نیست. تا زمان آپلود تصویر، آیکون پیش‌فرض نمایش داده می‌شود. عنوان، سربرگ و تصاویر Unfold هم به تنظیمات دیتابیس وصل‌اند و برای Favicon پیش‌فرض استاتیک وجود دارد.

**محدودیت PWA:** نام و آیکون در Manifest فعلی استاتیک هستند؛ تغییر Branding از Admin لزوماً نام PWA نصب‌شده قبلی را تغییر نمی‌دهد.

## متغیرهای محیطی و Secrets

فایل `.env.example` نمونه تنظیمات غیرحساس توسعه مانند `DJANGO_SETTINGS_MODULE`، `DJANGO_DEBUG`، `DJANGO_ALLOWED_HOSTS`، `DJANGO_CSRF_TRUSTED_ORIGINS`، `POSTGRES_DB` و `POSTGRES_USER` را نگهداری می‌کند.

تنظیم مهلت رزرو:

```dotenv
DOCKER_COMPOSE_RESERVATION_CUTOFF_HOUR=10
```

Docker Compose این متغیر را به `RESERVATION_CUTOFF_HOUR` داخل Backend تبدیل می‌کند. مقدار باید عدد صحیح بین **۰ تا ۲۳** باشد. مهلت رزرو در ساعت تعیین‌شده **روز قبل از تاریخ منو** و با منطقه زمانی `Asia/Tehran` پایان می‌یابد. برای اعمال تغییر ENV، کانتینر Backend باید با تنظیمات جدید بازایجاد شود.

Compose فایل‌های `secrets/django_secret_key.txt` و `secrets/postgres_password.txt` را در مسیر `/run/secrets` کانتینرهای مرتبط Mount می‌کند. این فایل‌ها باید محافظت و از Git خارج شوند. Docker Secrets در این تنظیمات به معنی رمزگذاری فایل منبع روی دیسک نیست.

## تست و کیفیت کد

```bash
# Backend
docker compose exec -T backend python manage.py check
docker compose exec -T backend python manage.py test
docker compose exec -T backend ruff check .
docker compose exec -T backend python manage.py makemigrations --check --dry-run

# Frontend
docker compose exec -T frontend pnpm typecheck
docker compose exec -T frontend pnpm lint
docker compose exec -T frontend pnpm test:run
```

تست‌های Backend با **Django Test Runner** اجرا می‌شوند، نه pytest.

## فضای ذخیره‌سازی و ملاحظات Production

- داده‌های PostgreSQL در Volume `postgres_data` ذخیره می‌شوند و دیتابیس روی شبکه داخلی `food_reservation_internal` است.
- Frontend و Backend به شبکه خارجی `shared_net` متصل‌اند؛ PostgreSQL روی این شبکه در دسترس نیست.
- فایل‌های آپلودی در `food_media`، متصل به `/opt/food/media` میزبان، ذخیره می‌شوند؛ `MEDIA_URL=/media/` و `MEDIA_ROOT=/app/media` است.
- فایل‌های Static جنگو در چیدمان فعلی کانتینر با `STATIC_ROOT=/app/staticfiles` تعریف شده‌اند. برای Production باید ارائه Static و Media جداگانه پیکربندی شود؛ صرف تعریف مسیرها کافی نیست.
- Compose فعلی از سرورهای توسعه Vite و Django و تنظیمات مرتبط با Debug استفاده می‌کند. **این Compose را بدون آماده‌سازی در Production استفاده نکنید.** پیش از بهره‌برداری HTTPS، `DEBUG=False`، امنیت Cookie و CSRF، میزبان‌های مجاز، مدیریت Secrets، Backup، لاگ عملیاتی و فایل‌رسانی Static/Media را بررسی کنید.
