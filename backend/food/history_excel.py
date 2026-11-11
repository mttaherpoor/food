"""Export all user reservation snapshots to a Jalali XLSX workbook."""

from rest_framework.exceptions import ValidationError

from django.http import HttpResponse

from io import BytesIO

import jdatetime
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from food.jalali import format_jalali_date
from food.models import Reservation


def safe_text(value):
    """Prevent spreadsheet formula interpretation of user-entered text."""
    text = str(value) if value is not None else ""
    if text.lstrip().startswith(("=", "+", "-", "@")):
        return "'" + text
    return text


def jalali_month(value):
    converted = jdatetime.date.fromgregorian(date=value)
    return f"{converted.year:04d}-{converted.month:02d}"


def style_sheet(sheet, widths):
    sheet.sheet_view.rightToLeft = True
    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = sheet.dimensions

    for index, width in enumerate(widths, 1):
        sheet.column_dimensions[get_column_letter(index)].width = width

    for cell in sheet[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="206C80")
        cell.alignment = Alignment(horizontal="center")

    for row in sheet.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = Alignment(
                horizontal="right",
                vertical="center",
            )
            if isinstance(cell.value, int):
                cell.number_format = "#,##0"


def get_current_item(reservation):
    return next(
        (item for item in reservation.items.all() if item.is_current),
        None,
    )


def get_products(item, category):
    entries = (
        item.side_items.all()
        if category == "پیش‌غذا"
        else item.drink_items.all()
    )

    products = [
        (
            entry.side.name if category == "پیش‌غذا" else entry.drink.name,
            entry.quantity,
            entry.unit_price,
            entry.total_price,
        )
        for entry in entries
    ]

    if products:
        return products

    # Compatibility for historical single-selection records.
    if category == "پیش‌غذا":
        name = item.side.name if item.side_id else None
        quantity = item.side_quantity
        amount = item.side_price
    else:
        name = item.drink.name if item.drink_id else None
        quantity = item.drink_quantity
        amount = item.drink_price

    if name and quantity > 0:
        return [(name, quantity, amount // quantity, amount)]

    return []


def building_snapshot(item):
    if item.building_number_snapshot:
        return safe_text(item.building_number_snapshot)
    if item.building_id is not None:
        return safe_text(item.building_id)
    return ""


def export_full_history(queryset, person_id):
    """Export an already user-scoped queryset. No payment status is inferred."""
    reservations = list(
        queryset
        .select_related("menu__food")
        .prefetch_related(
            "items__side",
            "items__drink",
            "items__side_items__side",
            "items__drink_items__drink",
        )
        .order_by("-menu__date", "-pk")
    )

    if not reservations:
        raise ValidationError({
            "history": "برای این کارمند هنوز سابقه رزروی وجود ندارد."
        })

    last_month = jalali_month(reservations[0].menu.date)
    filename = f"{person_id}-{last_month}.xlsx"

    workbook = Workbook()
    summary = workbook.active
    summary.title = "خلاصه ماهانه"
    details = workbook.create_sheet("جزئیات رزروها")
    versions = workbook.create_sheet("تاریخچه ویرایش‌ها")  # noqa: RUF001

    summary.append([
        "ماه شمسی",
        "رزرو فعال",
        "رزرو لغوشده",
        "تعداد غذا",
        "مبلغ غذا (تومان)",
        "مبلغ پیش‌غذا (تومان)",
        "مبلغ نوشیدنی (تومان)",
        "جمع مخلفات (تومان)",
        "جمع کل (تومان)",
    ])

    headers = [
        "تاریخ شمسی غذا",
        "شناسه رزرو",
        "نام غذا",
        "وضعیت رزرو",
        "شماره ساختمان",
        "دسته",
        "نام قلم",
        "تعداد",
        "قیمت واحد (تومان)",
        "مبلغ قلم (تومان)",
        "جمع رزرو (تومان)",
    ]
    details.append(headers)

    versions.append([
        *headers[:2],
        "شناسه نسخه",
        "تاریخ ثبت نسخه",
        *headers[2:],
        "نسخه فعلی",
        "نسخه لغوشده",
    ])

    monthly = {}

    for reservation in reservations:
        current = get_current_item(reservation)
        month = jalali_month(reservation.menu.date)
        date_text = format_jalali_date(reservation.menu.date)

        if month not in monthly:
            monthly[month] = {
                "active": 0,
                "cancelled": 0,
                "food_count": 0,
                "food_amount": 0,
                "side_amount": 0,
                "drink_amount": 0,
                "total": 0,
            }

        totals = monthly[month]
        active = (
            reservation.status == Reservation.Status.RESERVED
            and current is not None
            and not current.is_cancelled
        )

        if not active:
            totals["cancelled"] += 1
        else:
            totals["active"] += 1
            totals["food_count"] += current.food_quantity
            totals["food_amount"] += (
                current.food_price * current.food_quantity
            )
            totals["side_amount"] += sum(
                product[3]
                for product in get_products(current, "پیش‌غذا")
            )
            totals["drink_amount"] += sum(
                product[3]
                for product in get_products(current, "نوشیدنی")
            )
            totals["total"] += reservation.total_price

        def item_rows(
            item,
            is_active,
            date_text=date_text,
            reservation=reservation,
        ):
            building = building_snapshot(item)
            status_text = (
                "لغوشده"
                if item.is_cancelled
                or (item.is_current and reservation.status == "can")
                else "فعال"
                if is_active
                else "نسخه پیشین"
            )
            total = item.total_price if is_active else 0

            base = [
                date_text,
                reservation.pk,
                safe_text(reservation.menu.food.name),
                status_text,
                building,
            ]

            if item.is_cancelled:
                return [[
                    *base, "وضعیت", "لغو رزرو",
                    0, 0, 0, 0,
                ]]

            rows = [[
                *base,
                "غذای اصلی",
                safe_text(reservation.menu.food.name),
                item.food_quantity,
                item.food_price,
                item.food_price * item.food_quantity,
                total,
            ]]

            for category in ("پیش‌غذا", "نوشیدنی"):
                for name, qty, unit, amount in get_products(item, category):
                    rows.append([
                        *base,
                        category,
                        safe_text(name),
                        qty,
                        unit,
                        amount,
                        total,
                    ])

            return rows

        if current is not None:
            for row in item_rows(current, active):
                details.append(row)

        # Every historical revision, ordered newest first.
        historical_items = sorted(
            reservation.items.all(),
            key=lambda item: (item.datetime_created, item.pk),
            reverse=True,
        )

        for item in historical_items:
            for row in item_rows(
                item,
                item.is_current
                and not item.is_cancelled
                and active,
            ):
                versions.append([
                    row[0],
                    row[1],
                    item.pk,
                    jdatetime.datetime.fromgregorian(
                        datetime=item.datetime_created
                    ).strftime("%Y/%m/%d %H:%M:%S"),
                    *row[2:],
                    "بله" if item.is_current else "خیر",
                    "بله" if item.is_cancelled else "خیر",
                ])

    for month in sorted(monthly, reverse=True):
        totals = monthly[month]
        summary.append([
            month.replace("-", "/"),
            totals["active"],
            totals["cancelled"],
            totals["food_count"],
            totals["food_amount"],
            totals["side_amount"],
            totals["drink_amount"],
            totals["side_amount"] + totals["drink_amount"],
            totals["total"],
        ])

    style_sheet(summary, [18, 18, 18, 18, 25, 26, 26, 26, 25])
    style_sheet(
        details,
        [18, 16, 27, 19, 20, 18, 27, 13, 25, 25, 25],
    )
    style_sheet(
        versions,
        [18, 16, 17, 23, 27, 19, 20, 18, 27, 13, 25, 25, 25, 17, 17],
    )

    output = BytesIO()
    workbook.save(output)

    response = HttpResponse(
        output.getvalue(),
        content_type=(
            "application/vnd.openxmlformats-officedocument."
            "spreadsheetml.sheet"
        ),
    )
    response["Content-Disposition"] = (
        f'attachment; filename="{filename}"'
    )
    return response
