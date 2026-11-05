from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from unfold.admin import ModelAdmin

from core.models import CustomUser


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin, ModelAdmin): ...
