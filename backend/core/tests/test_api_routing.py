from django.urls import reverse

import pytest


@pytest.mark.parametrize(
    ('url_name', 'expected_path'),
    [
        ('api-root', '/api/v1/'),
        ('food-list', '/api/v1/foods'),
        ('side-list', '/api/v1/sides'),
        ('drink-list', '/api/v1/drinks'),
        ('menu-list', '/api/v1/menus'),
        ('employee-list', '/api/v1/employees'),
        ('auth-login', '/api/v1/auth/login'),
        ('auth-logout', '/api/v1/auth/logout'),
        ('auth-session', '/api/v1/auth/session'),
        ('auth-csrf', '/api/v1/auth/csrf'),
        ('auth-change-password', '/api/v1/auth/change-password'),
        ('health-list', '/api/v1/health'),
        ('api-schema', '/api/v1/schema'),
        ('api-docs', '/api/v1/docs'),
    ],
)
def test_api_routes_are_versioned_without_endpoint_trailing_slashes(url_name, expected_path):
    assert reverse(url_name) == expected_path


@pytest.mark.django_db
def test_legacy_food_route_is_removed(client):
    assert client.get('/api/food/foods/').status_code == 404
