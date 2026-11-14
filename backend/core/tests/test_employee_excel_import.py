from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from io import StringIO
from pathlib import Path
import tempfile

from openpyxl import Workbook

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


class EmployeeExcelImportTests(TestCase):
    @classmethod
    def setUpTestData(cls):
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

    def setUp(self):
        self._temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self._temp_dir.cleanup)
        self.tmp_path = Path(self._temp_dir.name)

    def test_import_employees_creates_accounts_with_initial_password(self):
        path = self.tmp_path / 'employees.xlsx'
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

    def test_import_employees_dry_run_does_not_write(self):
        path = self.tmp_path / 'employees.xlsx'
        _save_employee_workbook(path, [['001001', '01', '100', True]])

        call_command('import_employees', path, dry_run=True, stdout=StringIO())

        assert not CustomUser.objects.exists()

    def test_import_employees_rejects_duplicate_rows_atomically(self):
        path = self.tmp_path / 'employees.xlsx'
        _save_employee_workbook(
            path,
            [
                ['001001', '01', '100', True],
                ['001001', '02', '200', True],
            ],
        )

        with self.assertRaisesRegex(CommandError, 'duplicate personnel_number'):
            call_command('import_employees', path, stdout=StringIO(), stderr=StringIO())

        assert not CustomUser.objects.exists()
