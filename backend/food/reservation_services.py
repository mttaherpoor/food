from rest_framework.exceptions import ValidationError

from django.db import transaction
from django.utils import timezone

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from food.models import Drink, Menu, MenuStatus, Reservation, ReservationItem, Side


def _tehran_now():
    return datetime.now(ZoneInfo('Asia/Tehran'))


def validate_reservation_window(menu: Menu, cutoff_hour: int) -> None:
    tehran_timezone = ZoneInfo('Asia/Tehran')
    now = _tehran_now()
    if menu.date < now.date():
        raise ValidationError({'menu': 'رزرو برای روزهای گذشته امکان‌پذیر نیست.'})
    cutoff = timezone.make_aware(
        datetime.combine(menu.date - timedelta(days=1), time(hour=cutoff_hour)),
        tehran_timezone,
    )
    if now >= cutoff:
        raise ValidationError({'menu': 'مهلت رزرو تا ساعت 10 صبح روز قبل است.'})


def _create_revision(reservation: Reservation, data: dict, *, cancelled: bool = False) -> ReservationItem:
    previous = reservation.items.select_for_update().filter(is_current=True).first()
    if previous:
        previous.is_current = False
        previous.save(update_fields=('is_current', 'datetime_modified'))

    menu = reservation.menu
    side = data.get('side')
    drink = data.get('drink')
    if side and not isinstance(side, Side):
        side = Side.objects.get(pk=side)
    if drink and not isinstance(drink, Drink):
        drink = Drink.objects.get(pk=drink)

    return ReservationItem.objects.create(
        reservation=reservation,
        side=side,
        drink=drink,
        food_price=menu.food_price,
        side_price=data.get('side_price', side.price if side else 0),
        drink_price=data.get('drink_price', drink.price if drink else 0),
        food_quantity=data.get('food_quantity', 1),
        side_quantity=data.get('side_quantity', 1) if side else 0,
        drink_quantity=data.get('drink_quantity', 1) if drink else 0,
        is_current=True,
        is_cancelled=cancelled,
    )


@transaction.atomic
def create_reservations(user, rows: list[dict], *, cutoff_hour: int) -> list[Reservation]:
    menus = {
        menu.pk: menu
        for menu in Menu.objects.select_for_update()
        .filter(pk__in=[row['menu'].pk for row in rows])
        .select_related('food')
    }
    results = []
    for row in rows:
        menu = menus.get(row['menu'].pk)
        if menu is None:
            raise ValidationError({'menu': 'منوی انتخاب‌شده پیدا نشد.'})
        validate_reservation_window(menu, cutoff_hour)
        if menu.status != MenuStatus.AVAILABLE:
            raise ValidationError({'menu': 'این منو برای رزرو در دسترس نیست.'})
        if Reservation.objects.filter(user=user, menu=menu).exists():
            raise ValidationError({'menu': f'برای تاریخ {menu.date} قبلاً رزرو ثبت شده است.'})
        reservation = Reservation.objects.create(user=user, menu=menu)
        _create_revision(reservation, row)
        results.append(reservation)
    return results


@transaction.atomic
def revise_reservation(
    reservation: Reservation, data: dict, *, cancelled: bool = False, cutoff_hour: int
) -> Reservation:
    reservation = Reservation.objects.select_for_update().select_related('menu__food').get(pk=reservation.pk)
    validate_reservation_window(reservation.menu, cutoff_hour)
    previous = reservation.items.filter(is_current=True).first()
    if previous is None:
        raise ValidationError('برای این رزرو نسخه جاری وجود ندارد.')
    if previous.is_cancelled:
        raise ValidationError('این رزرو قبلاً لغو شده است.')
    side = data.get('side', previous.side)
    drink = data.get('drink', previous.drink)
    side_quantity = data.get('side_quantity', previous.side_quantity)
    drink_quantity = data.get('drink_quantity', previous.drink_quantity)
    if 'side' in data and side is not None and 'side_quantity' not in data and previous.side is None:
        side_quantity = 1
    if 'drink' in data and drink is not None and 'drink_quantity' not in data and previous.drink is None:
        drink_quantity = 1
    if side is None:
        side_quantity = 0
    if drink is None:
        drink_quantity = 0
    if 'side_quantity' in data and side is None and data['side_quantity'] > 0:
        raise ValidationError({'side_quantity': 'برای تعیین تعداد، ابتدا ساید را انتخاب کنید.'})
    if 'drink_quantity' in data and drink is None and data['drink_quantity'] > 0:
        raise ValidationError({'drink_quantity': 'برای تعیین تعداد، ابتدا نوشیدنی را انتخاب کنید.'})
    revision_data = {
        'food_quantity': data.get('food_quantity', previous.food_quantity),
        'side': side,
        'side_quantity': side_quantity,
        'side_price': previous.side_price,
        'drink': drink,
        'drink_quantity': drink_quantity,
        'drink_price': previous.drink_price,
    }
    if 'side' in data and data['side'] != previous.side:
        revision_data['side_price'] = data['side'].price if data['side'] else 0
    if 'drink' in data and data['drink'] != previous.drink:
        revision_data['drink_price'] = data['drink'].price if data['drink'] else 0
    if 'side' in data and data['side'] is None:
        revision_data['side_quantity'] = 0
    if 'drink' in data and data['drink'] is None:
        revision_data['drink_quantity'] = 0
    _create_revision(reservation, revision_data, cancelled=cancelled)
    if cancelled:
        reservation.status = Reservation.Status.CANCELLED
        reservation.save(update_fields=('status', 'datetime_modified'))
    return reservation


def weekly_menus(user, start_date):
    end_date = start_date + timedelta(days=6)
    return (
        Menu.objects.filter(date__range=(start_date, end_date))
        .select_related('food')
        .prefetch_related(
            'reservations__items',
        )
        .order_by('date')
    )
