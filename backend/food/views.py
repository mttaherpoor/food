from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django.utils.dateparse import parse_date

from typing import ClassVar

from core.permissions import HasChangedInitialPassword, IsHRFoodOrSuperAdmin
from food.models import Drink, Food, Menu, Reservation, Side
from food.reservation_serializers import (
    ReservationBatchInputSerializer,
    ReservationRevisionInputSerializer,
    ReservationSerializer,
    WeeklyMenuSerializer,
)
from food.reservation_services import create_reservations, revise_reservation, weekly_menus
from food.serializers import DrinkSerializer, FoodSerializer, MenuSerializer, SideSerializer

RESERVATION_CUTOFF_HOUR = 10


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


class ReservationViewSet(viewsets.ModelViewSet):
    http_method_names: ClassVar[list] = ['get', 'post', 'patch', 'head', 'options']
    permission_classes: ClassVar[list] = [IsAuthenticated, HasChangedInitialPassword]
    queryset = Reservation.objects.none()
    serializer_class = ReservationSerializer

    def get_queryset(self):
        return (
            Reservation.objects.filter(user=self.request.user)
            .select_related('menu__food', 'user')
            .prefetch_related('items__side', 'items__drink')
        )

    def create(self, request, *args, **kwargs):
        input_serializer = ReservationBatchInputSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        reservations = create_reservations(
            request.user,
            input_serializer.validated_data['reservations'],
            cutoff_hour=RESERVATION_CUTOFF_HOUR,
        )
        return Response(
            self.get_serializer(reservations, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        reservation = self.get_object()
        input_serializer = ReservationRevisionInputSerializer(data=request.data, partial=True)
        input_serializer.is_valid(raise_exception=True)
        revise_reservation(
            reservation,
            input_serializer.validated_data,
            cutoff_hour=RESERVATION_CUTOFF_HOUR,
        )
        return Response(self.get_serializer(self.get_object()).data)

    @action(detail=False, methods=['get'])
    def weekly(self, request):
        start_date = parse_date(request.query_params.get('start', ''))
        if start_date is None:
            raise ValidationError({'start': 'تاریخ شروع هفته با قالب YYYY-MM-DD الزامی است.'})
        menus = weekly_menus(request.user, start_date)
        return Response(WeeklyMenuSerializer(menus, many=True, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        reservation = self.get_object()
        revise_reservation(
            reservation,
            {},
            cancelled=True,
            cutoff_hour=RESERVATION_CUTOFF_HOUR,
        )
        return Response(self.get_serializer(self.get_object()).data)
