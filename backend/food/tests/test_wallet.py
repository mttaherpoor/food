"""Regression tests for Jalali monthly reservation spending."""

from rest_framework.test import APIClient

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from unittest.mock import patch

import jdatetime

from food.models import (
    Drink,
    Food,
    Menu,
    Reservation,
    ReservationDrinkItem,
    ReservationItem,
    ReservationSideItem,
    Side,
)
from food.wallet import current_month_wallet


def gregorian(year, month, day):
    return jdatetime.date(year, month, day).togregorian()


class WalletTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        user_model = get_user_model()
        cls.user = user_model.objects.create_user(
            username="wallet-owner",
            password="test-password",
        )
        cls.other_user = user_model.objects.create_user(
            username="wallet-other",
            password="test-password",
        )
        cls.food = Food.objects.create(
            name="Wallet test food",
            price=100000,
            container_price=10000,
        )
        cls.side = Side.objects.create(
            name="Wallet test side",
            price=15000,
        )
        cls.drink = Drink.objects.create(
            name="Wallet test drink",
            price=8000,
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def make_reservation(
        self,
        *,
        year=1405,
        month=8,
        day=5,
        user=None,
        status=Reservation.Status.RESERVED,
        price=100000,
        quantity=1,
    ):
        menu = Menu.objects.create(
            date=gregorian(year, month, day),
            food=self.food,
        )
        reservation = Reservation.objects.create(
            user=user or self.user,
            menu=menu,
            status=status,
        )
        item = ReservationItem.objects.create(
            reservation=reservation,
            food_price=price,
            food_quantity=quantity,
            is_current=True,
            is_cancelled=(status == Reservation.Status.CANCELLED),
        )
        return reservation, item

    def summary(self, year, month, user=None):
        today = gregorian(year, month, 1)
        queryset = Reservation.objects.filter(
            user=user or self.user,
        )
        with patch(
            "food.wallet.timezone.localdate",
            return_value=today,
        ):
            return current_month_wallet(queryset)

    def test_months_are_independent_and_future_orders_are_excluded(self):
        self.make_reservation(month=8, day=5, price=100000)
        self.make_reservation(month=9, day=5, price=250000)

        aban = self.summary(1405, 8)
        azar = self.summary(1405, 9)

        self.assertEqual(aban["month"], "1405-08")
        self.assertEqual(aban["spent_toman"], 100000)
        self.assertEqual(aban["reservation_count"], 1)

        self.assertEqual(azar["month"], "1405-09")
        self.assertEqual(azar["spent_toman"], 250000)
        self.assertEqual(azar["reservation_count"], 1)

    def test_cancelled_reservation_is_not_counted(self):
        self.make_reservation(
            day=5,
            price=100000,
            status=Reservation.Status.CANCELLED,
        )
        self.make_reservation(day=6, price=120000)

        result = self.summary(1405, 8)

        self.assertEqual(result["spent_toman"], 120000)
        self.assertEqual(result["reservation_count"], 1)

    def test_only_current_snapshot_is_counted(self):
        reservation, old_item = self.make_reservation(
            day=5,
            price=100000,
        )
        old_item.is_current = False
        old_item.save(update_fields=["is_current"])

        ReservationItem.objects.create(
            reservation=reservation,
            food_price=180000,
            food_quantity=2,
            is_current=True,
        )

        result = self.summary(1405, 8)

        self.assertEqual(result["spent_toman"], 360000)
        self.assertEqual(result["reservation_count"], 1)

    def test_sides_and_drinks_are_included_with_snapshots(self):
        _, item = self.make_reservation(
            day=5,
            price=100000,
            quantity=2,
        )

        ReservationSideItem.objects.create(
            reservation_item=item,
            side=self.side,
            quantity=2,
            unit_price=15000,
        )
        ReservationDrinkItem.objects.create(
            reservation_item=item,
            drink=self.drink,
            quantity=3,
            unit_price=8000,
        )

        # Food 200000 + sides 30000 + drinks 24000
        result = self.summary(1405, 8)

        self.assertEqual(result["spent_toman"], 254000)
        self.assertEqual(result["reservation_count"], 1)

    def test_esfand_to_farvardin_resets_monthly_total(self):
        self.make_reservation(
            year=1405,
            month=12,
            day=5,
            price=90000,
        )
        self.make_reservation(
            year=1406,
            month=1,
            day=5,
            price=140000,
        )

        esfand = self.summary(1405, 12)
        farvardin = self.summary(1406, 1)

        self.assertEqual(esfand["month"], "1405-12")
        self.assertEqual(esfand["spent_toman"], 90000)

        self.assertEqual(farvardin["month"], "1406-01")
        self.assertEqual(farvardin["spent_toman"], 140000)

    def test_api_is_user_scoped_and_denies_anonymous_access(self):
        self.make_reservation(
            month=8,
            day=5,
            price=110000,
        )
        self.make_reservation(
            month=8,
            day=6,
            user=self.other_user,
            price=900000,
        )

        url = reverse("reservation-wallet-summary")

        with patch(
            "food.wallet.timezone.localdate",
            return_value=gregorian(1405, 8, 1),
        ):
            response = self.client.get(url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["spent_toman"], 110000)
        self.assertEqual(response.data["reservation_count"], 1)

        self.client.force_authenticate(user=None)

        anonymous_response = self.client.get(url)
        self.assertIn(
            anonymous_response.status_code,
            (401, 403),
        )
