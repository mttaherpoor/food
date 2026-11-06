from django.db.models.deletion import ProtectedError

from datetime import date

import pytest

from food.models import Drink, Food, Menu, MenuStatus, Side


@pytest.mark.django_db
def test_food_total_price_is_calculated_by_database():
    food = Food.objects.create(name='Ghormeh sabzi', price=1_000_000, container_price=100_000)

    food.refresh_from_db()

    assert food.total_price == 1_100_000


@pytest.mark.django_db
def test_food_total_price_changes_with_source_prices():
    food = Food.objects.create(name='Ghormeh sabzi', price=1_000_000, container_price=100_000)

    food.price = 1_200_000
    food.save(update_fields=('price', 'datetime_modified'))
    food.refresh_from_db()

    assert food.total_price == 1_300_000


@pytest.mark.django_db
def test_catalog_models_record_required_timestamps():
    side = Side.objects.create(name='Salad', price=200_000)
    drink = Drink.objects.create(name='Doogh', price=150_000)

    assert side.datetime_created is not None
    assert side.datetime_modified is not None
    assert drink.datetime_created is not None
    assert drink.datetime_modified is not None


@pytest.mark.django_db
def test_menu_defaults_to_available():
    food = Food.objects.create(name='Ghormeh sabzi', price=1_000_000, container_price=100_000)

    menu = Menu.objects.create(date=date(2026, 11, 5), food=food)

    assert menu.status == MenuStatus.AVAILABLE


@pytest.mark.django_db
def test_food_referenced_by_menu_is_protected_from_deletion():
    food = Food.objects.create(name='Ghormeh sabzi', price=1_000_000, container_price=100_000)
    Menu.objects.create(date=date(2026, 11, 5), food=food)

    with pytest.raises(ProtectedError):
        food.delete()
