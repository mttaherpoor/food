from django.contrib.auth.models import Group
from django.test import TestCase
from django.urls import reverse

from core.models import Building, CustomUser, Department
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


class FoodAPITests(TestCase):

    def test_hr_food_can_create_food_but_cannot_supply_total_price(self):
        self.client.force_login(create_hr_food_user())

        response = self.client.post(
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

    def test_hr_food_can_create_side_and_drink(self):
        self.client.force_login(create_hr_food_user())

        side_response = self.client.post(reverse('side-list'), {'name': 'Salad', 'price': 200_000})
        drink_response = self.client.post(reverse('drink-list'), {'name': 'Doogh', 'price': 150_000})

        assert side_response.status_code == 201
        assert drink_response.status_code == 201

    def test_menu_defaults_to_available_and_exposes_food_name(self):
        self.client.force_login(create_hr_food_user())
        food = Food.objects.create(name='Ghormeh sabzi', price=1_000_000, container_price=100_000)

        response = self.client.post(
            reverse('menu-list'),
            {'date': '2026-11-05', 'food': food.pk},
        )

        assert response.status_code == 201
        assert response.json()['status'] == MenuStatus.AVAILABLE
        assert response.json()['food_name'] == 'Ghormeh sabzi'

    def test_menu_rejects_unknown_status(self):
        self.client.force_login(create_hr_food_user())
        food = Food.objects.create(name='Ghormeh sabzi', price=1_000_000, container_price=100_000)

        response = self.client.post(
            reverse('menu-list'),
            {'date': '2026-11-05', 'food': food.pk, 'status': 'bad'},
        )

        assert response.status_code == 400
        assert 'status' in response.json()

    def test_catalog_rejects_negative_price(self):
        self.client.force_login(create_hr_food_user())

        response = self.client.post(
            reverse('food-list'),
            {'name': 'Invalid food', 'price': -1, 'container_price': 100_000},
        )

        assert response.status_code == 400
        assert 'price' in response.json()

    def test_employee_can_read_catalog_but_cannot_manage_it(self):
        Building.objects.get_or_create(
            number='07',
            defaults={'is_active': True},
        )
        Department.objects.get_or_create(
            number='003',
            defaults={'is_active': True},
        )

        employee = create_employee(
            personnel_number='001234',
            building_number='07',
            department_number='003',
        )
        employee.must_change_password = False
        employee.save(update_fields=('must_change_password',))
        self.client.force_login(employee)

        read_response = self.client.get(reverse('food-list'))
        write_response = self.client.post(
            reverse('food-list'),
            {'name': 'New food', 'price': 10, 'container_price': 1},
        )

        assert read_response.status_code == 200
        assert write_response.status_code == 403
