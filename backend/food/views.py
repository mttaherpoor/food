from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django.db.models import BigIntegerField, Count, ExpressionWrapper, F, Q, Sum
from django.utils.dateparse import parse_date

from typing import ClassVar

from core.permissions import HasChangedInitialPassword, IsHRFoodViewerOrSuperAdmin
from food.models import Drink, Food, Menu, Reservation, Side
from food.reservation_serializers import (
    ReservationBatchInputSerializer,
    ReservationRevisionInputSerializer,
    ReservationSerializer,
    WeeklyMenuSerializer,
)
from food.reservation_services import create_reservations, revise_reservation, weekly_menus
from food.serializers import DailyReportSerializer, DrinkSerializer, FoodSerializer, MenuSerializer, SideSerializer

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
        IsHRFoodViewerOrSuperAdmin,
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


class DailyReportViewSet(viewsets.ViewSet):
    permission_classes: ClassVar[list] = [
        IsAuthenticated,
        HasChangedInitialPassword,
        IsHRFoodViewerOrSuperAdmin,
    ]
    queryset = Menu.objects.none()
    serializer_class = DailyReportSerializer

    def list(self, request):
        start_date = parse_date(request.query_params.get('from', ''))
        end_date = parse_date(request.query_params.get('to', ''))
        if start_date is None or end_date is None:
            raise ValidationError({'date_range': 'پارامترهای from و to با قالب YYYY-MM-DD الزامی‌اند.'})
        if end_date < start_date:
            raise ValidationError({'to': 'تاریخ پایان نباید قبل از تاریخ شروع باشد.'})

        current_item_total = ExpressionWrapper(
            F('reservations__items__food_price') * F('reservations__items__food_quantity')
            + F('reservations__items__side_price') * F('reservations__items__side_quantity')
            + F('reservations__items__drink_price') * F('reservations__items__drink_quantity'),
            output_field=BigIntegerField(),
        )
        report_rows = (
            Menu.objects.filter(date__range=(start_date, end_date))
            .values('date', 'food__name')
            .annotate(
                reserved_count=Count(
                    'reservations__id',
                    filter=Q(reservations__status=Reservation.Status.RESERVED),
                    distinct=True,
                ),
                cancelled_count=Count(
                    'reservations__id',
                    filter=Q(reservations__status=Reservation.Status.CANCELLED),
                    distinct=True,
                ),
                total_toman=Sum(
                    current_item_total,
                    filter=Q(
                        reservations__status=Reservation.Status.RESERVED,
                        reservations__items__is_current=True,
                        reservations__items__is_cancelled=False,
                    ),
                ),
                food_quantity=Sum(
                    'reservations__items__food_quantity',
                    filter=Q(
                        reservations__status=Reservation.Status.RESERVED,
                        reservations__items__is_current=True,
                        reservations__items__is_cancelled=False,
                    ),
                ),
            )
            .order_by('date')
        )
        data = [
            {
                'date': row['date'],
                'food': row['food__name'],
                'reserved_count': row['reserved_count'],
                'cancelled_count': row['cancelled_count'],
                'food_quantity': row['food_quantity'] or 0,
                'total_toman': row['total_toman'] or 0,
            }
            for row in report_rows
        ]
        return Response(data)
