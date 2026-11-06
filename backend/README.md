# Food Reservation Backend

Django REST Framework API for the food reservation system.

## Local Docker development

1. Copy each `secrets/*.example.txt` file to its corresponding `*.txt` file
   and replace the placeholder with a strong local value.
2. Optionally copy `.env.example` to `.env` for non-sensitive configuration.
3. Start the services with `docker compose up --build` from the repository root.
4. Open `/api/v1/health`, `/api/v1/schema`, or `/api/v1/docs` on port 8000.

Database migrations are intentionally not applied automatically by the image.
Run them only as an explicit reviewed operation.

## Excel sample data

Catalog prices are whole amounts in Toman.

Validate the sample workbooks without changing the database:

```bash
python manage.py import_employees sample_data/sample_employees.xlsx --dry-run
python manage.py import_catalog sample_data/sample_catalog.xlsx --dry-run
```

Remove `--dry-run` to import the records. Imports are create-only and atomic: an
invalid or existing personnel number/name prevents the entire workbook from being
written. Employee passwords initially equal their personnel numbers and must be
changed at first sign-in.

