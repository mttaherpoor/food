from django.test import Client, TestCase
from django.urls import reverse

import json

from core.models import Building, Department
from core.services import create_employee


class AuthenticationAPITests(TestCase):
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

    def test_login_requires_csrf_and_returns_password_change_state(self):
        self.create_test_employee()

        csrf_client = Client(enforce_csrf_checks=True)
        payload = {'username': '001234', 'password': '001234'}

        rejected_response = csrf_client.post(
            reverse('auth-login'),
            data=json.dumps(payload),
            content_type='application/json',
        )
        self.assertEqual(rejected_response.status_code, 403)

        csrf_response = csrf_client.get(reverse('auth-csrf'))
        login_response = csrf_client.post(
            reverse('auth-login'),
            data=json.dumps(payload),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf_response.json()['csrf_token'],
        )

        self.assertEqual(login_response.status_code, 200)
        self.assertTrue(login_response.json()['must_change_password'])

    def test_initial_password_blocks_business_api_but_not_session(self):
        employee = self.create_test_employee()
        self.client.force_login(employee)

        session_response = self.client.get(reverse('auth-session'))
        restricted_response = self.client.get(reverse('employee-list'))

        self.assertEqual(session_response.status_code, 200)
        self.assertEqual(restricted_response.status_code, 403)
        self.assertIn(
            'change your initial password',
            restricted_response.json()['detail'],
        )

    def test_employee_can_change_initial_password_and_keep_session(self):
        employee = self.create_test_employee()
        self.client.force_login(employee)

        response = self.client.post(
            reverse('auth-change-password'),
            {
                'old_password': '001234',
                'new_password': 'Safer-Meal-Password-2026',
                'new_password_confirm': 'Safer-Meal-Password-2026',
            },
        )

        self.assertEqual(response.status_code, 200)

        employee.refresh_from_db()
        self.assertFalse(employee.must_change_password)
        self.assertTrue(employee.check_password('Safer-Meal-Password-2026'))
        self.assertEqual(
            self.client.get(reverse('auth-session')).status_code,
            200,
        )

    def test_new_password_cannot_equal_personnel_number(self):
        employee = self.create_test_employee()
        self.client.force_login(employee)

        response = self.client.post(
            reverse('auth-change-password'),
            {
                'old_password': '001234',
                'new_password': '001234',
                'new_password_confirm': '001234',
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('new_password', response.json())

    def test_logout_ends_session(self):
        employee = self.create_test_employee()
        self.client.force_login(employee)

        response = self.client.post(reverse('auth-logout'))
        self.assertEqual(response.status_code, 204)

        session_response = self.client.get(reverse('auth-session'))
        self.assertEqual(session_response.status_code, 200)
        self.assertEqual(
            session_response.json(),
            {'authenticated': False},
        )
