from rest_framework import serializers

from django.utils import timezone

from datetime import datetime, time, timedelta

from core.models import Building
from food.models import Drink, Food, Menu, MenuStatus, Reservation, ReservationItem, Side


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
    food_price = serializers.IntegerField(read_only=True)

    class Meta:
        model = Menu
        fields = (
            'id',
            'date',
            'food',
            'food_name',
            'food_price',
            'status',
            'datetime_created',
            'datetime_modified',
        )
        read_only_fields = ('datetime_created', 'datetime_modified')


class DailyReportSerializer(serializers.Serializer):
    date = serializers.DateField(read_only=True)
    food = serializers.CharField(read_only=True)
    reserved_count = serializers.IntegerField(read_only=True)
    cancelled_count = serializers.IntegerField(read_only=True)
    food_quantity = serializers.IntegerField(read_only=True)
    total_toman = serializers.IntegerField(read_only=True)


class ReservationInputSerializer(serializers.Serializer):
    menu = serializers.PrimaryKeyRelatedField(queryset=Menu.objects.select_related('food').all())
    building = serializers.PrimaryKeyRelatedField(queryset=Building.objects.filter(is_active=True))
    food_quantity = serializers.IntegerField(min_value=1, default=1)
    side = serializers.PrimaryKeyRelatedField(queryset=Side.objects.all(), required=False, allow_null=True)
    side_quantity = serializers.IntegerField(min_value=1, required=False, default=1)
    drink = serializers.PrimaryKeyRelatedField(queryset=Drink.objects.all(), required=False, allow_null=True)
    drink_quantity = serializers.IntegerField(min_value=1, required=False, default=1)

    def validate(self, attrs):
        if attrs.get('side') is None:
            attrs['side_quantity'] = 0
        if attrs.get('drink') is None:
            attrs['drink_quantity'] = 0
        return attrs


class ReservationBatchInputSerializer(serializers.Serializer):
    reservations = ReservationInputSerializer(many=True, allow_empty=False)


class ReservationRevisionInputSerializer(serializers.Serializer):
    building = serializers.PrimaryKeyRelatedField(
        queryset=Building.objects.filter(is_active=True),
        required=False,
    )
    food_quantity = serializers.IntegerField(min_value=1, required=False)
    side = serializers.PrimaryKeyRelatedField(queryset=Side.objects.all(), required=False, allow_null=True)
    side_quantity = serializers.IntegerField(min_value=1, required=False)
    drink = serializers.PrimaryKeyRelatedField(queryset=Drink.objects.all(), required=False, allow_null=True)
    drink_quantity = serializers.IntegerField(min_value=1, required=False)


class ReservationItemSerializer(serializers.ModelSerializer):
    side_name = serializers.CharField(source='side.name', read_only=True, allow_null=True)
    drink_name = serializers.CharField(source='drink.name', read_only=True, allow_null=True)
    total_price = serializers.IntegerField(read_only=True)

    class Meta:
        model = ReservationItem
        fields = (
            'id',
            'building',
            'building_number_snapshot',
            'side',
            'side_name',
            'drink',
            'drink_name',
            'food_price',
            'side_price',
            'drink_price',
            'food_quantity',
            'side_quantity',
            'drink_quantity',
            'is_current',
            'is_cancelled',
            'total_price',
            'datetime_created',
            'datetime_modified',
        )
        read_only_fields = fields


class ReservationSerializer(serializers.ModelSerializer):
    menu_date = serializers.DateField(source='menu.date', read_only=True)
    food_name = serializers.CharField(source='menu.food.name', read_only=True)
    current_item = ReservationItemSerializer(read_only=True)
    history = ReservationItemSerializer(source='items', many=True, read_only=True)
    total_price = serializers.IntegerField(read_only=True)

    class Meta:
        model = Reservation
        fields = (
            'id',
            'menu',
            'status',
            'menu_date',
            'food_name',
            'current_item',
            'history',
            'total_price',
            'datetime_created',
            'datetime_modified',
        )
        read_only_fields = fields


class WeeklyMenuSerializer(serializers.ModelSerializer):
    can_reserve = serializers.SerializerMethodField()
    food_name = serializers.CharField(source='food.name', read_only=True)
    food_price = serializers.IntegerField(read_only=True)
    reservation = serializers.SerializerMethodField()

    class Meta:
        model = Menu
        fields = ('id', 'date', 'food_name', 'food_price', 'reservation', 'can_reserve')

    def get_reservation(self, menu):
        reservations = menu.reservations.all()
        reservation = next((item for item in reservations if item.user_id == self.context['request'].user.pk), None)
        return ReservationSerializer(reservation, context=self.context).data if reservation else None

    def get_can_reserve(self, menu):
        current_timezone = timezone.get_default_timezone()
        cutoff = datetime.combine(menu.date - timedelta(days=1), time(hour=10), tzinfo=current_timezone)
        return menu.status == MenuStatus.AVAILABLE and datetime.now(current_timezone) < cutoff
