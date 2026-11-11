from django.contrib.auth.models import Group
from django.test import TestCase
from django.urls import reverse

from datetime import date

from core.models import Building, CustomUser, Department
from core.roles import HR_FOOD_ROLE, VIEWER_ROLE
from core.services import create_employee
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


def create_user_in_group(username: str, group_name: str) -> CustomUser:
    user = CustomUser.objects.create_user(
        username=username,
        password='Safe-Test-Password-2026',
    )
    user.groups.add(Group.objects.get(name=group_name))
    return user


class ManagementReportTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        Building.objects.get_or_create(
            number='07',
            defaults={'is_active': True},
        )
        Department.objects.get_or_create(
            number='003',
            defaults={'is_active': True},
        )

    def test_viewer_can_read_catalog_but_cannot_change_it(self):
        viewer = create_user_in_group('viewer-001', VIEWER_ROLE)
        Food.objects.create(
            name='Ghormeh sabzi',
            price=1_000_000,
            container_price=100_000,
        )
        self.client.force_login(viewer)

        read_response = self.client.get(reverse('food-list'))
        write_response = self.client.post(
            reverse('food-list'),
            {'name': 'New food', 'price': 10, 'container_price': 1},
        )

        self.assertEqual(read_response.status_code, 200)
        self.assertEqual(len(read_response.json()), 1)
        self.assertEqual(write_response.status_code, 403)

    def test_viewer_can_read_daily_report_with_current_toman_totals(self):
        viewer = create_user_in_group('viewer-002', VIEWER_ROLE)
        employee = create_employee(
            personnel_number='report-001',
            building_number='07',
            department_number='003',
        )
        menu_food = Food.objects.create(
            name='Ghormeh sabzi',
            price=1_000_000,
            container_price=100_000,
        )
        menu = Menu.objects.create(date=date(2099, 1, 2), food=menu_food)

        current_reservation = Reservation.objects.create(
            user=employee,
            menu=menu,
        )
        side = Side.objects.create(name='Salad', price=200_000)
        current_item = ReservationItem.objects.create(
            reservation=current_reservation,
            food_price=1_100_000,
            side_price=200_000,
            side_quantity=1,
            side=side,
        )
        ReservationSideItem.objects.create(
            reservation_item=current_item,
            side=side,
            quantity=1,
            unit_price=200_000,
        )

        cancelled_reservation = Reservation.objects.create(
            user=CustomUser.objects.create_user(
                username='report-002',
                password='Safe-Test-Password-2026',
            ),
            menu=menu,
            status=Reservation.Status.CANCELLED,
        )
        ReservationItem.objects.create(
            reservation=cancelled_reservation,
            food_price=1_100_000,
            is_cancelled=True,
        )

        self.client.force_login(viewer)
        response = self.client.get(
            reverse('daily-report-list'),
            {'from': '2099-01-01', 'to': '2099-01-07'},
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json(), [{
            'date': '2099-01-02',
            'food': 'Ghormeh sabzi',
            'reserved_count': 1,
            'cancelled_count': 1,
            'food_quantity': 1,
            'total_toman': 1_300_000,
        }])

    def test_daily_report_multiselect_excludes_history_and_cancellations(self):
        viewer = create_user_in_group('viewer-multi', VIEWER_ROLE)

        employee = create_employee(
            personnel_number='report-multi',
            building_number='07',
            department_number='003',
        )

        food = Food.objects.create(
            name='Multi Food',
            price=1_000_000,
            container_price=100_000,
        )
        menu = Menu.objects.create(date=date(2099, 2, 3), food=food)

        reservation = Reservation.objects.create(
            user=employee,
            menu=menu,
        )

        historical = ReservationItem.objects.create(
            reservation=reservation,
            food_price=9_000_000,
            food_quantity=1,
            is_current=False,
        )

        salad = Side.objects.create(name='Salad Multi', price=200_000)
        yogurt = Side.objects.create(name='Yogurt Multi', price=100_000)
        doogh = Drink.objects.create(name='Doogh Multi', price=150_000)
        cola = Drink.objects.create(name='Cola Multi', price=120_000)

        ReservationSideItem.objects.create(
            reservation_item=historical,
            side=salad,
            quantity=1,
            unit_price=900_000,
        )

        current = ReservationItem.objects.create(
            reservation=reservation,
            food_price=1_100_000,
            food_quantity=2,
            is_current=True,
        )

        for side, quantity in ((salad, 2), (yogurt, 1)):
            ReservationSideItem.objects.create(
                reservation_item=current,
                side=side,
                quantity=quantity,
                unit_price=side.price,
            )

        for drink, quantity in ((doogh, 3), (cola, 2)):
            ReservationDrinkItem.objects.create(
                reservation_item=current,
                drink=drink,
                quantity=quantity,
                unit_price=drink.price,
            )

        cancelled_user = CustomUser.objects.create_user(
            username='report-multi-cancelled',
            password='Safe-Test-Password-2026',
        )
        cancelled_reservation = Reservation.objects.create(
            user=cancelled_user,
            menu=menu,
            status=Reservation.Status.CANCELLED,
        )
        ReservationItem.objects.create(
            reservation=cancelled_reservation,
            food_price=8_000_000,
            is_cancelled=True,
        )

        self.client.force_login(viewer)

        response = self.client.get(
            reverse('daily-report-list'),
            {'from': '2099-02-01', 'to': '2099-02-07'},
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json(), [{
            'date': '2099-02-03',
            'food': 'Multi Food',
            'reserved_count': 1,
            'cancelled_count': 1,
            'food_quantity': 2,
            'total_toman': 3_390_000,
        }])

        self.assertEqual(current.total_price, 3_390_000)
        self.assertEqual(reservation.total_price, 3_390_000)

    def test_excel_export_includes_multiselect_totals(self):
        from io import BytesIO

        from openpyxl import load_workbook

        viewer = create_user_in_group('viewer-excel', VIEWER_ROLE)
        employee = create_employee(
            personnel_number='report-excel',
            building_number='07',
            department_number='003',
        )

        food = Food.objects.create(
            name='Excel Multi Food',
            price=1_000_000,
            container_price=100_000,
        )
        menu = Menu.objects.create(date=date(2099, 2, 3), food=food)
        reservation = Reservation.objects.create(user=employee, menu=menu)

        item = ReservationItem.objects.create(
            reservation=reservation,
            food_price=1_100_000,
            food_quantity=2,
        )

        salad = Side.objects.create(name='Excel Salad', price=200_000)
        doogh = Drink.objects.create(name='Excel Doogh', price=150_000)

        ReservationSideItem.objects.create(
            reservation_item=item,
            side=salad,
            quantity=2,
            unit_price=200_000,
        )
        ReservationDrinkItem.objects.create(
            reservation_item=item,
            drink=doogh,
            quantity=3,
            unit_price=150_000,
        )

        self.client.force_login(viewer)

        response = self.client.get(
            reverse('daily-report-export'),
            {'from': '2099-02-01', 'to': '2099-02-07'},
        )

        self.assertEqual(response.status_code, 200, response.content)

        workbook = load_workbook(BytesIO(response.content), read_only=True)
        sheet = workbook.active
        rows = list(sheet.values)

        from food.jalali import format_jalali_date

        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0][:7], (
            'روز شمسی',
            'شماره ساختمان',
            'کد پرسنلی',
            'شماره دپارتمان',
            'نام غذا',
            'تعداد غذا',
            'قیمت واحد غذا با ظرف (تومان)',
        ))
        self.assertEqual(rows[1], (
            format_jalali_date(date(2099, 2, 3)),
            None,
            'report-excel',
            '003',
            'Excel Multi Food',
            2,
            1_100_000,
            'Excel Doogh',
            3,
            150_000,
            'Excel Salad',
            2,
            200_000,
            3_050_000,
        ))

        workbook.close()

    def test_excel_export_sorting_multiselect_and_snapshots(self):
        from io import BytesIO

        from openpyxl import load_workbook

        from food.jalali import format_jalali_date

        viewer = create_user_in_group('viewer-excel-detail', VIEWER_ROLE)

        building_02, _ = Building.objects.get_or_create(
            number='02',
            defaults={'is_active': True},
        )
        building_07 = Building.objects.get(number='07')

        food = Food.objects.create(
            name='Detailed Excel Food',
            price=1_000_000,
            container_price=100_000,
        )
        first_day = Menu.objects.create(
            date=date(2099, 3, 1),
            food=food,
        )
        second_day = Menu.objects.create(
            date=date(2099, 3, 2),
            food=food,
        )

        employees = {
            number: create_employee(
                personnel_number=number,
                building_number='07',
                department_number='003',
            )
            for number in ('0010', '0002', '0001', '0099')
        }

        def reserve(number, menu, building, snapshot):
            reservation = Reservation.objects.create(
                user=employees[number],
                menu=menu,
            )
            item = ReservationItem.objects.create(
                reservation=reservation,
                building=building,
                building_number_snapshot=snapshot,
                food_price=1_100_000,
                food_quantity=2,
            )
            return reservation, item

        # Deliberately create records in an order different
        # from the required Excel sorting order.
        _, later_item = reserve(
            '0001', second_day, building_02, '02',
        )
        _, high_number_item = reserve(
            '0010', first_day, building_07, '07',
        )
        _, low_number_item = reserve(
            '0002', first_day, building_07, '07',
        )

        # The snapshot must win over the employee's profile
        # and the referenced Building when applicable.
        low_number_item.building_number_snapshot = '02'
        low_number_item.save(
            update_fields=['building_number_snapshot'],
        )

        # A historical revision must never be exported.
        ReservationItem.objects.filter(
            pk=high_number_item.pk,
        ).update(is_current=False)
        ReservationItem.objects.create(
            reservation=high_number_item.reservation,
            building=building_07,
            building_number_snapshot='07',
            food_price=1_100_000,
            food_quantity=2,
            is_current=True,
        )

        # A cancelled reservation must not appear.
        cancelled = Reservation.objects.create(
            user=employees['0099'],
            menu=first_day,
            status=Reservation.Status.CANCELLED,
        )
        ReservationItem.objects.create(
            reservation=cancelled,
            building=building_07,
            building_number_snapshot='07',
            food_price=1_100_000,
            is_cancelled=True,
        )

        drink_1 = Drink.objects.create(
            name='Drink A',
            price=900_000,
        )
        drink_2 = Drink.objects.create(
            name='Drink B',
            price=900_000,
        )
        side_1 = Side.objects.create(
            name='Side A',
            price=900_000,
        )
        side_2 = Side.objects.create(
            name='Side B',
            price=900_000,
        )

        for drink, quantity, price in (
            (drink_1, 2, 150_000),
            (drink_2, 1, 120_000),
        ):
            ReservationDrinkItem.objects.create(
                reservation_item=low_number_item,
                drink=drink,
                quantity=quantity,
                unit_price=price,
            )

        for side, quantity, price in (
            (side_1, 3, 100_000),
            (side_2, 1, 200_000),
        ):
            ReservationSideItem.objects.create(
                reservation_item=low_number_item,
                side=side,
                quantity=quantity,
                unit_price=price,
            )

        # Change catalog prices after reservation snapshots.
        # The exported values must remain unchanged.
        food.price = 9_000_000
        food.save(update_fields=['price', 'datetime_modified'])

        self.client.force_login(viewer)
        response = self.client.get(
            reverse('daily-report-export'),
            {'from': '2099-03-01', 'to': '2099-03-02'},
        )

        self.assertEqual(response.status_code, 200, response.content)

        workbook = load_workbook(BytesIO(response.content))
        sheet = workbook.active
        rows = list(sheet.values)

        # Header + exactly three active current reservations.
        self.assertEqual(len(rows), 4)
        self.assertEqual(sheet.freeze_panes, 'A2')
        self.assertTrue(sheet.sheet_view.rightToLeft)

        self.assertEqual(
            [(row[0], row[1], row[2]) for row in rows[1:]],
            [
                (format_jalali_date(first_day.date), '02', '0002'),
                (format_jalali_date(first_day.date), '07', '0010'),
                (format_jalali_date(second_day.date), '02', '0001'),
            ],
        )

        headers = rows[0]
        first = rows[1]

        self.assertEqual(first[3], '003')
        self.assertEqual(first[4], 'Detailed Excel Food')
        self.assertEqual(first[5], 2)
        self.assertEqual(first[6], 1_100_000)

        self.assertEqual(
            first[7:13],
            ('Drink A', 2, 150_000, 'Drink B', 1, 120_000),
        )
        self.assertEqual(
            first[13:19],
            ('Side A', 3, 100_000, 'Side B', 1, 200_000),
        )
        self.assertEqual(headers[-1], 'قیمت کل (تومان)')

        expected_total = (
            2 * 1_100_000
            + 2 * 150_000
            + 1 * 120_000
            + 3 * 100_000
            + 1 * 200_000
        )
        self.assertEqual(first[-1], expected_total)

        # The identifiers must remain text to preserve leading zeros.
        for column in (2, 3, 4):
            self.assertEqual(sheet.cell(2, column).data_type, 's')
            self.assertEqual(
                sheet.cell(2, column).number_format,
                '@',
            )

        # Unused optional columns remain blank.
        self.assertEqual(rows[2][7:19], (None,) * 12)

        workbook.close()


    def test_buildings_report_groups_active_reservations_by_day(self):
        viewer = create_user_in_group('viewer-buildings', VIEWER_ROLE)

        building_02, _ = Building.objects.get_or_create(
            number='02',
            defaults={'is_active': True},
        )
        building_07 = Building.objects.get(number='07')

        employees = {
            number: create_employee(
                personnel_number=number,
                building_number='07',
                department_number='003',
            )
            for number in ('b-001', 'b-002', 'b-003', 'b-004')
        }

        food = Food.objects.create(
            name='Building Report Food',
            price=100_000,
            container_price=10_000,
        )

        day_1 = Menu.objects.create(
            date=date(2099, 4, 1),
            food=food,
        )
        day_2 = Menu.objects.create(
            date=date(2099, 4, 2),
            food=food,
        )

        def add_reservation(
            person, menu, building, snapshot, quantity,
            *, cancelled=False,
        ):
            reservation = Reservation.objects.create(
                user=employees[person],
                menu=menu,
                status=(
                    Reservation.Status.CANCELLED
                    if cancelled else Reservation.Status.RESERVED
                ),
            )
            item = ReservationItem.objects.create(
                reservation=reservation,
                building=building,
                building_number_snapshot=snapshot,
                food_price=110_000,
                food_quantity=quantity,
                is_cancelled=cancelled,
            )
            return reservation, item

        # Database insertion order is deliberately different
        # from the required building order.
        reservation_07, _ = add_reservation(
            'b-002', day_1, building_07, '07', 1,
        )

        # The saved building snapshot must take priority.
        add_reservation(
            'b-001', day_1, building_07, '02', 2,
        )
        add_reservation(
            'b-003', day_1, building_02, '02', 3,
        )
        add_reservation(
            'b-001', day_2, building_07, '07', 2,
        )

        # Legacy reservation without a delivery building.
        add_reservation(
            'b-004', day_1, None, None, 1,
        )

        # Cancelled reservation must be excluded.
        add_reservation(
            'b-003', day_2, building_02, '02', 8,
            cancelled=True,
        )

        # Historical revisions must not be counted twice.
        ReservationItem.objects.create(
            reservation=reservation_07,
            building=building_02,
            building_number_snapshot='02',
            food_price=110_000,
            food_quantity=9,
            is_current=False,
        )

        self.client.force_login(viewer)

        response = self.client.get(
            reverse('daily-report-buildings'),
            {'from': '2099-04-01', 'to': '2099-04-02'},
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json(), {
            'buildings': [
                {
                    'building_number': '02',
                    'reserved_count': 2,
                    'days': [
                        {
                            'date': '2099-04-01',
                            'food': 'Building Report Food',
                            'reserved_count': 2,
                            'food_quantity': 5,
                        },
                    ],
                },
                {
                    'building_number': '07',
                    'reserved_count': 2,
                    'days': [
                        {
                            'date': '2099-04-01',
                            'food': 'Building Report Food',
                            'reserved_count': 1,
                            'food_quantity': 1,
                        },
                        {
                            'date': '2099-04-02',
                            'food': 'Building Report Food',
                            'reserved_count': 1,
                            'food_quantity': 2,
                        },
                    ],
                },
            ],
        })

    def test_buildings_report_rejects_invalid_range(self):
        viewer = create_user_in_group('viewer-buildings-invalid', VIEWER_ROLE)
        self.client.force_login(viewer)

        response = self.client.get(
            reverse('daily-report-buildings'),
            {'from': '2099-04-02', 'to': '2099-04-01'},
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('to', response.json())

    def test_employee_cannot_access_buildings_report(self):
        employee = create_employee(
            personnel_number='buildings-denied',
            building_number='07',
            department_number='003',
        )
        employee.must_change_password = False
        employee.save(update_fields=['must_change_password'])

        self.client.force_login(employee)

        response = self.client.get(
            reverse('daily-report-buildings'),
            {'from': '2099-04-01', 'to': '2099-04-02'},
        )

        self.assertEqual(response.status_code, 403)

    def test_employee_cannot_access_management_reports(self):
        employee = create_employee(
            personnel_number='report-003',
            building_number='07',
            department_number='003',
        )
        employee.must_change_password = False
        employee.save(update_fields=('must_change_password',))
        self.client.force_login(employee)

        response = self.client.get(
            reverse('daily-report-list'),
            {'from': '2099-01-01', 'to': '2099-01-07'},
        )
        self.assertEqual(response.status_code, 403)

    def test_hr_food_can_read_daily_report(self):
        hr_user = create_user_in_group('hr-report-001', HR_FOOD_ROLE)
        self.client.force_login(hr_user)

        response = self.client.get(
            reverse('daily-report-list'),
            {'from': '2099-01-01', 'to': '2099-01-07'},
        )
        self.assertEqual(response.status_code, 200)

    def test_report_rejects_invalid_date_range(self):
        viewer = create_user_in_group('viewer-003', VIEWER_ROLE)
        self.client.force_login(viewer)

        response = self.client.get(
            reverse('daily-report-list'),
            {'from': '2099-01-07', 'to': '2099-01-01'},
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('to', response.json())
