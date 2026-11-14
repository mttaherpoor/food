from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django.conf import settings
from django.db.models import Prefetch
from django.http import HttpResponse
from django.utils.dateparse import parse_date

from io import BytesIO
from typing import ClassVar

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

from core.permissions import HasChangedInitialPassword, IsCatalogReaderOrManager, IsHRFoodViewerOrSuperAdmin
from food.history_excel import export_full_history
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
from food.wallet import current_month_wallet


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
            cutoff_hour=settings.RESERVATION_CUTOFF_HOUR,
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
            cutoff_hour=settings.RESERVATION_CUTOFF_HOUR,
        )
        return Response(self.get_serializer(self.get_object()).data)

    @action(detail=False, methods=['get'], url_path='wallet-summary')
    def wallet_summary(self, request):
        return Response(current_month_wallet(self.get_queryset()))

    @action(detail=False, methods=['get'], url_path='history-export')
    def history_export(self, request):
        from core.models import Profile

        person_id = (
            Profile.objects.filter(user=request.user)
            .values_list('personnel_number', flat=True)
            .first()
        )

        if not person_id:
            raise ValidationError({
                'personnel_number': 'کد پرسنلی کاربر ثبت نشده است.'
            })

        return export_full_history(
            self.get_queryset(),
            str(person_id),
        )

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
            cutoff_hour=settings.RESERVATION_CUTOFF_HOUR,
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


    @action(detail=False, methods=['get'], url_path='buildings')
    def buildings(self, request):
        """Active reservations grouped by delivery building and menu day."""
        start_date = parse_date(request.query_params.get('from', ''))
        end_date = parse_date(request.query_params.get('to', ''))

        if start_date is None or end_date is None:
            raise ValidationError({
                'date_range': 'پارامترهای from و to با قالب YYYY-MM-DD الزامی‌اند.'
            })
        if end_date < start_date:
            raise ValidationError({
                'to': 'تاریخ پایان نباید قبل از تاریخ شروع باشد.'
            })

        items = (
            ReservationItem.objects.filter(
                reservation__menu__date__range=(start_date, end_date),
                reservation__status=Reservation.Status.RESERVED,
                is_current=True,
                is_cancelled=False,
            )
            .select_related(
                'building',
                'reservation__menu__food',
            )
        )

        grouped = {}

        for item in items:
            number = (
                item.building_number_snapshot
                or (item.building.number if item.building_id else '')
            )

            if not number:
                continue

            number = str(number)
            menu = item.reservation.menu

            building = grouped.setdefault(number, {
                'building_number': number,
                'reserved_count': 0,
                'days': {},
            })

            day_key = (menu.date, menu.food.name)
            day = building['days'].setdefault(day_key, {
                'date': menu.date.isoformat(),
                'food': menu.food.name,
                'reserved_count': 0,
                'food_quantity': 0,
            })

            building['reserved_count'] += 1
            day['reserved_count'] += 1
            day['food_quantity'] += item.food_quantity

        def number_sort(value):
            return (0, int(value), value) if value.isdecimal() else (1, value)

        result = []

        for number in sorted(grouped, key=number_sort):
            building = grouped[number]
            result.append({
                'building_number': number,
                'reserved_count': building['reserved_count'],
                'days': [
                    building['days'][key]
                    for key in sorted(building['days'])
                ],
            })

        return Response({'buildings': result})

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        """Export active reservation details with Jalali dates to XLSX."""
        start_date = parse_date(request.query_params.get('from', ''))
        end_date = parse_date(request.query_params.get('to', ''))

        if start_date is None or end_date is None:
            raise ValidationError({
                'date_range': 'پارامترهای from و to با قالب YYYY-MM-DD الزامی‌اند.'
            })
        if end_date < start_date:
            raise ValidationError({
                'to': 'تاریخ پایان نباید قبل از تاریخ شروع باشد.'
            })

        current_items = (
            ReservationItem.objects.filter(
                is_current=True,
                is_cancelled=False,
            )
            .select_related('building')
            .prefetch_related('side_items__side', 'drink_items__drink')
        )

        reservations = (
            Reservation.objects.filter(
                menu__date__range=(start_date, end_date),
                status=Reservation.Status.RESERVED,
            )
            .select_related('menu__food', 'user__profile__department')
            .prefetch_related(
                Prefetch(
                    'items',
                    queryset=current_items,
                    to_attr='export_current_items',
                )
            )
        )

        def identifier_sort(value):
            text = str(value or '')
            if not text:
                return (2, '', '')
            if text.isdecimal():
                return (0, int(text), text)
            return (1, text, '')

        records = []

        for reservation in reservations:
            profile = getattr(reservation.user, 'profile', None)
            personnel = (
                profile.personnel_number
                if profile is not None
                else reservation.user.username
            )
            department = (
                profile.department.number
                if profile is not None and profile.department_id
                else ''
            )

            for item in reservation.export_current_items:
                building = (
                    item.building_number_snapshot
                    or (item.building.number if item.building_id else '')
                )

                drinks = sorted(item.drink_items.all(), key=lambda x: x.pk)
                sides = sorted(item.side_items.all(), key=lambda x: x.pk)

                records.append({
                    'date': reservation.menu.date,
                    'building': str(building),
                    'personnel': str(personnel),
                    'department': str(department),
                    'food': reservation.menu.food.name,
                    'quantity': item.food_quantity,
                    'food_unit_price': item.food_price,
                    'drinks': drinks,
                    'sides': sides,
                    'total': item.total_price,
                })

        records.sort(
            key=lambda row: (
                row['date'],
                identifier_sort(row['building']),
                identifier_sort(row['personnel']),
            )
        )

        max_drinks = max(
            (len(row['drinks']) for row in records),
            default=0,
        )
        max_sides = max(
            (len(row['sides']) for row in records),
            default=0,
        )

        headers = [
            'روز شمسی',
            'شماره ساختمان',
            'کد پرسنلی',
            'شماره دپارتمان',
            'نام غذا',
            'تعداد غذا',
            'قیمت واحد غذا با ظرف (تومان)',
        ]

        for index in range(1, max_drinks + 1):
            headers.extend([
                f'نوشیدنی {index}',
                f'تعداد نوشیدنی {index}',
                f'قیمت واحد نوشیدنی {index} (تومان)',
            ])

        for index in range(1, max_sides + 1):
            headers.extend([
                f'پیش‌غذا {index}',
                f'تعداد پیش‌غذا {index}',
                f'قیمت واحد پیش‌غذا {index} (تومان)',
            ])

        headers.append('قیمت کل (تومان)')

        workbook = Workbook()
        sheet = workbook.active
        sheet.title = 'جزئیات رزرو'
        sheet.sheet_view.rightToLeft = True
        sheet.freeze_panes = 'A2'
        sheet.append(headers)

        for record in records:
            values = [
                format_jalali_date(record['date']),
                record['building'],
                record['personnel'],
                record['department'],
                record['food'],
                record['quantity'],
                record['food_unit_price'],
            ]

            for index in range(max_drinks):
                if index < len(record['drinks']):
                    item = record['drinks'][index]
                    values.extend([
                        item.drink.name,
                        item.quantity,
                        item.unit_price,
                    ])
                else:
                    values.extend([None, None, None])

            for index in range(max_sides):
                if index < len(record['sides']):
                    item = record['sides'][index]
                    values.extend([
                        item.side.name,
                        item.quantity,
                        item.unit_price,
                    ])
                else:
                    values.extend([None, None, None])

            values.append(record['total'])
            sheet.append(values)

            row_number = sheet.max_row
            for column in (1, 2, 3, 4):
                cell = sheet.cell(row_number, column)
                cell.number_format = '@'
                cell.data_type = 's'

            # Keep user-entered product names as text, never formulas.
            for cell in sheet[row_number]:
                if isinstance(cell.value, str) and cell.value.startswith('='):
                    cell.data_type = 's'

        for cell in sheet[1]:
            cell.fill = PatternFill(
                'solid',
                fgColor='176477',
            )
            cell.font = Font(color='FFFFFF', bold=True)
            cell.alignment = Alignment(
                horizontal='center',
                vertical='center',
            )

        sheet.row_dimensions[1].height = 28
        sheet.auto_filter.ref = sheet.dimensions

        for column in sheet.columns:
            first = column[0]
            width = min(
                42,
                max(16, len(str(first.value or '')) + 6),
            )
            sheet.column_dimensions[first.column_letter].width = width

        for row in sheet.iter_rows(min_row=2):
            for cell in row:
                cell.alignment = Alignment(
                    horizontal='right',
                    vertical='center',
                )

        output = BytesIO()
        workbook.save(output)
        workbook.close()

        response = HttpResponse(
            output.getvalue(),
            content_type=(
                'application/vnd.openxmlformats-officedocument.'
                'spreadsheetml.sheet'
            ),
        )
        response['Content-Disposition'] = (
            'attachment; filename="food-daily-report.xlsx"'
        )
        return response
