from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from datetime import date, datetime
from unittest.mock import patch

from core.models import Building, Department
from core.services import create_employee
from food.models import Drink, Food, Menu, Reservation, Side


class ReservationAPITests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.building = Building.objects.create(
            number='07',
            is_active=True,
        )
        cls.department = Department.objects.create(
            number='003',
            is_active=True,
        )
        cls.food = Food.objects.create(
            name='Ghormeh Sabzi',
            price=1_000_000,
            container_price=100_000,
        )
        cls.menu = Menu.objects.create(
            date=date(2099, 1, 2),
            food=cls.food,
        )

    def setUp(self):
        self.user = create_employee(
            personnel_number='res-001',
            building_number=self.building.number,
            department_number=self.department.number,
        )
        self.user.must_change_password = False
        self.user.save(update_fields=['must_change_password'])
        self.client.force_login(self.user)

    def test_catalog_repricing_preserves_revision_history(self):
        side = Side.objects.create(name='Salad', price=200_000)
        drink = Drink.objects.create(name='Doogh', price=150_000)

        created = self.client.post(
            reverse('reservation-list'),
            {
                'reservations': [
                    {
                        'menu': self.menu.pk,
                        'building': self.building.pk,
                        'side': side.pk,
                        'drink': drink.pk,
                    }
                ],
            },
            content_type='application/json',
        )
        self.assertEqual(created.status_code, 201, created.content)

        reservation_id = created.json()[0]['id']
        reservation = Reservation.objects.get(pk=reservation_id)

        initial = reservation.current_item
        self.assertEqual(initial.food_price, 1_100_000)
        self.assertEqual(initial.side_price, 200_000)
        self.assertEqual(initial.drink_price, 150_000)

        self.food.price = 2_000_000
        self.food.save(update_fields=('price', 'datetime_modified'))
        side.price = 300_000
        side.save(update_fields=('price', 'datetime_modified'))
        drink.price = 250_000
        drink.save(update_fields=('price', 'datetime_modified'))

        updated = self.client.patch(
            reverse('reservation-detail', kwargs={'pk': reservation_id}),
            {'food_quantity': 2},
            content_type='application/json',
        )
        self.assertEqual(updated.status_code, 200, updated.content)

        edited = reservation.current_item
        self.assertEqual(edited.food_price, 2_100_000)
        self.assertEqual(edited.side_price, 300_000)
        self.assertEqual(edited.drink_price, 250_000)
        self.assertEqual(edited.food_quantity, 2)
        self.assertEqual(edited.total_price, 4_750_000)

        cancelled = self.client.post(
            reverse('reservation-cancel', kwargs={'pk': reservation_id}),
        )
        self.assertEqual(cancelled.status_code, 200, cancelled.content)

        cancelled_item = reservation.current_item
        self.assertTrue(cancelled_item.is_cancelled)
        self.assertEqual(cancelled_item.food_price, 2_100_000)
        self.assertEqual(cancelled_item.side_price, 300_000)
        self.assertEqual(cancelled_item.drink_price, 250_000)
        self.assertEqual(cancelled_item.total_price, 0)

        self.food.price = 3_000_000
        self.food.save(update_fields=('price', 'datetime_modified'))
        side.price = 400_000
        side.save(update_fields=('price', 'datetime_modified'))
        drink.price = 350_000
        drink.save(update_fields=('price', 'datetime_modified'))

        restored = self.client.patch(
            reverse('reservation-detail', kwargs={'pk': reservation_id}),
            {'food_quantity': 1},
            content_type='application/json',
        )
        self.assertEqual(restored.status_code, 200, restored.content)

        reservation.refresh_from_db()
        current = reservation.current_item

        self.assertEqual(reservation.status, Reservation.Status.RESERVED)
        self.assertEqual(current.food_price, 3_100_000)
        self.assertEqual(current.side_price, 400_000)
        self.assertEqual(current.drink_price, 350_000)
        self.assertEqual(current.total_price, 3_850_000)

        history = list(reservation.items.order_by('pk'))
        self.assertEqual(len(history), 4)
        self.assertEqual(
            [item.food_price for item in history],
            [1_100_000, 2_100_000, 2_100_000, 3_100_000],
        )
        self.assertEqual(
            [item.is_current for item in history],
            [False, False, False, True],
        )

    def test_create_reservation_with_multiple_sides_and_drinks(self):
        salad = Side.objects.create(name='Salad', price=200_000)
        yogurt = Side.objects.create(name='Yogurt', price=100_000)
        doogh = Drink.objects.create(name='Doogh', price=150_000)
        cola = Drink.objects.create(name='Cola', price=120_000)

        response = self.client.post(
            reverse('reservation-list'),
            {
                'reservations': [
                    {
                        'menu': self.menu.pk,
                        'building': self.building.pk,
                        'food_quantity': 1,
                        'sides': [
                            {'side': salad.pk, 'quantity': 2},
                            {'side': yogurt.pk, 'quantity': 1},
                        ],
                        'drinks': [
                            {'drink': doogh.pk, 'quantity': 3},
                            {'drink': cola.pk, 'quantity': 2},
                        ],
                    }
                ],
            },
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 201, response.content)

        reservation = Reservation.objects.get(
            user=self.user,
            menu=self.menu,
        )
        item = reservation.current_item

        sides = {row.side_id: (row.quantity, row.unit_price) for row in item.side_items.all()}
        drinks = {row.drink_id: (row.quantity, row.unit_price) for row in item.drink_items.all()}

        self.assertEqual(
            sides,
            {
                salad.pk: (2, 200_000),
                yogurt.pk: (1, 100_000),
            },
        )
        self.assertEqual(
            drinks,
            {
                doogh.pk: (3, 150_000),
                cola.pk: (2, 120_000),
            },
        )

        self.assertEqual(item.total_price, 2_290_000)
        self.assertEqual(reservation.total_price, 2_290_000)

        payload = response.json()[0]['current_item']
        self.assertEqual(len(payload['side_items']), 2)
        self.assertEqual(len(payload['drink_items']), 2)
        self.assertEqual(payload['total_price'], 2_290_000)

    def test_edit_multiselect_replaces_items_and_preserves_history(self):
        salad = Side.objects.create(name='Salad', price=200_000)
        yogurt = Side.objects.create(name='Yogurt', price=100_000)
        doogh = Drink.objects.create(name='Doogh', price=150_000)

        created = self.client.post(
            reverse('reservation-list'),
            {
                'reservations': [
                    {
                        'menu': self.menu.pk,
                        'building': self.building.pk,
                        'sides': [
                            {'side': salad.pk, 'quantity': 2},
                            {'side': yogurt.pk, 'quantity': 1},
                        ],
                        'drinks': [
                            {'drink': doogh.pk, 'quantity': 1},
                        ],
                    }
                ],
            },
            content_type='application/json',
        )
        self.assertEqual(created.status_code, 201, created.content)

        reservation_id = created.json()[0]['id']
        reservation = Reservation.objects.get(pk=reservation_id)
        previous = reservation.current_item

        self.assertEqual(previous.side_items.count(), 2)
        self.assertEqual(previous.drink_items.count(), 1)

        edited = self.client.patch(
            reverse('reservation-detail', kwargs={'pk': reservation_id}),
            {
                'sides': [],
                'drinks': [
                    {'drink': doogh.pk, 'quantity': 3},
                ],
            },
            content_type='application/json',
        )
        self.assertEqual(edited.status_code, 200, edited.content)

        reservation.refresh_from_db()
        current = reservation.current_item

        self.assertNotEqual(previous.pk, current.pk)
        previous.refresh_from_db()
        self.assertFalse(previous.is_current)
        self.assertTrue(current.is_current)

        self.assertEqual(current.side_items.count(), 0)

        drink_rows = list(current.drink_items.all())
        self.assertEqual(len(drink_rows), 1)
        self.assertEqual(drink_rows[0].drink_id, doogh.pk)
        self.assertEqual(drink_rows[0].quantity, 3)
        self.assertEqual(drink_rows[0].unit_price, 150_000)

        self.assertEqual(current.total_price, 1_550_000)

        previous.refresh_from_db()
        self.assertEqual(previous.side_items.count(), 2)
        self.assertEqual(previous.drink_items.count(), 1)
        self.assertEqual(previous.total_price, 1_750_000)

    def test_multiselect_cancel_and_restore_reprices_items(self):
        salad = Side.objects.create(name='Salad', price=200_000)
        doogh = Drink.objects.create(name='Doogh', price=150_000)

        created = self.client.post(
            reverse('reservation-list'),
            {
                'reservations': [
                    {
                        'menu': self.menu.pk,
                        'building': self.building.pk,
                        'sides': [{'side': salad.pk, 'quantity': 2}],
                        'drinks': [{'drink': doogh.pk, 'quantity': 2}],
                    }
                ],
            },
            content_type='application/json',
        )
        self.assertEqual(created.status_code, 201, created.content)

        reservation_id = created.json()[0]['id']
        reservation = Reservation.objects.get(pk=reservation_id)
        initial = reservation.current_item

        self.assertEqual(initial.total_price, 1_800_000)

        cancelled = self.client.post(
            reverse('reservation-cancel', kwargs={'pk': reservation_id}),
        )
        self.assertEqual(cancelled.status_code, 200, cancelled.content)
        self.assertEqual(cancelled.json()['total_price'], 0)

        cancelled_item = reservation.current_item
        self.assertTrue(cancelled_item.is_cancelled)
        self.assertEqual(cancelled_item.total_price, 0)

        cancelled_side = cancelled_item.side_items.get(side=salad)
        cancelled_drink = cancelled_item.drink_items.get(drink=doogh)

        self.assertEqual(
            (cancelled_side.quantity, cancelled_side.unit_price),
            (2, 200_000),
        )
        self.assertEqual(
            (cancelled_drink.quantity, cancelled_drink.unit_price),
            (2, 150_000),
        )

        self.food.price = 2_000_000
        self.food.save(update_fields=('price', 'datetime_modified'))
        salad.price = 300_000
        salad.save(update_fields=('price', 'datetime_modified'))
        doogh.price = 250_000
        doogh.save(update_fields=('price', 'datetime_modified'))

        restored = self.client.patch(
            reverse('reservation-detail', kwargs={'pk': reservation_id}),
            {'food_quantity': 1},
            content_type='application/json',
        )
        self.assertEqual(restored.status_code, 200, restored.content)

        reservation.refresh_from_db()
        current = reservation.current_item

        self.assertEqual(reservation.status, Reservation.Status.RESERVED)
        self.assertFalse(current.is_cancelled)
        self.assertEqual(current.food_price, 2_100_000)
        self.assertEqual(current.total_price, 3_200_000)

        restored_side = current.side_items.get(side=salad)
        restored_drink = current.drink_items.get(drink=doogh)

        self.assertEqual(
            (restored_side.quantity, restored_side.unit_price),
            (2, 300_000),
        )
        self.assertEqual(
            (restored_drink.quantity, restored_drink.unit_price),
            (2, 250_000),
        )

        initial.refresh_from_db()
        cancelled_item.refresh_from_db()

        self.assertFalse(initial.is_current)
        self.assertFalse(cancelled_item.is_current)
        self.assertTrue(current.is_current)
        self.assertEqual(reservation.items.count(), 3)

        self.assertEqual(initial.total_price, 1_800_000)
        self.assertEqual(cancelled_item.food_price, 1_100_000)
        self.assertEqual(
            cancelled_item.side_items.get(side=salad).unit_price,
            200_000,
        )
        self.assertEqual(
            cancelled_item.drink_items.get(drink=doogh).unit_price,
            150_000,
        )

    def test_legacy_side_removal_clears_multiselect_rows(self):
        side = Side.objects.create(name='Salad', price=200_000)

        created = self.client.post(
            reverse('reservation-list'),
            {
                'reservations': [
                    {
                        'menu': self.menu.pk,
                        'building': self.building.pk,
                        'side': side.pk,
                    }
                ],
            },
            content_type='application/json',
        )
        self.assertEqual(created.status_code, 201, created.content)

        reservation_id = created.json()[0]['id']
        reservation = Reservation.objects.get(pk=reservation_id)
        initial = reservation.current_item

        self.assertEqual(initial.side_items.count(), 1)

        edited = self.client.patch(
            reverse('reservation-detail', kwargs={'pk': reservation_id}),
            {'side': None},
            content_type='application/json',
        )
        self.assertEqual(edited.status_code, 200, edited.content)

        current = reservation.current_item
        initial.refresh_from_db()

        self.assertNotEqual(initial.pk, current.pk)
        self.assertFalse(initial.is_current)
        self.assertIsNone(current.side)
        self.assertEqual(current.side_items.count(), 0)
        self.assertEqual(current.total_price, 1_100_000)

        self.assertEqual(initial.side_items.count(), 1)
        self.assertEqual(initial.total_price, 1_300_000)

    def test_legacy_drink_removal_clears_multiselect_rows(self):
        drink = Drink.objects.create(name='Doogh Legacy', price=150_000)

        created = self.client.post(
            reverse('reservation-list'),
            {
                'reservations': [
                    {
                        'menu': self.menu.pk,
                        'building': self.building.pk,
                        'drink': drink.pk,
                    }
                ],
            },
            content_type='application/json',
        )
        self.assertEqual(created.status_code, 201, created.content)

        reservation_id = created.json()[0]['id']
        reservation = Reservation.objects.get(pk=reservation_id)
        initial = reservation.current_item

        edited = self.client.patch(
            reverse('reservation-detail', kwargs={'pk': reservation_id}),
            {'drink': None},
            content_type='application/json',
        )
        self.assertEqual(edited.status_code, 200, edited.content)

        current = reservation.current_item
        initial.refresh_from_db()

        self.assertFalse(initial.is_current)
        self.assertEqual(initial.drink_items.count(), 1)
        self.assertEqual(current.drink_items.count(), 0)
        self.assertEqual(current.total_price, 1_100_000)

    def test_legacy_side_replaces_multiple_sides(self):
        salad = Side.objects.create(name='Salad Multi', price=200_000)
        yogurt = Side.objects.create(name='Yogurt Multi', price=100_000)

        created = self.client.post(
            reverse('reservation-list'),
            {
                'reservations': [
                    {
                        'menu': self.menu.pk,
                        'building': self.building.pk,
                        'sides': [
                            {'side': salad.pk, 'quantity': 2},
                            {'side': yogurt.pk, 'quantity': 1},
                        ],
                    }
                ],
            },
            content_type='application/json',
        )
        self.assertEqual(created.status_code, 201, created.content)

        reservation_id = created.json()[0]['id']
        reservation = Reservation.objects.get(pk=reservation_id)
        initial = reservation.current_item

        edited = self.client.patch(
            reverse('reservation-detail', kwargs={'pk': reservation_id}),
            {'side': yogurt.pk, 'side_quantity': 3},
            content_type='application/json',
        )
        self.assertEqual(edited.status_code, 200, edited.content)

        current = reservation.current_item
        rows = list(current.side_items.all())

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].side_id, yogurt.pk)
        self.assertEqual(rows[0].quantity, 3)
        self.assertEqual(current.total_price, 1_400_000)

        initial.refresh_from_db()
        self.assertFalse(initial.is_current)
        self.assertEqual(initial.side_items.count(), 2)

    def test_multiselect_rejects_duplicate_and_mixed_side_inputs(self):
        side = Side.objects.create(name='Duplicate Salad', price=200_000)

        payloads = [
            {
                'side': side.pk,
                'sides': [{'side': side.pk, 'quantity': 1}],
            },
            {
                'sides': [
                    {'side': side.pk, 'quantity': 1},
                    {'side': side.pk, 'quantity': 2},
                ],
            },
        ]

        for payload in payloads:
            with self.subTest(payload=payload):
                response = self.client.post(
                    reverse('reservation-list'),
                    {
                        'reservations': [
                            {
                                'menu': self.menu.pk,
                                'building': self.building.pk,
                                **payload,
                            }
                        ],
                    },
                    content_type='application/json',
                )

                self.assertEqual(response.status_code, 400)
                self.assertFalse(
                    Reservation.objects.filter(
                        user=self.user,
                        menu=self.menu,
                    ).exists()
                )

    def test_create_reservation_with_building(self):
        response = self.client.post(
            reverse('reservation-list'),
            {
                'reservations': [
                    {
                        'menu': self.menu.pk,
                        'building': self.building.pk,
                    }
                ]
            },
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 201, response.content)

        reservation = self.user.reservations.get(menu=self.menu)
        item = reservation.current_item

        self.assertEqual(item.building_id, self.building.pk)
        self.assertEqual(item.building_number_snapshot, '07')

    def test_employee_can_create_week_reservations_with_optional_sides_and_drinks(self):
        side = Side.objects.create(name='Salad', price=200_000)
        drink = Drink.objects.create(name='Doogh', price=150_000)

        response = self.client.post(
            reverse('reservation-list'),
            {
                'reservations': [
                    {
                        'menu': self.menu.pk,
                        'building': self.building.pk,
                        'side': side.pk,
                        'drink': drink.pk,
                    },
                ],
            },
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 201, response.content)

        reservation = Reservation.objects.get(user=self.user, menu=self.menu)
        item = reservation.current_item

        self.assertEqual(item.food_quantity, 1)
        self.assertEqual(item.side_quantity, 1)
        self.assertEqual(item.drink_quantity, 1)
        self.assertEqual(item.food_price, 1_100_000)
        self.assertEqual(reservation.total_price, 1_450_000)

        self.assertEqual(item.building_id, self.building.pk)
        self.assertEqual(item.building_number_snapshot, '07')

    def test_reservation_edit_and_cancel_keep_history_and_price_snapshots(self):
        side = Side.objects.create(name='Salad', price=200_000)

        create_response = self.client.post(
            reverse('reservation-list'),
            {
                'reservations': [
                    {
                        'menu': self.menu.pk,
                        'building': self.building.pk,
                        'side': side.pk,
                    }
                ]
            },
            content_type='application/json',
        )
        self.assertEqual(create_response.status_code, 201, create_response.content)

        reservation_id = create_response.json()[0]['id']

        side.price = 300_000
        side.save(update_fields=('price', 'datetime_modified'))

        self.food.price = 2_000_000
        self.food.save(update_fields=('price', 'datetime_modified'))

        edit_response = self.client.patch(
            reverse('reservation-detail', kwargs={'pk': reservation_id}),
            {'side': None},
            content_type='application/json',
        )
        self.assertEqual(edit_response.status_code, 200, edit_response.content)

        reservation = Reservation.objects.get(pk=reservation_id)
        old_item, current_item = list(reservation.items.order_by('id'))

        self.assertFalse(old_item.is_current)
        self.assertEqual(old_item.side_price, 200_000)
        self.assertIsNone(current_item.side)
        self.assertEqual(current_item.side_price, 0)
        self.assertEqual(old_item.food_price, 1_100_000)
        self.assertEqual(current_item.food_price, 2_100_000)

        self.assertEqual(old_item.building_id, self.building.pk)
        self.assertEqual(current_item.building_id, self.building.pk)
        self.assertEqual(old_item.building_number_snapshot, '07')
        self.assertEqual(current_item.building_number_snapshot, '07')

        cancel_response = self.client.post(reverse('reservation-cancel', kwargs={'pk': reservation_id}))
        self.assertEqual(cancel_response.status_code, 200, cancel_response.content)
        self.assertEqual(cancel_response.json()['total_price'], 0)
        self.assertEqual(
            cancel_response.json()['status'],
            Reservation.Status.CANCELLED,
        )

        self.assertEqual(reservation.items.count(), 3)
        self.assertEqual(
            reservation.items.filter(is_current=True, is_cancelled=True).count(),
            1,
        )

        cancelled_item = reservation.current_item
        self.assertEqual(cancelled_item.building_id, self.building.pk)
        self.assertEqual(cancelled_item.building_number_snapshot, '07')

    def test_employee_cannot_reserve_past_menu_or_reserve_twice(self):
        past_menu = Menu.objects.create(
            date='2000-01-02',
            food=self.food,
        )

        past_response = self.client.post(
            reverse('reservation-list'),
            {
                'reservations': [
                    {
                        'menu': past_menu.pk,
                        'building': self.building.pk,
                    }
                ]
            },
            content_type='application/json',
        )

        self.assertEqual(past_response.status_code, 400)

        payload = {
            'reservations': [
                {
                    'menu': self.menu.pk,
                    'building': self.building.pk,
                }
            ]
        }

        first_response = self.client.post(
            reverse('reservation-list'),
            payload,
            content_type='application/json',
        )

        self.assertEqual(
            first_response.status_code,
            201,
            first_response.content,
        )

        duplicate_response = self.client.post(
            reverse('reservation-list'),
            payload,
            content_type='application/json',
        )

        self.assertEqual(duplicate_response.status_code, 400)

        self.assertEqual(
            Reservation.objects.filter(
                user=self.user,
                menu=self.menu,
            ).count(),
            1,
        )

        self.assertEqual(
            self.user.reservations.get(menu=self.menu).current_item.building_number_snapshot,
            '07',
        )

        self.assertEqual(
            Reservation.objects.count(),
            1,
        )

    def test_reservation_is_rejected_at_previous_day_cutoff(self):
        cutoff = datetime(
            2099,
            1,
            1,
            10,
            0,
            tzinfo=timezone.get_default_timezone(),
        )

        with patch('food.services._local_now', return_value=cutoff):
            response = self.client.post(
                reverse('reservation-list'),
                {
                    'reservations': [
                        {
                            'menu': self.menu.pk,
                            'building': self.building.pk,
                        }
                    ]
                },
                content_type='application/json',
            )

        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('menu', response.json())
        self.assertEqual(Reservation.objects.count(), 0)

    def test_configurable_cutoff_matches_weekly_menu_and_service(self):
        from rest_framework.exceptions import ValidationError

        from food.serializers import WeeklyMenuSerializer
        from food.services import validate_reservation_window

        serializer = WeeklyMenuSerializer()

        cases = (
            (9, 8, 59, True),
            (9, 9, 0, False),
            (11, 10, 59, True),
            (11, 11, 0, False),
        )

        for cutoff_hour, hour, minute, expected in cases:
            with self.subTest(cutoff_hour=cutoff_hour, hour=hour, minute=minute):
                current = datetime(
                    2099,
                    1,
                    1,
                    hour,
                    minute,
                    tzinfo=timezone.get_default_timezone(),
                )

                with (
                    override_settings(RESERVATION_CUTOFF_HOUR=cutoff_hour),
                    patch('food.services._local_now', return_value=current),
                ):
                    self.assertEqual(
                        serializer.get_can_reserve(self.menu),
                        expected,
                    )

                    if expected:
                        validate_reservation_window(self.menu, cutoff_hour)
                    else:
                        with self.assertRaises(ValidationError):
                            validate_reservation_window(self.menu, cutoff_hour)

    @override_settings(RESERVATION_CUTOFF_HOUR=9)
    def test_configured_nine_am_cutoff_rejects_reservation(self):
        current = datetime(
            2099,
            1,
            1,
            9,
            0,
            tzinfo=timezone.get_default_timezone(),
        )

        with patch('food.services._local_now', return_value=current):
            response = self.client.post(
                reverse('reservation-list'),
                {
                    'reservations': [
                        {
                            'menu': self.menu.pk,
                            'building': self.building.pk,
                        }
                    ],
                },
                content_type='application/json',
            )

        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('menu', response.json())
        self.assertEqual(Reservation.objects.count(), 0)

    @override_settings(RESERVATION_CUTOFF_HOUR=11)
    def test_configured_eleven_am_cutoff_allows_reservation_before_deadline(self):
        current = datetime(
            2099,
            1,
            1,
            10,
            59,
            tzinfo=timezone.get_default_timezone(),
        )

        with patch('food.services._local_now', return_value=current):
            response = self.client.post(
                reverse('reservation-list'),
                {
                    'reservations': [
                        {
                            'menu': self.menu.pk,
                            'building': self.building.pk,
                        }
                    ],
                },
                content_type='application/json',
            )

        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Reservation.objects.count(), 1)

    def test_weekly_menu_shows_current_catalog_price(self):
        original_menu_price = self.menu.food_price

        self.food.price = 2_000_000
        self.food.save(update_fields=('price', 'datetime_modified'))

        self.menu.refresh_from_db()
        self.assertEqual(self.menu.food_price, original_menu_price)

        response = self.client.get(
            reverse('reservation-weekly'),
            {'start': '2099-01-01'},
        )

        self.assertEqual(response.status_code, 200, response.content)

        menu_data = next(item for item in response.json() if item['id'] == self.menu.pk)

        self.assertEqual(menu_data['food_price'], 2_100_000)

        created = self.client.post(
            reverse('reservation-list'),
            {
                'reservations': [
                    {
                        'menu': self.menu.pk,
                        'building': self.building.pk,
                    }
                ],
            },
            content_type='application/json',
        )

        self.assertEqual(created.status_code, 201, created.content)
        self.assertEqual(
            created.json()[0]['current_item']['food_price'],
            menu_data['food_price'],
        )

    def test_employee_can_load_weekly_menu_and_only_sees_own_reservations(self):
        response = self.client.get(
            reverse('reservation-weekly'),
            {'start': '2099-01-01'},
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(len(response.json()), 1)

        menu_data = response.json()[0]

        self.assertEqual(menu_data['id'], self.menu.pk)
        self.assertEqual(menu_data['food_price'], 1_100_000)
        self.assertIsNone(menu_data['reservation'])

    def test_employee_can_add_optional_drink_during_edit_with_default_quantity_one(self):
        drink = Drink.objects.create(
            name='Doogh',
            price=150_000,
        )

        created = self.client.post(
            reverse('reservation-list'),
            {
                'reservations': [
                    {
                        'menu': self.menu.pk,
                        'building': self.building.pk,
                    }
                ]
            },
            content_type='application/json',
        )

        self.assertEqual(created.status_code, 201, created.content)
        reservation_id = created.json()[0]['id']

        updated = self.client.patch(
            reverse('reservation-detail', kwargs={'pk': reservation_id}),
            {'drink': drink.pk},
            content_type='application/json',
        )

        self.assertEqual(updated.status_code, 200, updated.content)

        item = updated.json()['current_item']

        self.assertEqual(item['drink'], drink.pk)
        self.assertEqual(item['drink_quantity'], 1)
        self.assertEqual(item['total_price'], 1_250_000)

        self.assertEqual(item['building'], self.building.pk)
        self.assertEqual(item['building_number_snapshot'], '07')

        reservation = Reservation.objects.get(pk=reservation_id)

        self.assertEqual(reservation.items.count(), 2)
        self.assertEqual(reservation.current_item.drink_id, drink.pk)
        self.assertEqual(reservation.current_item.drink_quantity, 1)

    def test_employee_cannot_read_another_employees_reservation(self):
        created = self.client.post(
            reverse('reservation-list'),
            {
                'reservations': [
                    {
                        'menu': self.menu.pk,
                        'building': self.building.pk,
                    }
                ]
            },
            content_type='application/json',
        )

        self.assertEqual(created.status_code, 201, created.content)
        reservation_id = created.json()[0]['id']

        other_user = create_employee(
            personnel_number='res-002',
            building_number=self.building.number,
            department_number=self.department.number,
        )
        other_user.must_change_password = False
        other_user.save(update_fields=['must_change_password'])

        self.client.force_login(other_user)

        response = self.client.get(reverse('reservation-detail', kwargs={'pk': reservation_id}))

        self.assertEqual(response.status_code, 404, response.content)

        reservation = Reservation.objects.get(pk=reservation_id)
        self.assertEqual(reservation.user_id, self.user.pk)
        self.assertEqual(reservation.current_item.building_id, self.building.pk)
        self.assertEqual(
            reservation.current_item.building_number_snapshot,
            '07',
        )

    def test_reservation_batch_rolls_back_when_one_day_is_invalid(self):
        past_menu = Menu.objects.create(
            date='2000-01-02',
            food=self.food,
        )

        response = self.client.post(
            reverse('reservation-list'),
            {
                'reservations': [
                    {
                        'menu': self.menu.pk,
                        'building': self.building.pk,
                    },
                    {
                        'menu': past_menu.pk,
                        'building': self.building.pk,
                    },
                ]
            },
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('menu', response.json())

        self.assertEqual(Reservation.objects.count(), 0)
        self.assertEqual(self.user.reservations.count(), 0)

    def test_employee_must_change_initial_password_before_reserving(self):
        employee = create_employee(
            personnel_number='res-003',
            building_number=self.building.number,
            department_number=self.department.number,
        )

        self.assertTrue(employee.must_change_password)
        self.client.force_login(employee)

        response = self.client.get(reverse('reservation-list'))

        self.assertEqual(response.status_code, 403, response.content)
        self.assertEqual(
            Reservation.objects.filter(user=employee).count(),
            0,
        )

    def test_cancelled_reservation_can_be_reactivated_before_cutoff_without_losing_history(self):
        food = Food.objects.create(
            name='Restore test',
            price=100_000,
            container_price=10_000,
        )
        menu = Menu.objects.create(
            date='2099-01-03',
            food=food,
        )

        created = self.client.post(
            reverse('reservation-list'),
            {
                'reservations': [
                    {
                        'menu': menu.pk,
                        'building': self.building.pk,
                        'food_quantity': 1,
                    }
                ]
            },
            content_type='application/json',
        )
        self.assertEqual(created.status_code, 201, created.content)
        reservation_id = created.json()[0]['id']

        cancelled = self.client.post(reverse('reservation-cancel', kwargs={'pk': reservation_id}))
        self.assertEqual(cancelled.status_code, 200, cancelled.content)

        restored = self.client.patch(
            reverse('reservation-detail', kwargs={'pk': reservation_id}),
            {'food_quantity': 2},
            content_type='application/json',
        )
        self.assertEqual(restored.status_code, 200, restored.content)

        reservation = Reservation.objects.get(pk=reservation_id)
        reservation.refresh_from_db()

        self.assertEqual(reservation.status, Reservation.Status.RESERVED)
        self.assertEqual(reservation.items.count(), 3)
        self.assertEqual(
            reservation.items.filter(
                is_current=True,
                is_cancelled=False,
            ).count(),
            1,
        )
        self.assertEqual(reservation.current_item.food_quantity, 2)
        self.assertEqual(reservation.total_price, 220_000)
        self.assertEqual(
            Reservation.objects.filter(user=self.user, menu=menu).count(),
            1,
        )

        items = list(reservation.items.order_by('id'))
        self.assertEqual(
            [item.is_cancelled for item in items],
            [False, True, False],
        )
        self.assertTrue(all(item.building_id == self.building.pk for item in items))
        self.assertTrue(all(item.building_number_snapshot == '07' for item in items))

        second_cancel = self.client.post(reverse('reservation-cancel', kwargs={'pk': reservation_id}))
        self.assertEqual(second_cancel.status_code, 200, second_cancel.content)

        reservation.refresh_from_db()
        self.assertEqual(reservation.status, Reservation.Status.CANCELLED)
        self.assertEqual(reservation.items.count(), 4)
        self.assertEqual(
            reservation.items.filter(is_current=True).count(),
            1,
        )

        final_item = reservation.current_item
        self.assertTrue(final_item.is_cancelled)
        self.assertEqual(final_item.building_id, self.building.pk)
        self.assertEqual(final_item.building_number_snapshot, '07')

    def test_cancelled_reservation_cannot_be_restored_after_cutoff(self):
        created = self.client.post(
            reverse('reservation-list'),
            {
                'reservations': [
                    {
                        'menu': self.menu.pk,
                        'building': self.building.pk,
                    }
                ]
            },
            content_type='application/json',
        )
        self.assertEqual(created.status_code, 201, created.content)
        reservation_id = created.json()[0]['id']

        cancelled = self.client.post(reverse('reservation-cancel', kwargs={'pk': reservation_id}))
        self.assertEqual(cancelled.status_code, 200, cancelled.content)

        local_time = datetime(
            2099,
            1,
            1,
            10,
            0,
            tzinfo=timezone.get_default_timezone(),
        )

        with patch('food.services._local_now', return_value=local_time):
            response = self.client.patch(
                reverse('reservation-detail', kwargs={'pk': reservation_id}),
                {'food_quantity': 1},
                content_type='application/json',
            )

        self.assertEqual(response.status_code, 400, response.content)

        reservation = Reservation.objects.get(pk=reservation_id)
        self.assertEqual(reservation.status, Reservation.Status.CANCELLED)
        self.assertEqual(reservation.items.count(), 2)

        current_item = reservation.current_item
        self.assertTrue(current_item.is_cancelled)
        self.assertEqual(current_item.building_id, self.building.pk)
        self.assertEqual(current_item.building_number_snapshot, '07')
        self.assertEqual(
            reservation.items.filter(is_current=True).count(),
            1,
        )

    def test_create_reservation_requires_building(self):
        response = self.client.post(
            reverse('reservation-list'),
            {
                'reservations': [
                    {
                        'menu': self.menu.pk,
                    }
                ]
            },
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('building', str(response.json()))
        self.assertEqual(Reservation.objects.count(), 0)

    def test_create_reservation_rejects_inactive_building(self):
        inactive_building = Building.objects.create(
            number='08',
            is_active=False,
        )

        response = self.client.post(
            reverse('reservation-list'),
            {
                'reservations': [
                    {
                        'menu': self.menu.pk,
                        'building': inactive_building.pk,
                    }
                ]
            },
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('building', str(response.json()))
        self.assertEqual(Reservation.objects.count(), 0)

    def test_changing_reservation_building_preserves_profile_and_history(self):
        other_building = Building.objects.create(
            number='08',
            is_active=True,
        )

        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.building_id, self.building.pk)

        created = self.client.post(
            reverse('reservation-list'),
            {
                'reservations': [
                    {
                        'menu': self.menu.pk,
                        'building': self.building.pk,
                    }
                ]
            },
            content_type='application/json',
        )
        self.assertEqual(created.status_code, 201, created.content)

        reservation_id = created.json()[0]['id']

        updated = self.client.patch(
            reverse('reservation-detail', kwargs={'pk': reservation_id}),
            {'building': other_building.pk},
            content_type='application/json',
        )
        self.assertEqual(updated.status_code, 200, updated.content)

        reservation = Reservation.objects.get(pk=reservation_id)
        items = list(reservation.items.order_by('id'))

        self.assertEqual(len(items), 2)

        original_item, updated_item = items

        self.assertFalse(original_item.is_current)
        self.assertEqual(original_item.building_id, self.building.pk)
        self.assertEqual(original_item.building_number_snapshot, '07')

        self.assertTrue(updated_item.is_current)
        self.assertEqual(updated_item.building_id, other_building.pk)
        self.assertEqual(updated_item.building_number_snapshot, '08')

        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.building_id, self.building.pk)

        response_item = updated.json()['current_item']
        self.assertEqual(response_item['building'], other_building.pk)
        self.assertEqual(response_item['building_number_snapshot'], '08')

    def test_building_number_change_does_not_rewrite_reservation_snapshot(self):
        created = self.client.post(
            reverse('reservation-list'),
            {
                'reservations': [
                    {
                        'menu': self.menu.pk,
                        'building': self.building.pk,
                    }
                ]
            },
            content_type='application/json',
        )
        self.assertEqual(created.status_code, 201, created.content)

        reservation_id = created.json()[0]['id']
        reservation = Reservation.objects.get(pk=reservation_id)
        original_item = reservation.current_item

        self.assertEqual(original_item.building_number_snapshot, '07')

        self.building.number = '09'
        self.building.save(update_fields=['number'])

        original_item.refresh_from_db()
        self.assertEqual(original_item.building_id, self.building.pk)
        self.assertEqual(original_item.building.number, '09')
        self.assertEqual(original_item.building_number_snapshot, '07')

        updated = self.client.patch(
            reverse('reservation-detail', kwargs={'pk': reservation_id}),
            {'food_quantity': 2},
            content_type='application/json',
        )
        self.assertEqual(updated.status_code, 200, updated.content)

        reservation.refresh_from_db()
        items = list(reservation.items.order_by('id'))

        self.assertEqual(len(items), 2)

        for item in items:
            self.assertEqual(item.building_id, self.building.pk)
            self.assertEqual(item.building_number_snapshot, '07')

        self.assertEqual(reservation.current_item.food_quantity, 2)
        self.assertEqual(
            updated.json()['current_item']['building_number_snapshot'],
            '07',
        )

    def test_revision_rejects_inactive_building(self):
        created = self.client.post(
            reverse('reservation-list'),
            {
                'reservations': [
                    {
                        'menu': self.menu.pk,
                        'building': self.building.pk,
                    }
                ]
            },
            content_type='application/json',
        )
        self.assertEqual(created.status_code, 201, created.content)
        reservation_id = created.json()[0]['id']

        inactive_building = Building.objects.create(
            number='08',
            is_active=False,
        )

        updated = self.client.patch(
            reverse('reservation-detail', kwargs={'pk': reservation_id}),
            {'building': inactive_building.pk},
            content_type='application/json',
        )

        self.assertEqual(updated.status_code, 400, updated.content)
        self.assertIn('building', str(updated.json()))

        reservation = Reservation.objects.get(pk=reservation_id)
        self.assertEqual(reservation.items.count(), 1)
        self.assertEqual(reservation.current_item.building_id, self.building.pk)
        self.assertEqual(
            reservation.current_item.building_number_snapshot,
            '07',
        )

    def test_revision_preserves_existing_inactive_building(self):
        created = self.client.post(
            reverse('reservation-list'),
            {
                'reservations': [
                    {
                        'menu': self.menu.pk,
                        'building': self.building.pk,
                    }
                ]
            },
            content_type='application/json',
        )
        self.assertEqual(created.status_code, 201, created.content)
        reservation_id = created.json()[0]['id']

        self.building.is_active = False
        self.building.save(update_fields=['is_active'])

        updated = self.client.patch(
            reverse('reservation-detail', kwargs={'pk': reservation_id}),
            {'food_quantity': 2},
            content_type='application/json',
        )

        self.assertEqual(updated.status_code, 200, updated.content)

        reservation = Reservation.objects.get(pk=reservation_id)
        self.assertEqual(reservation.items.count(), 2)
        self.assertEqual(reservation.current_item.food_quantity, 2)

        for item in reservation.items.all():
            self.assertEqual(item.building_id, self.building.pk)
            self.assertEqual(item.building_number_snapshot, '07')

        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.building_id, self.building.pk)

    def test_legacy_reservation_can_be_cancelled_without_building(self):
        created = self.client.post(
            reverse('reservation-list'),
            {
                'reservations': [
                    {
                        'menu': self.menu.pk,
                        'building': self.building.pk,
                    }
                ]
            },
            content_type='application/json',
        )
        self.assertEqual(created.status_code, 201, created.content)
        reservation_id = created.json()[0]['id']

        reservation = Reservation.objects.get(pk=reservation_id)
        reservation.items.update(
            building=None,
            building_number_snapshot=None,
        )

        cancelled = self.client.post(reverse('reservation-cancel', kwargs={'pk': reservation_id}))
        self.assertEqual(cancelled.status_code, 200, cancelled.content)

        reservation.refresh_from_db()
        self.assertEqual(reservation.status, Reservation.Status.CANCELLED)
        self.assertEqual(reservation.items.count(), 2)

        for item in reservation.items.all():
            self.assertIsNone(item.building_id)
            self.assertIsNone(item.building_number_snapshot)

        self.assertIsNone(cancelled.json()['current_item']['building'])
        self.assertIsNone(cancelled.json()['current_item']['building_number_snapshot'])

    def test_legacy_cancelled_reservation_requires_building_for_reactivation(self):
        created = self.client.post(
            reverse('reservation-list'),
            {
                'reservations': [
                    {
                        'menu': self.menu.pk,
                        'building': self.building.pk,
                    }
                ]
            },
            content_type='application/json',
        )
        self.assertEqual(created.status_code, 201, created.content)
        reservation_id = created.json()[0]['id']

        reservation = Reservation.objects.get(pk=reservation_id)
        reservation.items.update(
            building=None,
            building_number_snapshot=None,
        )

        cancelled = self.client.post(reverse('reservation-cancel', kwargs={'pk': reservation_id}))
        self.assertEqual(cancelled.status_code, 200, cancelled.content)

        rejected = self.client.patch(
            reverse('reservation-detail', kwargs={'pk': reservation_id}),
            {'food_quantity': 2},
            content_type='application/json',
        )
        self.assertEqual(rejected.status_code, 400, rejected.content)
        self.assertIn('building', str(rejected.json()))

        reservation.refresh_from_db()
        self.assertEqual(reservation.status, Reservation.Status.CANCELLED)
        self.assertEqual(reservation.items.count(), 2)

        restored = self.client.patch(
            reverse('reservation-detail', kwargs={'pk': reservation_id}),
            {
                'building': self.building.pk,
                'food_quantity': 2,
            },
            content_type='application/json',
        )
        self.assertEqual(restored.status_code, 200, restored.content)

        reservation.refresh_from_db()
        self.assertEqual(reservation.status, Reservation.Status.RESERVED)
        self.assertEqual(reservation.items.count(), 3)

        items = list(reservation.items.order_by('id'))
        self.assertTrue(all(item.building_id is None for item in items[:2]))
        self.assertTrue(all(item.building_number_snapshot is None for item in items[:2]))

        current_item = items[2]
        self.assertTrue(current_item.is_current)
        self.assertFalse(current_item.is_cancelled)
        self.assertEqual(current_item.food_quantity, 2)
        self.assertEqual(current_item.building_id, self.building.pk)
        self.assertEqual(current_item.building_number_snapshot, '07')
