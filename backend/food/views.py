from typing import ClassVar

from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from core.permissions import HasChangedInitialPassword, IsHRFoodOrSuperAdmin
from food.models import Drink, Food, Menu, Side
from food.serializers import DrinkSerializer, FoodSerializer, MenuSerializer, SideSerializer


class CatalogListCreateView(generics.ListCreateAPIView):
    permission_classes: ClassVar[list] = [
        IsAuthenticated,
        HasChangedInitialPassword,
        IsHRFoodOrSuperAdmin,
    ]


class CatalogDetailView(generics.RetrieveUpdateAPIView):
    http_method_names: ClassVar[list] = ['get', 'patch', 'head', 'options']
    permission_classes: ClassVar[list] = [
        IsAuthenticated,
        HasChangedInitialPassword,
        IsHRFoodOrSuperAdmin,
    ]


class FoodListCreateView(CatalogListCreateView):
    queryset = Food.objects.all()
    serializer_class = FoodSerializer


class FoodDetailView(CatalogDetailView):
    queryset = Food.objects.all()
    serializer_class = FoodSerializer


class SideListCreateView(CatalogListCreateView):
    queryset = Side.objects.all()
    serializer_class = SideSerializer


class SideDetailView(CatalogDetailView):
    queryset = Side.objects.all()
    serializer_class = SideSerializer


class DrinkListCreateView(CatalogListCreateView):
    queryset = Drink.objects.all()
    serializer_class = DrinkSerializer


class DrinkDetailView(CatalogDetailView):
    queryset = Drink.objects.all()
    serializer_class = DrinkSerializer


class MenuListCreateView(CatalogListCreateView):
    queryset = Menu.objects.select_related('food').all()
    serializer_class = MenuSerializer


class MenuDetailView(CatalogDetailView):
    queryset = Menu.objects.select_related('food').all()
    serializer_class = MenuSerializer
