from django.urls import path

from food.views import (
    DrinkDetailView,
    DrinkListCreateView,
    FoodDetailView,
    FoodListCreateView,
    MenuDetailView,
    MenuListCreateView,
    SideDetailView,
    SideListCreateView,
)

urlpatterns = [
    path('foods/', FoodListCreateView.as_view(), name='food-list'),
    path('foods/<int:pk>/', FoodDetailView.as_view(), name='food-detail'),
    path('sides/', SideListCreateView.as_view(), name='side-list'),
    path('sides/<int:pk>/', SideDetailView.as_view(), name='side-detail'),
    path('drinks/', DrinkListCreateView.as_view(), name='drink-list'),
    path('drinks/<int:pk>/', DrinkDetailView.as_view(), name='drink-detail'),
    path('menus/', MenuListCreateView.as_view(), name='menu-list'),
    path('menus/<int:pk>/', MenuDetailView.as_view(), name='menu-detail'),
]
