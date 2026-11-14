from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models

from typing import ClassVar

from core.validators import validate_brand_image


class CustomUser(AbstractUser):
    """Project user model; employee fields will live in the Profile model."""

    must_change_password = models.BooleanField(default=False)


class Building(models.Model):
    number = models.CharField(max_length=3, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ('number',)

    def __str__(self) -> str:
        return self.number


class Department(models.Model):
    number = models.CharField(max_length=3, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ('number',)

    def __str__(self) -> str:
        return self.number


class Profile(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='profile')
    personnel_number = models.CharField(max_length=32, unique=True)

    building = models.ForeignKey(Building, on_delete=models.PROTECT, null=True, blank=True, related_name='profiles')
    department = models.ForeignKey(Department, on_delete=models.PROTECT, null=True, blank=True, related_name='profiles')

    def save(self, *args, **kwargs) -> None:
        # CustomUser.username is the canonical employee identifier.
        self.personnel_number = self.user.username
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.personnel_number


class SiteSettings(models.Model):
    """Single database-backed configuration for public site branding."""

    site_name = models.CharField(max_length=100, default='فودسک')
    site_name_en = models.CharField(max_length=100, default='Foodesk')
    site_description = models.CharField(
        max_length=255,
        default='سامانه رزرو غذای سازمانی',
    )
    logo = models.ImageField(
        upload_to='branding/logos/',
        blank=True,
        validators=[validate_brand_image],
    )
    favicon = models.ImageField(
        upload_to='branding/favicons/',
        blank=True,
        validators=[validate_brand_image],
    )

    class Meta:
        verbose_name = 'تنظیمات سامانه'
        verbose_name_plural = 'تنظیمات سامانه'
        constraints: ClassVar[list] = [
            models.CheckConstraint(
                condition=models.Q(pk=1),
                name='core_sitesettings_pk_one',
            ),
        ]

    def save(self, *args, **kwargs):
        if self.pk is not None and self.pk != 1:
            raise ValidationError('تنها یک رکورد تنظیمات مجاز است.')

        if self._state.adding and type(self).objects.exists():
            raise ValidationError('رکورد تنظیمات سامانه قبلاً ایجاد شده است.')

        self.pk = 1
        super().save(*args, **kwargs)

    def __str__(self):
        return self.site_name
