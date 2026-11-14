from django.contrib.auth.models import Group
from django.core.exceptions import ValidationError
from django.test import TestCase

from core.models import Building, CustomUser, Department
from core.roles import EMPLOYEE_ROLE
from core.services import create_employee, update_employee


class EmployeeServiceTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        Building.objects.create(number='07', is_active=True)
        Department.objects.create(number='003', is_active=True)

    def create_test_employee(self):
        return create_employee(
            personnel_number='001234',
            building_number='07',
            department_number='003',
        )

    def test_create_employee_uses_personnel_number_for_username_and_password(self):
        employee = self.create_test_employee()

        self.assertEqual(employee.username, '001234')
        self.assertTrue(employee.check_password('001234'))
        self.assertTrue(employee.must_change_password)
        self.assertEqual(employee.profile.personnel_number, '001234')
        self.assertEqual(employee.profile.building.number, '07')
        self.assertEqual(employee.profile.department.number, '003')
        self.assertEqual(employee.first_name, '')
        self.assertEqual(employee.last_name, '')
        self.assertTrue(employee.groups.filter(name=EMPLOYEE_ROLE).exists())

    def test_updating_personnel_number_preserves_existing_password(self):
        employee = self.create_test_employee()

        updated_employee = update_employee(
            employee,
            personnel_number='009876',
        )
        updated_employee.refresh_from_db()

        self.assertEqual(updated_employee.username, '009876')
        self.assertEqual(
            updated_employee.profile.personnel_number,
            '009876',
        )
        self.assertTrue(updated_employee.check_password('001234'))
        self.assertFalse(updated_employee.check_password('009876'))

    def test_update_employee_can_deactivate_account(self):
        employee = self.create_test_employee()

        update_employee(employee, is_active=False)

        employee.refresh_from_db()
        self.assertFalse(employee.is_active)

    def test_create_employee_rolls_back_when_required_profile_data_is_empty(self):
        with self.assertRaises(ValidationError):
            create_employee(
                personnel_number='001234',
                building_number='',
                department_number='003',
            )

        self.assertFalse(CustomUser.objects.filter(username='001234').exists())

    def test_profile_personnel_number_follows_username(self):
        employee = CustomUser.objects.create_user(
            username='001234',
            password='password',
        )
        profile = employee.profile

        self.assertEqual(profile.personnel_number, '001234')
        self.assertIsNone(profile.building)
        self.assertIsNone(profile.department)

        employee.username = '009876'
        employee.save()
        profile.refresh_from_db()

        self.assertEqual(profile.personnel_number, '009876')

    def test_employee_group_is_available(self):
        self.assertTrue(Group.objects.filter(name=EMPLOYEE_ROLE).exists())
