# Food Reservation Backend

Django REST Framework API for the food reservation system.

## Local Docker development

1. Copy each `secrets/*.example.txt` file to its corresponding `*.txt` file
   and replace the placeholder with a strong local value.
2. Optionally copy `.env.example` to `.env` for non-sensitive configuration.
3. Start the services with `docker compose up --build` from the repository root.
4. Open `/api/health/`, `/api/schema/`, or `/api/docs/` on port 8000.

Database migrations are intentionally not applied automatically by the image.
Run them only as an explicit reviewed operation.

