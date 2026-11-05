import pytest
from django.contrib.auth.models import Group
from django.core.exceptions import ValidationError

from core.models import CustomUser, Profile
from core.roles import EMPLOYEE_ROLE
from core.services import create_employee, update_employee


@pytest.mark.django_db
def test_create_employee_uses_personnel_number_for_username_and_password():
    employee = create_employee(
        personnel_number="001234",
        building_number="07",
        department_number="003",
        first_name="Taher",
        last_name="Poor",
    )

    assert employee.username == "001234"
    assert employee.check_password("001234")
    assert employee.must_change_password is True
    assert employee.profile.personnel_number == "001234"
    assert employee.profile.building_number == "07"
    assert employee.profile.department_number == "003"
    assert employee.groups.filter(name=EMPLOYEE_ROLE).exists()


@pytest.mark.django_db
def test_updating_personnel_number_preserves_existing_password():
    employee = create_employee(
        personnel_number="001234",
        building_number="07",
        department_number="003",
    )

    updated_employee = update_employee(employee, personnel_number="009876")
    updated_employee.refresh_from_db()

    assert updated_employee.username == "009876"
    assert updated_employee.profile.personnel_number == "009876"
    assert updated_employee.check_password("001234")
    assert not updated_employee.check_password("009876")


@pytest.mark.django_db
def test_update_employee_can_deactivate_account():
    employee = create_employee(
        personnel_number="001234",
        building_number="07",
        department_number="003",
    )

    update_employee(employee, is_active=False)

    employee.refresh_from_db()
    assert employee.is_active is False


@pytest.mark.django_db
def test_create_employee_rolls_back_when_required_profile_data_is_empty():
    with pytest.raises(ValidationError):
        create_employee(
            personnel_number="001234",
            building_number="",
            department_number="003",
        )

    assert not CustomUser.objects.filter(username="001234").exists()


@pytest.mark.django_db
def test_profile_personnel_number_follows_username():
    employee = CustomUser.objects.create_user(username="001234", password="password")
    profile = Profile.objects.create(
        user=employee,
        personnel_number="different-value",
        building_number="07",
        department_number="003",
    )

    assert profile.personnel_number == "001234"

    employee.username = "009876"
    employee.save()
    profile.refresh_from_db()

    assert profile.personnel_number == "009876"


@pytest.mark.django_db
def test_employee_group_is_available():
    assert Group.objects.filter(name=EMPLOYEE_ROLE).exists()
