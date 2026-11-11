from django.contrib import admin

from unfold.admin import ModelAdmin

from food.forms import DrinkAdminForm, FoodAdminForm, SideAdminForm
from food.models import Drink, Food, Menu, Side


@admin.register(Food)
class FoodAdmin(ModelAdmin):
    list_display = ('name', 'price', 'container_price', 'total_price', 'datetime_modified')
    search_fields = ('name',)
    readonly_fields = ('total_price', 'datetime_created', 'datetime_modified')
    form = FoodAdminForm


@admin.register(Side)
class SideAdmin(ModelAdmin):
    list_display = ('name', 'price', 'datetime_modified')
    search_fields = ('name',)
    readonly_fields = ('datetime_created', 'datetime_modified')
    form = SideAdminForm


@admin.register(Drink)
class DrinkAdmin(ModelAdmin):
    list_display = ('name', 'price', 'datetime_modified')
    search_fields = ('name',)
    readonly_fields = ('datetime_created', 'datetime_modified')
    form = DrinkAdminForm


@admin.register(Menu)
class MenuAdmin(ModelAdmin):
    list_display = ('date', 'food', 'food_price', 'status', 'datetime_modified')
    list_filter = ('status', 'date')
    search_fields = ('food__name',)
    autocomplete_fields = ('food',)
    readonly_fields = ('datetime_created', 'datetime_modified')
