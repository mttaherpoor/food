from django.core.exceptions import ValidationError
from django.db import models, transaction

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from openpyxl import load_workbook
from openpyxl.cell.cell import Cell

from food.models import Drink, Food, Side

CATALOG_SHEETS: dict[str, tuple[type[models.Model], tuple[str, ...]]] = {
    'Foods': (Food, ('name', 'price_toman', 'container_price_toman')),
    'Sides': (Side, ('name', 'price_toman')),
    'Drinks': (Drink, ('name', 'price_toman')),
}


@dataclass(frozen=True)
class CatalogImportRow:
    sheet_name: str
    row_number: int
    model: type[models.Model]
    values: dict[str, Any]


class WorkbookValidationError(Exception):
    def __init__(self, errors: list[str]) -> None:
        self.errors = errors
        super().__init__('\n'.join(errors))


def _open_workbook(path: Path):
    if path.suffix.lower() != '.xlsx':
        raise WorkbookValidationError(['Only .xlsx files are supported.'])
    if not path.is_file():
        raise WorkbookValidationError([f'File does not exist: {path}'])
    try:
        return load_workbook(path, read_only=True, data_only=False)
    except (OSError, ValueError) as exc:
        raise WorkbookValidationError([f'Could not read workbook: {exc}']) from exc


def _cell_text(cell: Cell, *, required: bool = False) -> str:
    if cell.data_type == 'f':
        raise ValueError('formulas are not allowed')
    value = '' if cell.value is None else str(cell.value).strip()
    if required and not value:
        raise ValueError('value is required')
    return value


def _cell_toman(cell: Cell) -> int:
    if cell.data_type == 'f':
        raise ValueError('formulas are not allowed')
    value = cell.value
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError('price must be a whole number in Toman')
    if isinstance(value, float) and not value.is_integer():
        raise ValueError('price must be a whole number in Toman')
    amount = int(value)
    if amount < 0:
        raise ValueError('price cannot be negative')
    return amount


def _model_values(sheet_name: str, cells: tuple[Cell, ...]) -> dict[str, Any]:
    if sheet_name == 'Foods':
        return {
            'name': _cell_text(cells[0], required=True),
            'price': _cell_toman(cells[1]),
            'container_price': _cell_toman(cells[2]),
        }
    return {
        'name': _cell_text(cells[0], required=True),
        'price': _cell_toman(cells[1]),
    }


def _validation_messages(exc: ValidationError) -> str:
    if hasattr(exc, 'message_dict'):
        return '; '.join(f'{field}: {", ".join(messages)}' for field, messages in exc.message_dict.items())
    return '; '.join(exc.messages)


def read_catalog_rows(path: Path) -> list[CatalogImportRow]:
    workbook = _open_workbook(path)
    errors: list[str] = []
    rows: list[CatalogImportRow] = []
    try:
        for sheet_name, (model, expected_headers) in CATALOG_SHEETS.items():
            if sheet_name not in workbook.sheetnames:
                errors.append(f'Missing required sheet: {sheet_name}')
                continue
            sheet = workbook[sheet_name]
            header_values = tuple(_cell_text(cell) for cell in next(sheet.iter_rows(min_row=1, max_row=1)))
            if header_values != expected_headers:
                errors.append(f'{sheet_name}!1: expected headers {", ".join(expected_headers)}')
                continue

            seen_names: set[str] = set()
            sheet_row_count = 0
            for cells in sheet.iter_rows(min_row=2, max_col=len(expected_headers)):
                if all(cell.value is None for cell in cells):
                    continue
                row_number = cells[0].row
                try:
                    values = _model_values(sheet_name, cells)
                    name = values['name']
                    if name in seen_names:
                        raise ValueError(f'duplicate name: {name}')
                    if model.objects.filter(name=name).exists():
                        raise ValueError(f'name already exists: {name}')
                    instance = model(**values)
                    instance.full_clean()
                    seen_names.add(name)
                    rows.append(
                        CatalogImportRow(
                            sheet_name=sheet_name,
                            row_number=row_number,
                            model=model,
                            values=values,
                        )
                    )
                    sheet_row_count += 1
                except (TypeError, ValueError, ValidationError) as exc:
                    message = _validation_messages(exc) if isinstance(exc, ValidationError) else str(exc)
                    errors.append(f'{sheet_name}!{row_number}: {message}')
            if sheet_row_count == 0:
                errors.append(f'{sheet_name}: no data rows found')

        if errors:
            raise WorkbookValidationError(errors)
        return rows
    finally:
        workbook.close()


@transaction.atomic
def import_catalog(path: Path, *, dry_run: bool = False) -> dict[str, int]:
    rows = read_catalog_rows(path)
    counts = dict.fromkeys(CATALOG_SHEETS, 0)
    if dry_run:
        for row in rows:
            counts[row.sheet_name] += 1
        return counts

    for row in rows:
        row.model.objects.create(**row.values)
        counts[row.sheet_name] += 1
    return counts
