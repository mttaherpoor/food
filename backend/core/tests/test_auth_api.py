from django.test import Client
from django.urls import reverse

import json

import pytest

from core.services import create_employee


@pytest.mark.django_db
def test_login_requires_csrf_and_returns_password_change_state():
    create_employee(
        personnel_number='001234',
        building_number='07',
        department_number='003',
    )
    csrf_client = Client(enforce_csrf_checks=True)
    payload = {'username': '001234', 'password': '001234'}

    rejected_response = csrf_client.post(
        reverse('auth-login'),
        data=json.dumps(payload),
        content_type='application/json',
    )
    assert rejected_response.status_code == 403

    csrf_response = csrf_client.get(reverse('auth-csrf'))
    login_response = csrf_client.post(
        reverse('auth-login'),
        data=json.dumps(payload),
        content_type='application/json',
        HTTP_X_CSRFTOKEN=csrf_response.json()['csrf_token'],
    )

    assert login_response.status_code == 200
    assert login_response.json()['must_change_password'] is True


@pytest.mark.django_db
def test_initial_password_blocks_business_api_but_not_session(client):
    employee = create_employee(
        personnel_number='001234',
        building_number='07',
        department_number='003',
    )
    client.force_login(employee)

    session_response = client.get(reverse('auth-session'))
    restricted_response = client.get(reverse('employee-list'))

    assert session_response.status_code == 200
    assert restricted_response.status_code == 403
    assert 'change your initial password' in restricted_response.json()['detail']


@pytest.mark.django_db
def test_employee_can_change_initial_password_and_keep_session(client):
    employee = create_employee(
        personnel_number='001234',
        building_number='07',
        department_number='003',
    )
    client.force_login(employee)

    response = client.post(
        reverse('auth-change-password'),
        {
            'old_password': '001234',
            'new_password': 'Safer-Meal-Password-2026',
            'new_password_confirm': 'Safer-Meal-Password-2026',
        },
    )

    assert response.status_code == 200
    employee.refresh_from_db()
    assert employee.must_change_password is False
    assert employee.check_password('Safer-Meal-Password-2026')
    assert client.get(reverse('auth-session')).status_code == 200


@pytest.mark.django_db
def test_new_password_cannot_equal_personnel_number(client):
    employee = create_employee(
        personnel_number='001234',
        building_number='07',
        department_number='003',
    )
    client.force_login(employee)

    response = client.post(
        reverse('auth-change-password'),
        {
            'old_password': '001234',
            'new_password': '001234',
            'new_password_confirm': '001234',
        },
    )

    assert response.status_code == 400
    assert 'new_password' in response.json()


@pytest.mark.django_db
def test_logout_ends_session(client):
    employee = create_employee(
        personnel_number='001234',
        building_number='07',
        department_number='003',
    )
    client.force_login(employee)

    assert client.post(reverse('auth-logout')).status_code == 204
    assert client.get(reverse('auth-session')).status_code in {401, 403}
