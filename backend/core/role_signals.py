from django.contrib.auth.models import Group, Permission
from django.db.models.signals import post_migrate
from django.dispatch import receiver

from core.roles import HR_FOOD_CORE_PERMISSIONS, HR_FOOD_ROLE, ROLE_NAMES


@receiver(post_migrate)
def provision_roles(sender, **kwargs) -> None:
    if sender.name != "core":
        return
    groups = {name: Group.objects.get_or_create(name=name)[0] for name in ROLE_NAMES}
    permissions = Permission.objects.filter(
        content_type__app_label="core",
        codename__in=HR_FOOD_CORE_PERMISSIONS,
    )
    groups[HR_FOOD_ROLE].permissions.add(*permissions)
