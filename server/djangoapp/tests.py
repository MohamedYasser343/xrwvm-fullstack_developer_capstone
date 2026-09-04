from pathlib import Path

from django.conf import settings
from django.test import SimpleTestCase


class StaticPageConfigurationTests(SimpleTestCase):
    def test_frontend_static_directory_is_used_for_templates_and_assets(self):
        frontend_static = Path(settings.BASE_DIR) / "frontend" / "static"

        self.assertIn(frontend_static, settings.TEMPLATES[0]["DIRS"])
        self.assertIn(frontend_static, settings.STATICFILES_DIRS)
