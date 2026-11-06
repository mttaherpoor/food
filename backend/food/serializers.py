from rest_framework import serializers

from food.models import Drink, Food, Menu, Side


class FoodSerializer(serializers.ModelSerializer):
    total_price = serializers.IntegerField(
        read_only=True,
        min_value=0,
        help_text='Total price in Toman.',
    )

    class Meta:
        model = Food
        fields = (
            'id',
            'name',
            'price',
            'container_price',
            'total_price',
            'datetime_created',
            'datetime_modified',
        )
        read_only_fields = ('total_price', 'datetime_created', 'datetime_modified')


class SideSerializer(serializers.ModelSerializer):
    class Meta:
        model = Side
        fields = ('id', 'name', 'price', 'datetime_created', 'datetime_modified')
        read_only_fields = ('datetime_created', 'datetime_modified')


class DrinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = Drink
        fields = ('id', 'name', 'price', 'datetime_created', 'datetime_modified')
        read_only_fields = ('datetime_created', 'datetime_modified')


class MenuSerializer(serializers.ModelSerializer):
    food_name = serializers.CharField(source='food.name', read_only=True)

    class Meta:
        model = Menu
        fields = (
            'id',
            'date',
            'food',
            'food_name',
            'status',
            'datetime_created',
            'datetime_modified',
        )
        read_only_fields = ('datetime_created', 'datetime_modified')
