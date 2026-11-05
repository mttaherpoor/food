from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from unfold.admin import ModelAdmin

from core.models import CustomUser, Profile


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin, ModelAdmin): ...


@admin.register(Profile)
class ProfileAdmin(ModelAdmin):
    list_display = (
        "personnel_number",
        "user",
        "building_number",
        "department_number",
    )
    search_fields = (
        "personnel_number",
        "user__first_name",
        "user__last_name",
    )
    list_select_related = ("user",)
