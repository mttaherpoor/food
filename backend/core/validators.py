from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError

from core.models import Building, Department


def validate_reference_number(value: str, *, field_name: str, allow_blank: bool = False) -> str:
    if not isinstance(value, str):
        raise ValidationError({field_name: 'Number must be a string.'})

    number = value.strip()

    if not number and not allow_blank:
        raise ValidationError({field_name: 'This field is required.'})

    if len(number) > 3:
        raise ValidationError({field_name: 'Number must be at most 3 characters.'})

    return number


def validate_building_number(value: str, *, allow_blank: bool = False) -> Building | None:
    number = validate_reference_number(value, field_name='building_number', allow_blank=allow_blank)

    if not number:
        return None

    building = Building.objects.filter(number=number).first()

    if building is None:
        raise ValidationError({'building_number': 'Building does not exist.'})

    if not building.is_active:
        raise ValidationError({'building_number': 'Building is inactive.'})

    return building


def validate_department_number(value: str, *, allow_blank: bool = False) -> Department | None:
    number = validate_reference_number(value, field_name='department_number', allow_blank=allow_blank)

    if not number:
        return None

    department = Department.objects.filter(number=number).first()

    if department is None:
        raise ValidationError({'department_number': 'Department does not exist.'})

    if not department.is_active:
        raise ValidationError({'department_number': 'Department is inactive.'})

    return department


def normalize_personnel_number(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValidationError({'personnel_number': 'Personnel number is required.'})
    return normalized


def validate_new_password(value: str, user) -> str:
    if value == user.username:
        raise ValidationError({'new_password': 'The new password cannot be the personnel number.'})

    try:
        password_validation.validate_password(value, user)
    except ValidationError as exc:
        raise ValidationError({'new_password': list(exc.messages)}) from exc

    return value
