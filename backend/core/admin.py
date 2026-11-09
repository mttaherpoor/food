from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from unfold.admin import ModelAdmin

from core.models import Building, CustomUser, Department, Profile


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin, ModelAdmin):
    fieldsets = (*UserAdmin.fieldsets, ('Initial password', {'fields': ('must_change_password',)}))


@admin.register(Profile)
class ProfileAdmin(ModelAdmin):
    list_display = (
        'personnel_number',
        'user',
        'building',
        'department',
    )
    search_fields = ('personnel_number',)
    list_select_related = ('user', 'building', 'department')


@admin.register(Building)
class BuildingAdmin(ModelAdmin):
    list_display = ('number', 'is_active')
    list_display_links = ('number',)
    list_filter = ('is_active',)
    search_fields = ('number',)
    ordering = ('number',)


@admin.register(Department)
class DepartmentAdmin(ModelAdmin):
    list_display = ('number', 'is_active')
    list_display_links = ('number',)
    list_filter = ('is_active',)
    search_fields = ('number',)
    ordering = ('number',)
