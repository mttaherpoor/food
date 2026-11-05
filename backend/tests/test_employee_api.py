import pytest
from django.contrib.auth.models import Group
from django.urls import reverse

from core.models import CustomUser
from core.roles import HR_FOOD_ROLE
from core.services import create_employee


def create_hr_food_user() -> CustomUser:
    user = CustomUser.objects.create_user(
        username="hr-001",
        password="Admin-Safe-Password-2026",
        is_staff=True,
    )
    user.groups.add(Group.objects.get(name=HR_FOOD_ROLE))
    return user


@pytest.mark.django_db
def test_hr_food_can_create_employee_with_initial_password(client):
    client.force_login(create_hr_food_user())

    response = client.post(
        reverse("employee-list"),
        {
            "personnel_number": "001234",
            "first_name": "Taher",
            "last_name": "Poor",
            "building_number": "07",
            "department_number": "003",
        },
    )

    assert response.status_code == 201
    employee = CustomUser.objects.get(username="001234")
    assert employee.check_password("001234")
    assert employee.must_change_password is True
    assert response.json()["personnel_number"] == "001234"


@pytest.mark.django_db
def test_hr_food_can_edit_and_deactivate_employee_without_resetting_password(client):
    hr_food = create_hr_food_user()
    employee = create_employee(
        personnel_number="001234",
        building_number="07",
        department_number="003",
    )
    client.force_login(hr_food)

    response = client.patch(
        reverse("employee-detail", kwargs={"pk": employee.pk}),
        {
            "personnel_number": "009876",
            "building_number": "08",
            "is_active": False,
        },
        content_type="application/json",
    )

    assert response.status_code == 200
    employee.refresh_from_db()
    assert employee.username == "009876"
    assert employee.profile.building_number == "08"
    assert employee.is_active is False
    assert employee.check_password("001234")


@pytest.mark.django_db
def test_employee_cannot_access_employee_management(client):
    employee = create_employee(
        personnel_number="001234",
        building_number="07",
        department_number="003",
    )
    employee.must_change_password = False
    employee.save(update_fields=("must_change_password",))
    client.force_login(employee)

    response = client.get(reverse("employee-list"))

    assert response.status_code == 403


@pytest.mark.django_db
def test_duplicate_personnel_number_returns_validation_error(client):
    client.force_login(create_hr_food_user())
    create_employee(
        personnel_number="001234",
        building_number="07",
        department_number="003",
    )

    response = client.post(
        reverse("employee-list"),
        {
            "personnel_number": "001234",
            "building_number": "08",
            "department_number": "004",
        },
    )

    assert response.status_code == 400
    assert "personnel_number" in response.json()
