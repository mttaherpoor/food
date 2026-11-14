from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from io import StringIO
from pathlib import Path
import tempfile

from openpyxl import Workbook

from food.models import Drink, Food, Side


def _save_catalog_workbook(path, *, foods, sides, drinks):
    workbook = Workbook()
    workbook.remove(workbook.active)
    for sheet_name, headers, rows in (
        ('Foods', ['name', 'price_toman', 'container_price_toman'], foods),
        ('Sides', ['name', 'price_toman'], sides),
        ('Drinks', ['name', 'price_toman'], drinks),
    ):
        sheet = workbook.create_sheet(sheet_name)
        sheet.append(headers)
        for row in rows:
            sheet.append(row)
    workbook.save(path)


class CatalogExcelImportTests(TestCase):
    def setUp(self):
        self._temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self._temp_dir.cleanup)
        self.tmp_path = Path(self._temp_dir.name)

    def test_import_catalog_creates_toman_prices(self):
        path = self.tmp_path / 'catalog.xlsx'
        _save_catalog_workbook(
            path,
            foods=[['Ghormeh sabzi', 120_000, 10_000]],
            sides=[['Shirazi salad', 25_000]],
            drinks=[['Doogh', 15_000]],
        )

        call_command('import_catalog', path, stdout=StringIO())

        food = Food.objects.get(name='Ghormeh sabzi')
        assert food.price == 120_000
        assert food.container_price == 10_000
        assert food.total_price == 130_000
        assert Side.objects.filter(name='Shirazi salad', price=25_000).exists()
        assert Drink.objects.filter(name='Doogh', price=15_000).exists()

    def test_import_catalog_dry_run_does_not_write(self):
        path = self.tmp_path / 'catalog.xlsx'
        _save_catalog_workbook(
            path,
            foods=[['Ghormeh sabzi', 120_000, 10_000]],
            sides=[['Shirazi salad', 25_000]],
            drinks=[['Doogh', 15_000]],
        )

        call_command('import_catalog', path, dry_run=True, stdout=StringIO())

        assert not Food.objects.exists()
        assert not Side.objects.exists()
        assert not Drink.objects.exists()

    def test_import_catalog_rejects_invalid_price_atomically(self):
        path = self.tmp_path / 'catalog.xlsx'
        _save_catalog_workbook(
            path,
            foods=[['Ghormeh sabzi', 120_000, 10_000]],
            sides=[['Shirazi salad', '25000 Toman']],
            drinks=[['Doogh', 15_000]],
        )

        with self.assertRaisesRegex(CommandError, 'price must be a whole number in Toman'):
            call_command('import_catalog', path, stdout=StringIO(), stderr=StringIO())

        assert not Food.objects.exists()
        assert not Side.objects.exists()
        assert not Drink.objects.exists()
