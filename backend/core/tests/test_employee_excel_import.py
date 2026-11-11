from django.core.management import call_command
from django.core.management.base import CommandError

from io import StringIO

from openpyxl import Workbook
import pytest

from core.models import Building, CustomUser, Department


def _save_employee_workbook(path, rows):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = 'Employees'
    sheet.append(
        [
            'personnel_number',
            'building_number',
            'department_number',
            'is_active',
        ]
    )
    for row in rows:
        sheet.append(row)
    workbook.save(path)



@pytest.fixture(autouse=True)
def employee_reference_data(db):
    for number in ('01', '02'):
        Building.objects.get_or_create(
            number=number,
            defaults={'is_active': True},
        )

    for number in ('100', '200'):
        Department.objects.get_or_create(
            number=number,
            defaults={'is_active': True},
        )


@pytest.mark.django_db
def test_import_employees_creates_accounts_with_initial_password(tmp_path):
    path = tmp_path / 'employees.xlsx'
    _save_employee_workbook(
        path,
        [
            ['001001', '01', '100', True],
            ['001002', '02', '200', False],
        ],
    )

    call_command('import_employees', path, stdout=StringIO())

    ali = CustomUser.objects.get(username='001001')
    sara = CustomUser.objects.get(username='001002')
    assert ali.check_password('001001')
    assert ali.must_change_password is True
    assert ali.profile.building.number == '01'
    assert ali.first_name == ''
    assert ali.last_name == ''
    assert sara.is_active is False


@pytest.mark.django_db
def test_import_employees_dry_run_does_not_write(tmp_path):
    path = tmp_path / 'employees.xlsx'
    _save_employee_workbook(path, [['001001', '01', '100', True]])

    call_command('import_employees', path, dry_run=True, stdout=StringIO())

    assert not CustomUser.objects.exists()


@pytest.mark.django_db
def test_import_employees_rejects_duplicate_rows_atomically(tmp_path):
    path = tmp_path / 'employees.xlsx'
    _save_employee_workbook(
        path,
        [
            ['001001', '01', '100', True],
            ['001001', '02', '200', True],
        ],
    )

    with pytest.raises(CommandError, match='duplicate personnel_number'):
        call_command('import_employees', path, stdout=StringIO(), stderr=StringIO())

    assert not CustomUser.objects.exists()
