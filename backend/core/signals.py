from django.db.models.signals import post_save
from django.dispatch import receiver

from core.models import CustomUser, Profile


@receiver(post_save, sender=CustomUser)
def create_or_synchronize_profile(sender, instance: CustomUser, **kwargs) -> None:
    profile, created = Profile.objects.get_or_create(
        user=instance,
        defaults={
            'personnel_number': instance.username,
            'building_number': '',
            'department_number': '',
        },
    )
    if not created and profile.personnel_number != instance.username:
        Profile.objects.filter(pk=profile.pk).update(personnel_number=instance.username)
