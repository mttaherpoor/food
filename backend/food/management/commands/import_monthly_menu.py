from django.core.management.base import BaseCommand, CommandError, CommandParser

from pathlib import Path
from typing import Any

from food.menu_excel_import import MenuWorkbookValidationError, import_monthly_menu


class Command(BaseCommand):
    help = 'Import daily menus and monthly Toman prices from an .xlsx workbook.'

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument('workbook', type=Path)
        parser.add_argument(
            '--dry-run', action='store_true', help='Validate the workbook without writing to the database.'
        )

    def handle(self, *args: Any, **options: Any) -> None:
        try:
            counts = import_monthly_menu(options['workbook'], dry_run=options['dry_run'])
        except MenuWorkbookValidationError as exc:
            raise CommandError(str(exc)) from exc

        mode = 'validated' if options['dry_run'] else 'imported'
        summary = ', '.join(f'{key}: {count}' for key, count in counts.items())
        self.stdout.write(self.style.SUCCESS(f'Successfully {mode} monthly menus ({summary}).'))
