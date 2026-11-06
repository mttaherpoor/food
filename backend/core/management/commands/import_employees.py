from django.core.management.base import BaseCommand, CommandError, CommandParser

from pathlib import Path
from typing import Any

from core.excel_import import WorkbookValidationError, import_employees


class Command(BaseCommand):
    help = 'Import employees from an .xlsx workbook.'

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument('workbook', type=Path)
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Validate the workbook without writing to the database.',
        )

    def handle(self, *args: Any, **options: Any) -> None:
        try:
            count = import_employees(options['workbook'], dry_run=options['dry_run'])
        except WorkbookValidationError as exc:
            raise CommandError(str(exc)) from exc

        mode = 'validated' if options['dry_run'] else 'imported'
        self.stdout.write(self.style.SUCCESS(f'Successfully {mode} {count} employee(s).'))
