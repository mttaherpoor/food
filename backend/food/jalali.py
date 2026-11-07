"""Jalali text conversion for Excel boundaries; API and database use ISO Gregorian dates.

Arithmetic Solar Hijri conversion with round-trip validation; no extra runtime dependency.
"""
from datetime import date

_DIGITS = str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789')


def normalize_digits(value: str) -> str:
    return value.translate(_DIGITS)


def _is_gregorian_leap(year: int) -> bool:
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


def _jalali_to_gregorian(year: int, month: int, day: int) -> date:
    jy = year - 979
    jm = month - 1
    jd = day - 1
    j_day_no = 365 * jy + (jy // 33) * 8 + ((jy % 33 + 3) // 4)
    for i in range(jm):
        j_day_no += 31 if i < 6 else 30
    j_day_no += jd
    g_day_no = j_day_no + 79
    gy = 1600 + 400 * (g_day_no // 146097)
    g_day_no %= 146097
    leap = True
    if g_day_no >= 36525:
        g_day_no -= 1
        gy += 100 * (g_day_no // 36524)
        g_day_no %= 36524
        if g_day_no >= 365:
            g_day_no += 1
        else:
            leap = False
    gy += 4 * (g_day_no // 1461)
    g_day_no %= 1461
    if g_day_no >= 366:
        leap = False
        g_day_no -= 1
        gy += g_day_no // 365
        g_day_no %= 365
    months = [31, 29 if _is_gregorian_leap(gy) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    gm = 1
    for days in months:
        if g_day_no < days:
            break
        g_day_no -= days
        gm += 1
    return date(gy, gm, g_day_no + 1)


def _gregorian_to_jalali(value: date) -> tuple[int, int, int]:
    gy = value.year - 1600
    gm = value.month - 1
    gd = value.day - 1
    months = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    g_day_no = 365 * gy + (gy + 3) // 4 - (gy + 99) // 100 + (gy + 399) // 400
    for i in range(gm):
        g_day_no += months[i]
    if gm > 1 and _is_gregorian_leap(value.year):
        g_day_no += 1
    g_day_no += gd
    j_day_no = g_day_no - 79
    j_np = j_day_no // 12053
    j_day_no %= 12053
    jy = 979 + 33 * j_np + 4 * (j_day_no // 1461)
    j_day_no %= 1461
    if j_day_no >= 366:
        jy += (j_day_no - 1) // 365
        j_day_no = (j_day_no - 1) % 365
    if j_day_no < 186:
        jm, jd = 1 + j_day_no // 31, 1 + j_day_no % 31
    else:
        jm, jd = 7 + (j_day_no - 186) // 30, 1 + (j_day_no - 186) % 30
    return jy, jm, jd


def parse_jalali_date(value: str) -> date:
    text = normalize_digits(value.strip())
    parts = text.split('/')
    if len(parts) != 3 or len(parts[0]) != 4 or any(len(part) != 2 for part in parts[1:]) or not all(part.isascii() and part.isdigit() for part in parts):
        raise ValueError('Jalali date must be YYYY/MM/DD')
    year, month, day = map(int, parts)
    if not 1 <= year <= 9377 or not 1 <= month <= 12 or not 1 <= day <= 31:
        raise ValueError(f'invalid Jalali date: {value}')
    try:
        converted = _jalali_to_gregorian(year, month, day)
    except ValueError as exc:
        raise ValueError(f'invalid Jalali date: {value}') from exc
    if _gregorian_to_jalali(converted) != (year, month, day):
        raise ValueError(f'invalid Jalali date: {value}')
    return converted


def format_jalali_date(value: date) -> str:
    year, month, day = _gregorian_to_jalali(value)
    return f'{year:04d}/{month:02d}/{day:02d}'
