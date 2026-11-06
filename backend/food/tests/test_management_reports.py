from django.contrib.auth.models import Group
from django.urls import reverse

from datetime import date

import pytest

from core.models import CustomUser
from core.roles import HR_FOOD_ROLE, VIEWER_ROLE
from core.services import create_employee
from food.models import Food, Menu, Reservation, ReservationItem, Side


def create_user_in_group(username: str, group_name: str) -> CustomUser:
    user = CustomUser.objects.create_user(username=username, password='Safe-Test-Password-2026')
    user.groups.add(Group.objects.get(name=group_name))
    return user


@pytest.mark.django_db
def test_viewer_can_read_catalog_but_cannot_change_it(client):
    viewer = create_user_in_group('viewer-001', VIEWER_ROLE)
    Food.objects.create(name='Ghormeh sabzi', price=1_000_000, container_price=100_000)
    client.force_login(viewer)

    read_response = client.get(reverse('food-list'))
    write_response = client.post(
        reverse('food-list'),
        {'name': 'New food', 'price': 10, 'container_price': 1},
    )

    assert read_response.status_code == 200
    assert len(read_response.json()) == 1
    assert write_response.status_code == 403


@pytest.mark.django_db
def test_viewer_can_read_daily_report_with_current_toman_totals(client):
    viewer = create_user_in_group('viewer-002', VIEWER_ROLE)
    employee = create_employee(
        personnel_number='report-001',
        building_number='07',
        department_number='003',
    )
    menu_food = Food.objects.create(name='Ghormeh sabzi', price=1_000_000, container_price=100_000)
    menu = Menu.objects.create(date=date(2099, 1, 2), food=menu_food)
    current_reservation = Reservation.objects.create(user=employee, menu=menu)
    ReservationItem.objects.create(
        reservation=current_reservation,
        food_price=1_100_000,
        side_price=200_000,
        side_quantity=1,
        side=Side.objects.create(name='Salad', price=200_000),
    )
    cancelled_reservation = Reservation.objects.create(
        user=CustomUser.objects.create_user(username='report-002', password='Safe-Test-Password-2026'),
        menu=menu,
        status=Reservation.Status.CANCELLED,
    )
    ReservationItem.objects.create(
        reservation=cancelled_reservation,
        food_price=1_100_000,
        is_cancelled=True,
    )
    client.force_login(viewer)

    response = client.get(reverse('daily-report-list'), {'from': '2099-01-01', 'to': '2099-01-07'})

    assert response.status_code == 200
    assert response.json() == [
        {
            'date': '2099-01-02',
            'food': 'Ghormeh sabzi',
            'reserved_count': 1,
            'cancelled_count': 1,
            'food_quantity': 1,
            'total_toman': 1_300_000,
        }
    ]


@pytest.mark.django_db
def test_employee_cannot_access_management_reports(client):
    employee = create_employee(
        personnel_number='report-003',
        building_number='07',
        department_number='003',
    )
    employee.must_change_password = False
    employee.save(update_fields=('must_change_password',))
    client.force_login(employee)

    response = client.get(reverse('daily-report-list'), {'from': '2099-01-01', 'to': '2099-01-07'})

    assert response.status_code == 403


@pytest.mark.django_db
def test_hr_food_can_read_daily_report(client):
    hr_user = create_user_in_group('hr-report-001', HR_FOOD_ROLE)
    client.force_login(hr_user)

    response = client.get(reverse('daily-report-list'), {'from': '2099-01-01', 'to': '2099-01-07'})

    assert response.status_code == 200


@pytest.mark.django_db
def test_report_rejects_invalid_date_range(client):
    viewer = create_user_in_group('viewer-003', VIEWER_ROLE)
    client.force_login(viewer)

    response = client.get(reverse('daily-report-list'), {'from': '2099-01-07', 'to': '2099-01-01'})

    assert response.status_code == 400
    assert 'to' in response.json()
