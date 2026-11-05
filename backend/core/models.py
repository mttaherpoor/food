from django.contrib.auth.models import AbstractUser


class CustomUser(AbstractUser):
    """Project user model; employee fields will live in the Profile model."""
