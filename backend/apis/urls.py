from rest_framework.routers import DefaultRouter

from core.views import AuthViewSet, EmployeeViewSet, HealthViewSet
from food.views import DrinkViewSet, FoodViewSet, MenuViewSet, SideViewSet

router = DefaultRouter(trailing_slash=False)
router.register('health', HealthViewSet, basename='health')
router.register('auth', AuthViewSet, basename='auth')
router.register('employees', EmployeeViewSet, basename='employee')
router.register('foods', FoodViewSet, basename='food')
router.register('sides', SideViewSet, basename='side')
router.register('drinks', DrinkViewSet, basename='drink')
router.register('menus', MenuViewSet, basename='menu')

urlpatterns = router.urls
