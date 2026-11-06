from rest_framework.permissions import BasePermission

from core.roles import HR_FOOD_ROLE, VIEWER_ROLE


class HasChangedInitialPassword(BasePermission):
    message = 'You must change your initial password before continuing.'

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and (user.is_superuser or not user.must_change_password))


class IsHRFoodOrSuperAdmin(BasePermission):
    message = 'Only super administrators and hrFood members may manage employees.'

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user and user.is_authenticated and (user.is_superuser or user.groups.filter(name=HR_FOOD_ROLE).exists())
        )


class IsHRFoodViewerOrSuperAdmin(BasePermission):
    message = 'Only super administrators and hrFood members may modify this resource.'

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or user.groups.filter(name=HR_FOOD_ROLE).exists():
            return True
        return bool(request.method in ('GET', 'HEAD', 'OPTIONS') and user.groups.filter(name=VIEWER_ROLE).exists())
