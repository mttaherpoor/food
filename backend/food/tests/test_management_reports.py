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

        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[1][1], 'Excel Multi Food')
        self.assertEqual(rows[1][2], 1)
        self.assertEqual(rows[1][4], 2)
        self.assertEqual(rows[1][5], 3_050_000)

        workbook.close()

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
