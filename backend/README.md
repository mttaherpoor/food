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

