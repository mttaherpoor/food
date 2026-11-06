from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated

from typing import ClassVar

from core.permissions import HasChangedInitialPassword, IsHRFoodOrSuperAdmin
from food.models import Drink, Food, Menu, Side
from food.serializers import DrinkSerializer, FoodSerializer, MenuSerializer, SideSerializer


class CatalogViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    http_method_names: ClassVar[list] = ['get', 'post', 'patch', 'head', 'options']
    permission_classes: ClassVar[list] = [
        IsAuthenticated,
        HasChangedInitialPassword,
        IsHRFoodOrSuperAdmin,
    ]


class FoodViewSet(CatalogViewSet):
    queryset = Food.objects.all()
    serializer_class = FoodSerializer


class SideViewSet(CatalogViewSet):
    queryset = Side.objects.all()
    serializer_class = SideSerializer


class DrinkViewSet(CatalogViewSet):
    queryset = Drink.objects.all()
    serializer_class = DrinkSerializer


class MenuViewSet(CatalogViewSet):
    queryset = Menu.objects.select_related('food').all()
    serializer_class = MenuSerializer
