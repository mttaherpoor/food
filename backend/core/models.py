from django.contrib.auth.models import AbstractUser
from django.db import models


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
    user = models.OneToOneField(CustomUser,on_delete=models.CASCADE,related_name='profile')
    personnel_number = models.CharField(max_length=32, unique=True)

    building = models.ForeignKey(Building, on_delete=models.PROTECT, null=True, blank=True, related_name='profiles')
    department = models.ForeignKey(Department, on_delete=models.PROTECT, null=True, blank=True, related_name='profiles')

    def save(self, *args, **kwargs) -> None:
        # CustomUser.username is the canonical employee identifier.
        self.personnel_number = self.user.username
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.personnel_number
