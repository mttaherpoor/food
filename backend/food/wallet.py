"""Read-only monthly reservation spending summary."""

from django.db.models import Prefetch
from django.utils import timezone

import jdatetime

from food.models import Reservation, ReservationItem


def current_month_wallet(queryset):
    """Calculate spending using the Jalali month of the menu date."""
    today = timezone.localdate()
    jalali_today = jdatetime.date.fromgregorian(date=today)
    year = jalali_today.year
    month = jalali_today.month

    start = jdatetime.date(year, month, 1).togregorian()

    if month == 12:
        end = jdatetime.date(year + 1, 1, 1).togregorian()
    else:
        end = jdatetime.date(year, month + 1, 1).togregorian()

    current_items = Prefetch(
        "items",
        queryset=ReservationItem.objects.filter(
            is_current=True,
            is_cancelled=False,
        ).prefetch_related(
            "side_items",
            "drink_items",
        ),
        to_attr="wallet_current_items",
    )

    reservations = (
        queryset.filter(
            menu__date__gte=start,
            menu__date__lt=end,
            status=Reservation.Status.RESERVED,
        )
        .prefetch_related(current_items)
    )

    amount = 0
    count = 0

    for reservation in reservations:
        items = reservation.wallet_current_items
        if not items:
            continue

        amount += items[0].total_price
        count += 1

    return {
        "month": f"{year:04d}-{month:02d}",
        "spent_toman": amount,
        "reservation_count": count,
    }
