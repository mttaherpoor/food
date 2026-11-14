"""Jalali date conversion for Excel and other presentation boundaries.

API and database dates remain Gregorian ISO dates.
"""

from datetime import date
import re

import jdatetime

_DIGITS = str.maketrans(
    '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩',
    '01234567890123456789',
)

_JALALI_PATTERN = re.compile(r'[0-9]{4}/[0-9]{2}/[0-9]{2}')


def normalize_digits(value: str) -> str:
    return value.translate(_DIGITS)


def parse_jalali_date(value: str) -> date:
    text = normalize_digits(value.strip())

    if _JALALI_PATTERN.fullmatch(text) is None:
        raise ValueError('Jalali date must be YYYY/MM/DD')

    year, month, day = map(int, text.split('/'))

    if not (1 <= year <= 9377 and 1 <= month <= 12 and 1 <= day <= 31):
        raise ValueError(f'invalid Jalali date: {value}')

    try:
        converted = jdatetime.date(year, month, day).togregorian()
    except (ValueError, OverflowError) as exc:
        raise ValueError(f'invalid Jalali date: {value}') from exc

    if jdatetime.date.fromgregorian(date=converted) != jdatetime.date(year, month, day):
        raise ValueError(f'invalid Jalali date: {value}')

    return converted


def format_jalali_date(value: date) -> str:
    jalali = jdatetime.date.fromgregorian(date=value)
    return f'{jalali.year:04d}/{jalali.month:02d}/{jalali.day:02d}'
