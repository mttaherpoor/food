from django.contrib.auth.models import Group
from django.test import TestCase
from django.urls import reverse

from core.models import Building, CustomUser, Department
from core.roles import HR_FOOD_ROLE
from core.services import create_employee


def create_hr_food_user() -> CustomUser:
    user = CustomUser.objects.create_user(
        username='hr-001',
        password='Admin-Safe-Password-2026',
        is_staff=True,
    )
    user.groups.add(Group.objects.get(name=HR_FOOD_ROLE))
    return user


class EmployeeAPITests(TestCase):
    @classmethod
    def setUpTestData(cls):
        for number in ('07', '08'):
            Building.objects.create(number=number, is_active=True)

        for number in ('003', '004'):
            Department.objects.create(number=number, is_active=True)

    def create_test_employee(self):
        return create_employee(
            personnel_number='001234',
            building_number='07',
            department_number='003',
        )

    def test_hr_food_can_create_employee_with_initial_password(self):
        self.client.force_login(create_hr_food_user())

        response = self.client.post(
            reverse('employee-list'),
            {
                'personnel_number': '001234',
                'building_number': '07',
                'department_number': '003',
            },
        )

        self.assertEqual(response.status_code, 201, response.content)

        employee = CustomUser.objects.get(username='001234')
        self.assertTrue(employee.check_password('001234'))
        self.assertTrue(employee.must_change_password)
        self.assertEqual(employee.first_name, '')
        self.assertEqual(employee.last_name, '')

        data = response.json()
        self.assertEqual(data['personnel_number'], '001234')
        self.assertEqual(data['first_name'], '')
        self.assertEqual(data['last_name'], '')

    def test_hr_food_can_edit_and_deactivate_employee_without_resetting_password(self):
        hr_food = create_hr_food_user()
        employee = self.create_test_employee()
        self.client.force_login(hr_food)

        response = self.client.patch(
            reverse('employee-detail', kwargs={'pk': employee.pk}),
            {
                'personnel_number': '009876',
                'building_number': '08',
                'is_active': False,
            },
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200, response.content)

        employee.refresh_from_db()
        self.assertEqual(employee.username, '009876')
        self.assertEqual(employee.profile.building.number, '08')
        self.assertFalse(employee.is_active)
        self.assertTrue(employee.check_password('001234'))

    def test_employee_cannot_access_employee_management(self):
        employee = self.create_test_employee()
        employee.must_change_password = False
        employee.save(update_fields=('must_change_password',))
        self.client.force_login(employee)

        response = self.client.get(reverse('employee-list'))

        self.assertEqual(response.status_code, 403)

    def test_duplicate_personnel_number_returns_validation_error(self):
        self.client.force_login(create_hr_food_user())
        self.create_test_employee()

        response = self.client.post(
            reverse('employee-list'),
            {
                'personnel_number': '001234',
                'building_number': '08',
                'department_number': '004',
            },
        )

        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('personnel_number', response.json())
