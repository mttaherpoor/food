from django.core.exceptions import ValidationError
from django.db import transaction

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from openpyxl import load_workbook
from openpyxl.cell.cell import Cell

from core.models import CustomUser
from core.services import create_employee

EMPLOYEE_SHEET = 'Employees'
EMPLOYEE_HEADERS = (
    'personnel_number',
    'first_name',
    'last_name',
    'building_number',
    'department_number',
    'is_active',
)


@dataclass(frozen=True)
class EmployeeImportRow:
    row_number: int
    personnel_number: str
    first_name: str
    last_name: str
    building_number: str
    department_number: str
    is_active: bool


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
    value: Any = cell.value
    if value is None:
        text = ''
    elif isinstance(value, bool):
        text = str(value)
    elif isinstance(value, float) and value.is_integer():
        text = str(int(value))
    else:
        text = str(value).strip()
    if required and not text:
        raise ValueError('value is required')
    return text


def _cell_boolean(cell: Cell) -> bool:
    if cell.data_type == 'f':
        raise ValueError('formulas are not allowed')
    value = cell.value
    if isinstance(value, bool):
        return value
    if isinstance(value, int) and value in {0, 1}:
        return bool(value)
    normalized = str(value).strip().lower()
    if normalized in {'true', 'yes', '1', 'active'}:
        return True
    if normalized in {'false', 'no', '0', 'inactive'}:
        return False
    raise ValueError('use TRUE or FALSE')


def _validation_messages(exc: ValidationError) -> str:
    if hasattr(exc, 'message_dict'):
        return '; '.join(f'{field}: {", ".join(messages)}' for field, messages in exc.message_dict.items())
    return '; '.join(exc.messages)


def read_employee_rows(path: Path) -> list[EmployeeImportRow]:
    workbook = _open_workbook(path)
    errors: list[str] = []
    try:
        if EMPLOYEE_SHEET not in workbook.sheetnames:
            raise WorkbookValidationError([f'Missing required sheet: {EMPLOYEE_SHEET}'])
        sheet = workbook[EMPLOYEE_SHEET]
        header_values = tuple(_cell_text(cell) for cell in next(sheet.iter_rows(min_row=1, max_row=1)))
        if header_values != EMPLOYEE_HEADERS:
            raise WorkbookValidationError([f'{EMPLOYEE_SHEET}!1: expected headers {", ".join(EMPLOYEE_HEADERS)}'])

        rows: list[EmployeeImportRow] = []
        seen_personnel_numbers: set[str] = set()
        for cells in sheet.iter_rows(min_row=2, max_col=len(EMPLOYEE_HEADERS)):
            if all(cell.value is None for cell in cells):
                continue
            row_number = cells[0].row
            try:
                personnel_number = _cell_text(cells[0], required=True)
                row = EmployeeImportRow(
                    row_number=row_number,
                    personnel_number=personnel_number,
                    first_name=_cell_text(cells[1]),
                    last_name=_cell_text(cells[2]),
                    building_number=_cell_text(cells[3], required=True),
                    department_number=_cell_text(cells[4], required=True),
                    is_active=_cell_boolean(cells[5]),
                )
                if personnel_number in seen_personnel_numbers:
                    raise ValueError(f'duplicate personnel_number: {personnel_number}')
                if CustomUser.objects.filter(username=personnel_number).exists():
                    raise ValueError(f'personnel_number already exists: {personnel_number}')
                seen_personnel_numbers.add(personnel_number)
                rows.append(row)
            except (TypeError, ValueError) as exc:
                errors.append(f'{EMPLOYEE_SHEET}!{row_number}: {exc}')

        if not rows and not errors:
            errors.append(f'{EMPLOYEE_SHEET}: no data rows found')
        if errors:
            raise WorkbookValidationError(errors)
        return rows
    finally:
        workbook.close()


@transaction.atomic
def import_employees(path: Path, *, dry_run: bool = False) -> int:
    rows = read_employee_rows(path)
    if dry_run:
        return len(rows)

    errors: list[str] = []
    for row in rows:
        try:
            create_employee(
                personnel_number=row.personnel_number,
                first_name=row.first_name,
                last_name=row.last_name,
                building_number=row.building_number,
                department_number=row.department_number,
                is_active=row.is_active,
            )
        except ValidationError as exc:
            errors.append(f'{EMPLOYEE_SHEET}!{row.row_number}: {_validation_messages(exc)}')
    if errors:
        raise WorkbookValidationError(errors)
    return len(rows)
