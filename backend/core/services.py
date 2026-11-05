from django.contrib.auth.models import Group
from django.core.exceptions import ValidationError
from django.db import transaction

from core.models import CustomUser, Profile
from core.roles import EMPLOYEE_ROLE

UNSET = object()


def normalize_personnel_number(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValidationError({'personnel_number': 'Personnel number is required.'})
    return normalized


@transaction.atomic
def create_employee(
    *,
    personnel_number: str,
    building_number: str,
    department_number: str,
    first_name: str = '',
    last_name: str = '',
    is_active: bool = True,
) -> CustomUser:
    personnel_number = normalize_personnel_number(personnel_number)
    employee = CustomUser(
        username=personnel_number,
        first_name=first_name.strip(),
        last_name=last_name.strip(),
        is_active=is_active,
        must_change_password=True,
    )
    employee.set_password(personnel_number)
    employee.full_clean()
    employee.save()

    profile = Profile(
        user=employee,
        personnel_number=personnel_number,
        building_number=building_number.strip(),
        department_number=department_number.strip(),
    )
    profile.full_clean()
    profile.save()
    employee.groups.add(Group.objects.get_or_create(name=EMPLOYEE_ROLE)[0])
    return employee


@transaction.atomic
def update_employee(
    employee: CustomUser,
    *,
    personnel_number: str | object = UNSET,
    building_number: str | object = UNSET,
    department_number: str | object = UNSET,
    first_name: str | object = UNSET,
    last_name: str | object = UNSET,
    is_active: bool | object = UNSET,
) -> CustomUser:
    employee = CustomUser.objects.select_for_update().get(pk=employee.pk)
    profile = Profile.objects.select_for_update().get(user=employee)

    if personnel_number is not UNSET:
        employee.username = normalize_personnel_number(str(personnel_number))
    if first_name is not UNSET:
        employee.first_name = str(first_name).strip()
    if last_name is not UNSET:
        employee.last_name = str(last_name).strip()
    if is_active is not UNSET:
        employee.is_active = bool(is_active)

    employee.full_clean()
    employee.save()

    if building_number is not UNSET:
        profile.building_number = str(building_number).strip()
    if department_number is not UNSET:
        profile.department_number = str(department_number).strip()
    profile.personnel_number = employee.username
    profile.full_clean()
    profile.save()
    return employee
