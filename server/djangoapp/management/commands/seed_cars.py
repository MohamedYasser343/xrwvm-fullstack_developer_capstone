from django.core.management.base import BaseCommand

from djangoapp.populate import initiate


class Command(BaseCommand):
    help = "Create or update the initial dealership car inventory"

    def handle(self, *args, **options):
        initiate()
        self.stdout.write(self.style.SUCCESS("Car inventory initialized"))
