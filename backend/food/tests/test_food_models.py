from django.db.models.deletion import ProtectedError
from django.test import TestCase

from datetime import date

from food.models import Drink, Food, Menu, MenuStatus, Side


class FoodModelTests(TestCase):
    def test_food_total_price_is_calculated_by_database(self):
        food = Food.objects.create(name='Ghormeh sabzi', price=1_000_000, container_price=100_000)

        food.refresh_from_db()

        assert food.total_price == 1_100_000

    def test_food_total_price_changes_with_source_prices(self):
        food = Food.objects.create(name='Ghormeh sabzi', price=1_000_000, container_price=100_000)

        food.price = 1_200_000
        food.save(update_fields=('price', 'datetime_modified'))
        food.refresh_from_db()

        assert food.total_price == 1_300_000

    def test_catalog_models_record_required_timestamps(self):
        side = Side.objects.create(name='Salad', price=200_000)
        drink = Drink.objects.create(name='Doogh', price=150_000)

        assert side.datetime_created is not None
        assert side.datetime_modified is not None
        assert drink.datetime_created is not None
        assert drink.datetime_modified is not None

    def test_menu_defaults_to_available(self):
        food = Food.objects.create(name='Ghormeh sabzi', price=1_000_000, container_price=100_000)

        menu = Menu.objects.create(date=date(2026, 11, 5), food=food)

        assert menu.status == MenuStatus.AVAILABLE

    def test_food_referenced_by_menu_is_protected_from_deletion(self):
        food = Food.objects.create(name='Ghormeh sabzi', price=1_000_000, container_price=100_000)
        Menu.objects.create(date=date(2026, 11, 5), food=food)

        with self.assertRaises(ProtectedError):
            food.delete()
