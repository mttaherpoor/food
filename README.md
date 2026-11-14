# Foodesk | فودسک

**Organizational Food Reservation System** — a Persian, RTL web application for employee meal reservations.

**Language:** English | [فارسی](README-fa.md)

## Technology stack

- **Backend:** Python 3.13, Django 6.1, Django REST Framework, Django Unfold, drf-spectacular
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, Axios, pnpm; responsive RTL PWA
- **Database:** PostgreSQL 17
- **Local infrastructure:** Docker Compose, Docker secrets, persistent volumes
- **Calendar:** Jalali-facing date inputs and Excel reporting; API query dates use `YYYY-MM-DD` where specified

## Local development

The supplied `docker-compose.yml` targets **development**, not production. The frontend uses the **Vite development server**, not Nginx, and Django runs with `runserver`.

1. Create local `secrets/django_secret_key.txt` and `secrets/postgres_password.txt` from their respective `.example.txt` files, using strong secret values. Do not commit the actual files.
2. Optionally copy `.env.example` to `.env` and review its settings.
3. Ensure that the external Docker network `shared_net` exists (`docker network create shared_net` if necessary).
4. Ensure `/opt/food/media` exists on the Docker host. The `food_media` volume uses this **absolute bind-mount path**, so adapt the Compose file when deploying from another host path.
5. Start the services, then apply migrations explicitly:

```bash
docker compose up --build -d
docker compose exec -T backend python manage.py migrate
```

| Service | Development URL |
|---|---|
| Web application | `http://localhost:5173` |
| Backend | `http://localhost:8000` |
| Health | `http://localhost:8000/api/v1/health` |
| OpenAPI schema | `http://localhost:8000/api/v1/schema` |
| API documentation | `http://localhost:8000/api/v1/docs` |

Vite proxies `/api` requests to Django in development. Database migrations do **not** run automatically as part of the image build.

## Authentication, roles and API

Authentication uses Django sessions and CSRF protection. The application checks `/api/v1/auth/session`, redirects anonymous users to `/login`, and requires applicable users to change their initial password before using protected features. The employee username is the **personnel number**.

Roles and permissions are enforced server-side. Super Admin has full administrative access; `hrFood` has delegated employee-management capabilities. Other permissions, including reporting access, depend on the configured Django permissions and endpoint policies.

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/config` | Public, read-only site branding |
| `GET /api/v1/auth/session` | Current session status |
| `GET /api/v1/reservations` | User reservation history |
| `GET /api/v1/reservations/weekly?start=YYYY-MM-DD` | Weekly reservation view |
| `GET /api/v1/reports/daily?from=YYYY-MM-DD&to=YYYY-MM-DD` | Daily report for authorized users |
| `GET /api/v1/reports/daily/export?from=YYYY-MM-DD&to=YYYY-MM-DD` | Daily Excel report with Jalali-formatted dates, subject to permissions |

Consult the OpenAPI schema for the complete, current API contract.

## Excel imports

Sample workbooks are located in `backend/sample_data/`. Run commands in the **backend container**; paths below are relative to `/app`:

```bash
docker compose exec -T backend python manage.py import_employees sample_data/sample_employees.xlsx --dry-run
docker compose exec -T backend python manage.py import_catalog sample_data/sample_catalog.xlsx --dry-run
docker compose exec -T backend python manage.py import_monthly_menu sample_data/sample_monthly_menu.xlsx --dry-run
```

Remove `--dry-run` only after checking validation results. The documented import workflow is atomic and validates duplicates/conflicts before writing. Catalog and menu prices are **whole amounts in Toman**, using fields such as `price_toman` (do not confuse them with rial values in other source documents).

The employee workbook includes personnel number, building number, department number, and active status; employee names are not imported by this workflow. Initially, imported employee passwords match the personnel number and must be changed at first login.

The monthly menu workbook contains the `Foods`, `Sides`, and `Drinks` sheets. `Foods` uses `date`, `name`, `price_toman`, `container_price_toman`, and `special_container_price_toman`. Dates can be Excel dates or `YYYY-MM-DD`, and food names must already exist in the catalog. The menu price includes the food price plus the larger of the two container prices. `Sides` and `Drinks` use `name` and `price_toman`.

Duplicate menu dates are rejected. Identical reimports leave existing records unchanged; conflicting food or pricing for an existing date is rejected rather than overwriting historical data. Existing catalog names with changed prices are also rejected by the documented import workflow.

## Site branding

Default branding: **فودسک / Foodesk**, description **سامانه رزرو غذای سازمانی**.

A single `core.SiteSettings` PostgreSQL record stores `site_name`, `site_name_en`, `site_description`, `logo`, and `favicon`. Only active **Super Admin** users can manage this record through Django Unfold. The public `GET /api/v1/config` endpoint supplies branding to React, including media URLs when assets are uploaded.

Brand images accept PNG, JPEG, or WebP with server-side checks (up to 2 MiB and 4 million pixels); SVG uploads are disallowed. If no image is configured, the interface displays a default icon. Django Unfold also uses database-backed title, header and image callbacks, plus a static fallback favicon.

**PWA limitation:** the current web manifest stores its app name and icon statically; changing the admin branding does not necessarily rename an already-installed PWA.

## Environment and secrets

The `.env.example` file supplies non-secret local configuration such as `DJANGO_SETTINGS_MODULE`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`, `POSTGRES_DB`, and `POSTGRES_USER`.

Reservation cutoff configuration:

```dotenv
DOCKER_COMPOSE_RESERVATION_CUTOFF_HOUR=10
```

Compose maps this variable to the backend's `RESERVATION_CUTOFF_HOUR`. It must be an integer from **0 through 23**. Reservations close at the configured hour on the **day before** the menu date in the `Asia/Tehran` time zone. Recreate the backend container after changing its environment.

Compose mounts `secrets/django_secret_key.txt` and `secrets/postgres_password.txt` under `/run/secrets` in relevant containers. These files must be protected and excluded from Git. Docker Compose secrets do **not** encrypt their source files at rest.

## Quality checks

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

Backend tests use the **Django test runner**, not pytest.

## Storage and production considerations

- PostgreSQL data persists in `postgres_data` on the internal `food_reservation_internal` network.
- The frontend and backend attach to the external `shared_net`; PostgreSQL is not exposed through that network.
- Uploaded media persists in `food_media`, bound to `/opt/food/media` on the host; the backend uses `MEDIA_URL=/media/` and `MEDIA_ROOT=/app/media`.
- Django static files use `STATIC_ROOT=/app/staticfiles` in the current container layout. Production needs a proper static-file and media-serving setup; merely defining these paths does not make them publicly accessible.
- The supplied Compose runs Vite and Django development servers with a debug-oriented configuration. **Do not deploy it unchanged to production.** Review HTTPS, `DEBUG=False`, secure cookies and CSRF settings, allowed hosts, secret management, backups, operational logging, and static/media serving before deployment.
