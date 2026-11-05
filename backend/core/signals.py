from django.db.models.signals import post_save
from django.dispatch import receiver

from core.models import CustomUser, Profile


@receiver(post_save, sender=CustomUser)
def synchronize_profile_personnel_number(sender, instance: CustomUser, **kwargs) -> None:
    Profile.objects.filter(user=instance).exclude(personnel_number=instance.username).update(
        personnel_number=instance.username
    )
