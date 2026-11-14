from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from unfold.admin import ModelAdmin
from unfold.forms import AdminPasswordChangeForm, UserChangeForm, UserCreationForm

from core.models import Building, CustomUser, Department, Profile, SiteSettings


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin, ModelAdmin):
    form = UserChangeForm
    add_form = UserCreationForm
    change_password_form = AdminPasswordChangeForm

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


@admin.register(SiteSettings)
class SiteSettingsAdmin(ModelAdmin):
    fields = (
        'site_name',
        'site_name_en',
        'site_description',
        'logo',
        'favicon',
    )
    list_display = ('site_name', 'site_name_en')

    def has_module_permission(self, request):
        return request.user.is_active and request.user.is_superuser

    def has_view_permission(self, request, obj=None):
        return request.user.is_active and request.user.is_superuser

    def has_add_permission(self, request):
        return (
            request.user.is_active
            and request.user.is_superuser
            and not SiteSettings.objects.exists()
        )

    def has_change_permission(self, request, obj=None):
        return request.user.is_active and request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return False
