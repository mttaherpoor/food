from django.core.exceptions import ValidationError
from django.db import transaction

from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.cell.cell import Cell

from food.models import Drink, Food, Menu, Side

MENU_SHEET = 'Foods'
MENU_HEADERS = ('date', 'name', 'price_toman', 'container_price_toman', 'special_container_price_toman')
CATALOG_SHEETS = {
    'Sides': (Side, ('name', 'price_toman')),
    'Drinks': (Drink, ('name', 'price_toman')),
}


class MenuWorkbookValidationError(Exception):
    def __init__(self, errors: list[str]) -> None:
        self.errors = errors
        super().__init__('\n'.join(errors))


@dataclass(frozen=True)
class MenuImportRow:
    row_number: int
    menu_date: date
    food: Food
    food_price: int
    is_existing: bool


def _cell_text(cell: Cell, *, required: bool = False) -> str:
    if cell.data_type == 'f':
        raise ValueError('formulas are not allowed')
    value = '' if cell.value is None else str(cell.value).strip()
    if required and not value:
        raise ValueError('value is required')
    return value


def _cell_date(cell: Cell) -> date:
    if cell.data_type == 'f':
        raise ValueError('formulas are not allowed')
    if isinstance(cell.value, datetime):
        return cell.value.date()
    if isinstance(cell.value, date):
        return cell.value
    if isinstance(cell.value, str):
        try:
            return date.fromisoformat(cell.value.strip())
        except ValueError as exc:
            raise ValueError('date must be an Excel date or YYYY-MM-DD') from exc
    raise ValueError('date must be an Excel date or YYYY-MM-DD')


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


def _optional_toman(cell: Cell) -> int:
    return 0 if cell.value is None or cell.value == '' else _cell_toman(cell)


def read_menu_rows(path: Path) -> list[MenuImportRow]:
    if path.suffix.lower() != '.xlsx':
        raise MenuWorkbookValidationError(['Only .xlsx files are supported.'])
    if not path.is_file():
        raise MenuWorkbookValidationError([f'File does not exist: {path}'])
    try:
        workbook = load_workbook(path, read_only=True, data_only=False)
    except (OSError, ValueError) as exc:
        raise MenuWorkbookValidationError([f'Could not read workbook: {exc}']) from exc

    errors: list[str] = []
    rows: list[MenuImportRow] = []
    try:
        expected_sheets = {MENU_SHEET, *CATALOG_SHEETS}
        unexpected_sheets = set(workbook.sheetnames) - expected_sheets
        if unexpected_sheets:
            errors.append(f'Unexpected sheets: {", ".join(sorted(unexpected_sheets))}')
        if MENU_SHEET not in workbook.sheetnames:
            raise MenuWorkbookValidationError([f'Missing required sheet: {MENU_SHEET}'])
        for sheet_name, (_, expected_headers) in CATALOG_SHEETS.items():
            if sheet_name not in workbook.sheetnames:
                errors.append(f'Missing required sheet: {sheet_name}')
                continue
            catalog_headers = tuple(
                _cell_text(cell) for cell in next(workbook[sheet_name].iter_rows(min_row=1, max_row=1))
            )
            if catalog_headers != expected_headers:
                errors.append(f'{sheet_name}!1: expected headers {", ".join(expected_headers)}')
        sheet = workbook[MENU_SHEET]
        headers = tuple(
            _cell_text(cell) for cell in next(sheet.iter_rows(min_row=1, max_row=1, max_col=len(MENU_HEADERS)))
        )
        if headers != MENU_HEADERS:
            errors.append(f'{MENU_SHEET}!1: expected headers {", ".join(MENU_HEADERS)}')

        seen_dates: set[date] = set()
        for cells in sheet.iter_rows(min_row=2, max_col=len(MENU_HEADERS)):
            if all(cell.value is None for cell in cells):
                continue
            row_number = cells[0].row
            try:
                menu_date = _cell_date(cells[0])
                food_name = _cell_text(cells[1], required=True)
                meal_price = _cell_toman(cells[2])
                container_prices = (_cell_toman(cells[3]), _optional_toman(cells[4]))
                food_price = meal_price + max(container_prices)
                if menu_date in seen_dates:
                    raise ValueError(f'duplicate menu date: {menu_date.isoformat()}')
                seen_dates.add(menu_date)
                try:
                    food = Food.objects.get(name=food_name)
                except Food.DoesNotExist as exc:
                    raise ValueError(f'food does not exist in catalog: {food_name}') from exc
                existing = Menu.objects.filter(date=menu_date).select_related('food').first()
                if existing and (existing.food_id != food.pk or existing.food_price != food_price):
                    raise ValueError('a menu for this date already exists with different food or price')
                rows.append(MenuImportRow(row_number, menu_date, food, food_price, existing is not None))
            except (TypeError, ValueError, ValidationError) as exc:
                errors.append(f'{MENU_SHEET}!{row_number}: {exc}')
        for sheet_name, (model, expected_headers) in CATALOG_SHEETS.items():
            if sheet_name not in workbook.sheetnames:
                continue
            catalog_sheet = workbook[sheet_name]
            seen_names: set[str] = set()
            for cells in catalog_sheet.iter_rows(min_row=2, max_col=len(expected_headers)):
                if all(cell.value is None for cell in cells):
                    continue
                row_number = cells[0].row
                try:
                    name = _cell_text(cells[0], required=True)
                    price = _cell_toman(cells[1])
                    if name in seen_names:
                        raise ValueError(f'duplicate name: {name}')
                    seen_names.add(name)
                    existing_item = model.objects.filter(name=name).first()
                    if existing_item and existing_item.price != price:
                        raise ValueError(f'{name} already exists with a different price')
                except (TypeError, ValueError) as exc:
                    errors.append(f'{sheet_name}!{row_number}: {exc}')
        if not rows:
            errors.append(f'{MENU_SHEET}: no data rows found')
        if errors:
            raise MenuWorkbookValidationError(errors)
        return rows
    finally:
        workbook.close()


@transaction.atomic
def import_monthly_menu(path: Path, *, dry_run: bool = False) -> dict[str, int]:
    rows = read_menu_rows(path)
    counts = {'menus_created': 0, 'menus_unchanged': 0, 'sides': 0, 'drinks': 0}
    for row in rows:
        if row.is_existing:
            counts['menus_unchanged'] += 1
            continue
        if not dry_run:
            Menu.objects.create(date=row.menu_date, food=row.food, food_price=row.food_price)
        counts['menus_created'] += 1
    workbook = load_workbook(path, read_only=True, data_only=False)
    try:
        for sheet_name, (model, _) in CATALOG_SHEETS.items():
            sheet = workbook[sheet_name]
            for cells in sheet.iter_rows(min_row=2, max_col=2):
                if all(cell.value is None for cell in cells):
                    continue
                name = _cell_text(cells[0], required=True)
                price = _cell_toman(cells[1])
                if not model.objects.filter(name=name).exists():
                    if not dry_run:
                        model.objects.create(name=name, price=price)
                    counts[sheet_name.lower()] += 1
    finally:
        workbook.close()
    return counts
