from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from site_statistics.models import DailyPageTotal


class Command(BaseCommand):
    help = 'Delete daily statistics older than 90 days. Schedule daily even when collection is disabled.'

    def handle(self, *args, **options):
        count, _ = DailyPageTotal.objects.filter(day__lt=timezone.now().date() - timedelta(days=89)).delete()
        self.stdout.write(f'Deleted {count} expired aggregate rows.')
