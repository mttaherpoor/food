from django.core.management.base import BaseCommand, CommandError, CommandParser

from pathlib import Path
from typing import Any

from food.excel_import import WorkbookValidationError, import_catalog


class Command(BaseCommand):
    help = 'Import foods, sides, and drinks from an .xlsx workbook.'

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument('workbook', type=Path)
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Validate the workbook without writing to the database.',
        )

    def handle(self, *args: Any, **options: Any) -> None:
        try:
            counts = import_catalog(options['workbook'], dry_run=options['dry_run'])
        except WorkbookValidationError as exc:
            raise CommandError(str(exc)) from exc

        mode = 'validated' if options['dry_run'] else 'imported'
        summary = ', '.join(f'{sheet}: {count}' for sheet, count in counts.items())
        self.stdout.write(self.style.SUCCESS(f'Successfully {mode} catalog rows ({summary}).'))
