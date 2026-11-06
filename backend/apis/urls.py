from rest_framework.routers import DefaultRouter

from core.views import AuthViewSet, EmployeeViewSet, HealthViewSet
from food.views import DailyReportViewSet, DrinkViewSet, FoodViewSet, MenuViewSet, ReservationViewSet, SideViewSet

router = DefaultRouter(trailing_slash=False)
router.register('health', HealthViewSet, basename='health')
router.register('auth', AuthViewSet, basename='auth')
router.register('employees', EmployeeViewSet, basename='employee')
router.register('foods', FoodViewSet, basename='food')
router.register('sides', SideViewSet, basename='side')
router.register('drinks', DrinkViewSet, basename='drink')
router.register('menus', MenuViewSet, basename='menu')
router.register('reservations', ReservationViewSet, basename='reservation')
router.register('reports/daily', DailyReportViewSet, basename='daily-report')

urlpatterns = router.urls
