from rest_framework import serializers

from food.models import Drink, Menu, Reservation, ReservationItem, Side


class ReservationInputSerializer(serializers.Serializer):
    menu = serializers.PrimaryKeyRelatedField(queryset=Menu.objects.select_related('food').all())
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
    food_name = serializers.CharField(source='food.name', read_only=True)
    food_price = serializers.IntegerField(read_only=True)
    reservation = serializers.SerializerMethodField()

    class Meta:
        model = Menu
        fields = ('id', 'date', 'food_name', 'food_price', 'reservation')

    def get_reservation(self, menu):
        reservations = menu.reservations.all()
        reservation = next((item for item in reservations if item.user_id == self.context['request'].user.pk), None)
        return ReservationSerializer(reservation, context=self.context).data if reservation else None
