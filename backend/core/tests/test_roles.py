from django.contrib.auth.models import Group
from django.test import TestCase

from core.roles import (
    EMPLOYEE_ROLE,
    HR_FOOD_CORE_PERMISSIONS,
    HR_FOOD_FOOD_PERMISSIONS,
    HR_FOOD_ROLE,
    VIEWER_FOOD_PERMISSIONS,
    VIEWER_ROLE,
)


class RolesTests(TestCase):

    def test_required_groups_are_provisioned(self):
        assert set(
            Group.objects.filter(name__in=(HR_FOOD_ROLE, EMPLOYEE_ROLE, VIEWER_ROLE)).values_list('name', flat=True)
        ) == {HR_FOOD_ROLE, EMPLOYEE_ROLE, VIEWER_ROLE}

    def test_hr_food_receives_only_current_core_management_permissions(self):
        hr_food = Group.objects.get(name=HR_FOOD_ROLE)
        permission_codes = set(
            hr_food.permissions.filter(content_type__app_label='core').values_list('codename', flat=True)
        )

        assert permission_codes == set(HR_FOOD_CORE_PERMISSIONS)

    def test_hr_food_receives_food_management_permissions(self):
        hr_food = Group.objects.get(name=HR_FOOD_ROLE)
        permission_codes = set(
            hr_food.permissions.filter(content_type__app_label='food').values_list('codename', flat=True)
        )

        assert permission_codes == set(HR_FOOD_FOOD_PERMISSIONS)

    def test_viewer_receives_read_only_food_permissions(self):
        viewer = Group.objects.get(name=VIEWER_ROLE)
        permission_codes = set(viewer.permissions.filter(content_type__app_label='food').values_list('codename', flat=True))

        assert permission_codes == set(VIEWER_FOOD_PERMISSIONS)
