from django.contrib.auth.models import Group, Permission
from django.db.models.signals import post_migrate
from django.dispatch import receiver

from core.roles import (
    HR_FOOD_CORE_PERMISSIONS,
    HR_FOOD_FOOD_PERMISSIONS,
    HR_FOOD_ROLE,
    ROLE_NAMES,
)


@receiver(post_migrate)
def provision_roles(sender, **kwargs) -> None:
    permission_map = {
        'core': HR_FOOD_CORE_PERMISSIONS,
        'food': HR_FOOD_FOOD_PERMISSIONS,
    }
    if sender.name not in permission_map:
        return
    groups = {name: Group.objects.get_or_create(name=name)[0] for name in ROLE_NAMES}
    permissions = Permission.objects.filter(
        content_type__app_label=sender.name,
        codename__in=permission_map[sender.name],
    )
    groups[HR_FOOD_ROLE].permissions.add(*permissions)
