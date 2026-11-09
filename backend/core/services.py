from django.contrib.auth.models import Group
from django.core.exceptions import ValidationError
from django.db import transaction

from core.models import Building, CustomUser, Department, Profile
from core.roles import EMPLOYEE_ROLE
from core.validators import (
    normalize_personnel_number,
    validate_building_number,
    validate_department_number,
)

UNSET = object()

@transaction.atomic
def create_employee(*,personnel_number:str,building_number:str,department_number:str,is_active:bool=True) ->CustomUser:
    personnel_number = normalize_personnel_number(personnel_number)
    building = validate_building_number(building_number)
    department = validate_department_number(department_number)

    employee = CustomUser(username=personnel_number, is_active=is_active, must_change_password=True)

    employee.set_password(personnel_number)
    employee.full_clean()
    employee.save()

    profile = employee.profile
    profile.personnel_number = personnel_number
    profile.building = building
    profile.department = department
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
    is_active: bool | object = UNSET,
) -> CustomUser:

    employee = CustomUser.objects.select_for_update().get(pk=employee.pk)
    profile = Profile.objects.select_for_update().get(user=employee)

    if personnel_number is not UNSET:
        employee.username = normalize_personnel_number(str(personnel_number))
    if is_active is not UNSET:
        employee.is_active = bool(is_active)

    employee.full_clean()
    employee.save()

    if building_number is not UNSET:
        number = str(building_number).strip()
        current_number = profile.building.number if profile.building_id else ''

        if number != current_number:
            profile.building = validate_building_number(number)

    if department_number is not UNSET:
        number = str(department_number).strip()
        current_number = profile.department.number if profile.department_id else ''

        if number != current_number:
            profile.department = validate_department_number(number)

    profile.personnel_number = employee.username
    profile.full_clean()
    profile.save()
    return employee


@transaction.atomic
def update_profile_preferences(
    user: CustomUser,
    *,
    building: Building | object = UNSET,
    department: Department | object = UNSET,
) -> Profile:

    profile = Profile.objects.select_for_update().get(user=user)
    changed_fields = []

    if building is not UNSET:
        if not building.is_active:
            raise ValidationError({'building': 'Building is inactive.'})

        profile.building = building
        changed_fields.append('building')

    if department is not UNSET:
        if not department.is_active:
            raise ValidationError({'department': 'Department is inactive.'})

        profile.department = department
        changed_fields.append('department')

    if changed_fields:
        profile.save(update_fields=changed_fields)

    return profile
