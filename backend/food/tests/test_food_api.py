from django.contrib.auth.models import Group
from django.urls import reverse

import pytest

from core.models import CustomUser
from core.roles import HR_FOOD_ROLE
from core.services import create_employee
from food.models import Food, MenuStatus


def create_hr_food_user() -> CustomUser:
    user = CustomUser.objects.create_user(
        username='hr-food-api',
        password='Admin-Safe-Password-2026',
        is_staff=True,
    )
    user.groups.add(Group.objects.get(name=HR_FOOD_ROLE))
    return user


@pytest.mark.django_db
def test_hr_food_can_create_food_but_cannot_supply_total_price(client):
    client.force_login(create_hr_food_user())

    response = client.post(
        reverse('food-list'),
        {
            'name': 'Ghormeh sabzi',
            'price': 1_000_000,
            'container_price': 100_000,
            'total_price': 1,
        },
    )

    assert response.status_code == 201
    assert response.json()['total_price'] == 1_100_000
    assert Food.objects.get().total_price == 1_100_000


@pytest.mark.django_db
def test_hr_food_can_create_side_and_drink(client):
    client.force_login(create_hr_food_user())

    side_response = client.post(reverse('side-list'), {'name': 'Salad', 'price': 200_000})
    drink_response = client.post(reverse('drink-list'), {'name': 'Doogh', 'price': 150_000})

    assert side_response.status_code == 201
    assert drink_response.status_code == 201


@pytest.mark.django_db
def test_menu_defaults_to_available_and_exposes_food_name(client):
    client.force_login(create_hr_food_user())
    food = Food.objects.create(name='Ghormeh sabzi', price=1_000_000, container_price=100_000)

    response = client.post(
        reverse('menu-list'),
        {'date': '2026-11-05', 'food': food.pk},
    )

    assert response.status_code == 201
    assert response.json()['status'] == MenuStatus.AVAILABLE
    assert response.json()['food_name'] == 'Ghormeh sabzi'


@pytest.mark.django_db
def test_menu_rejects_unknown_status(client):
    client.force_login(create_hr_food_user())
    food = Food.objects.create(name='Ghormeh sabzi', price=1_000_000, container_price=100_000)

    response = client.post(
        reverse('menu-list'),
        {'date': '2026-11-05', 'food': food.pk, 'status': 'bad'},
    )

    assert response.status_code == 400
    assert 'status' in response.json()


@pytest.mark.django_db
def test_catalog_rejects_negative_price(client):
    client.force_login(create_hr_food_user())

    response = client.post(
        reverse('food-list'),
        {'name': 'Invalid food', 'price': -1, 'container_price': 100_000},
    )

    assert response.status_code == 400
    assert 'price' in response.json()


@pytest.mark.django_db
def test_employee_can_read_catalog_but_cannot_manage_it(client):
    employee = create_employee(
        personnel_number='001234',
        building_number='07',
        department_number='003',
    )
    employee.must_change_password = False
    employee.save(update_fields=('must_change_password',))
    client.force_login(employee)

    read_response = client.get(reverse('food-list'))
    write_response = client.post(
        reverse('food-list'),
        {'name': 'New food', 'price': 10, 'container_price': 1},
    )

    assert read_response.status_code == 200
    assert write_response.status_code == 403
