from django.test import SimpleTestCase

from datetime import date

from food.jalali import (
    format_jalali_date,
    normalize_digits,
    parse_jalali_date,
)


class JalaliConversionTests(SimpleTestCase):
    def test_gregorian_to_jalali(self):
        cases = {
            date(2024, 3, 19): "1402/12/29",
            date(2024, 3, 20): "1403/01/01",
            date(2025, 3, 20): "1403/12/30",
            date(2026, 3, 21): "1405/01/01",
            date(2026, 11, 10): "1405/08/19",
            date(2028, 3, 20): "1407/01/01",
        }

        for gregorian, expected in cases.items():
            with self.subTest(gregorian=gregorian):
                self.assertEqual(
                    format_jalali_date(gregorian),
                    expected,
                )
                self.assertEqual(
                    parse_jalali_date(expected),
                    gregorian,
                )

    def test_persian_and_arabic_digits(self):
        expected = date(2026, 11, 10)

        self.assertEqual(
            parse_jalali_date("۱۴۰۵/۰۸/۱۹"),
            expected,
        )
        self.assertEqual(
            parse_jalali_date("١٤٠٥/٠٨/١٩"),
            expected,
        )

    def test_invalid_dates(self):
        invalid_dates = (
            "1405/13/01",
            "1405/00/01",
            "1405/01/32",
            "1405-08-19",
            "not-a-date",
            "1403/12/31",
        )

        for value in invalid_dates:
            with self.subTest(value=value), self.assertRaises(ValueError):
                parse_jalali_date(value)

    def test_normalize_digits(self):
        self.assertEqual(
            normalize_digits("۱۴۰۵/٠٨/۱۹"),
            "1405/08/19",
        )
