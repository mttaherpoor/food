from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django.db.models import Prefetch
from django.http import HttpResponse
from django.utils.dateparse import parse_date

from io import BytesIO
from typing import ClassVar

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

from core.permissions import HasChangedInitialPassword, IsCatalogReaderOrManager, IsHRFoodViewerOrSuperAdmin
from food.jalali import format_jalali_date
from food.models import Drink, Food, Menu, Reservation, ReservationItem, Side
from food.serializers import (
    DailyReportSerializer,
    DrinkSerializer,
    FoodSerializer,
    MenuSerializer,
    ReservationBatchInputSerializer,
    ReservationRevisionInputSerializer,
    ReservationSerializer,
    SideSerializer,
    WeeklyMenuSerializer,
)
from food.services import create_reservations, revise_reservation, weekly_menus

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
        IsCatalogReaderOrManager,
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
            .prefetch_related(
                'items__side',
                'items__drink',
                'items__side_items__side',
                'items__drink_items__drink',
            )
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

    def _report_data(self, request):
        start_date = parse_date(request.query_params.get('from', ''))
        end_date = parse_date(request.query_params.get('to', ''))
        if start_date is None or end_date is None:
            raise ValidationError({'date_range': 'پارامترهای from و to با قالب YYYY-MM-DD الزامی‌اند.'})
        if end_date < start_date:
            raise ValidationError({'to': 'تاریخ پایان نباید قبل از تاریخ شروع باشد.'})

        current_items = ReservationItem.objects.filter(
            is_current=True,
        ).prefetch_related(
            'side_items',
            'drink_items',
        )

        report_reservations = Reservation.objects.prefetch_related(
            Prefetch(
                'items',
                queryset=current_items,
                to_attr='report_current_items',
            ),
        )

        menus = (
            Menu.objects.filter(date__range=(start_date, end_date))
            .select_related('food')
            .prefetch_related(
                Prefetch(
                    'reservations',
                    queryset=report_reservations,
                    to_attr='report_reservations',
                ),
            )
            .order_by('date')
        )

        data = []

        for menu in menus:
            reserved_count = 0
            cancelled_count = 0
            food_quantity = 0
            total_toman = 0

            for reservation in menu.report_reservations:
                if reservation.status == Reservation.Status.CANCELLED:
                    cancelled_count += 1
                    continue

                if reservation.status != Reservation.Status.RESERVED:
                    continue

                reserved_count += 1

                for item in reservation.report_current_items:
                    if item.is_cancelled:
                        continue

                    food_quantity += item.food_quantity
                    total_toman += item.total_price

            data.append({
                'date': menu.date,
                'food': menu.food.name,
                'reserved_count': reserved_count,
                'cancelled_count': cancelled_count,
                'food_quantity': food_quantity,
                'total_toman': total_toman,
            })

        return data

    def list(self, request):
        return Response(self._report_data(request))

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        """Export the same authorized report as XLSX with Jalali date text."""
        data = self._report_data(request)
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = 'گزارش روزانه'
        sheet.sheet_view.rightToLeft = True
        headers = ['تاریخ شمسی', 'غذا', 'تعداد رزرو', 'تعداد لغو', 'تعداد غذا', 'جمع (تومان)']
        sheet.append(headers)
        for row in data:
            sheet.append([
                format_jalali_date(row['date']), row['food'], row['reserved_count'],
                row['cancelled_count'], row['food_quantity'], row['total_toman'],
            ])
        sheet.freeze_panes = 'A2'
        sheet.auto_filter.ref = sheet.dimensions
        for cell in sheet[1]:
            cell.font = Font(bold=True, color='FFFFFF')
            cell.fill = PatternFill('solid', fgColor='206C80')
            cell.alignment = Alignment(horizontal='center')
        for column, width in {'A': 18, 'B': 30, 'C': 16, 'D': 16, 'E': 16, 'F': 22}.items():
            sheet.column_dimensions[column].width = width
        for row in sheet.iter_rows(min_row=2):
            row[0].number_format = '@'
            for cell in row[2:]:
                cell.number_format = '#,##0'
        output = BytesIO()
        workbook.save(output)
        response = HttpResponse(
            output.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = 'attachment; filename="food-daily-report-jalali.xlsx"'
        return response
