from django.core.management import call_command
from django.core.management.base import CommandError

from datetime import date

from openpyxl import Workbook
import pytest

from food.models import Food, Menu


def _save_menu_workbook(path, *, rows):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = 'Menus'
    sheet.append(['date', 'food', 'food_price_toman'])
    for row in rows:
        sheet.append(row)
    workbook.save(path)


@pytest.mark.django_db
def test_import_monthly_menu_snapshots_monthly_price_and_dry_run_is_read_only(tmp_path):
    path = tmp_path / 'monthly-menu.xlsx'
    _save_menu_workbook(path, rows=[['2099-01-02', 'Ghormeh sabzi', 1_200_000]])
    Food.objects.create(name='Ghormeh sabzi', price=1_000_000, container_price=100_000)

    call_command('import_monthly_menu', path, dry_run=True)
    assert Menu.objects.count() == 0

    call_command('import_monthly_menu', path)
    menu = Menu.objects.get()
    assert menu.date == date(2099, 1, 2)
    assert menu.food_price == 1_200_000


@pytest.mark.django_db
def test_monthly_import_is_idempotent_and_keeps_prior_menu_dates(tmp_path):
    path = tmp_path / 'monthly-menu.xlsx'
    _save_menu_workbook(path, rows=[['2099-01-02', 'Ghormeh sabzi', 1_200_000]])
    food = Food.objects.create(name='Ghormeh sabzi', price=1_000_000, container_price=100_000)
    old_menu = Menu.objects.create(date=date(2098, 12, 2), food=food, food_price=1_050_000)

    call_command('import_monthly_menu', path)
    call_command('import_monthly_menu', path)

    assert Menu.objects.count() == 2
    old_menu.refresh_from_db()
    assert old_menu.food_price == 1_050_000


@pytest.mark.django_db
def test_monthly_import_rejects_duplicate_dates_atomically(tmp_path):
    path = tmp_path / 'monthly-menu.xlsx'
    _save_menu_workbook(
        path,
        rows=[
            ['2099-01-02', 'Ghormeh sabzi', 1_200_000],
            ['2099-01-02', 'Ghormeh sabzi', 1_200_000],
        ],
    )
    Food.objects.create(name='Ghormeh sabzi', price=1_000_000, container_price=100_000)

    with pytest.raises(CommandError, match='duplicate menu date'):
        call_command('import_monthly_menu', path, stderr=None)

    assert Menu.objects.count() == 0


@pytest.mark.django_db
def test_monthly_import_rejects_changed_existing_date_without_overwriting(tmp_path):
    path = tmp_path / 'monthly-menu.xlsx'
    _save_menu_workbook(path, rows=[['2099-01-02', 'Ghormeh sabzi', 1_300_000]])
    food = Food.objects.create(name='Ghormeh sabzi', price=1_000_000, container_price=100_000)
    existing = Menu.objects.create(date=date(2099, 1, 2), food=food, food_price=1_200_000)

    with pytest.raises(CommandError, match='different food or price'):
        call_command('import_monthly_menu', path)

    existing.refresh_from_db()
    assert existing.food_price == 1_200_000
