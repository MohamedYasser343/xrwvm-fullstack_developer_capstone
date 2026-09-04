from pathlib import Path

from django.conf import settings
from django.test import SimpleTestCase


class StaticPageConfigurationTests(SimpleTestCase):
    def test_frontend_static_directory_is_used_for_templates_and_assets(self):
        frontend_static = Path(settings.BASE_DIR) / "frontend" / "static"

        self.assertIn(frontend_static, settings.TEMPLATES[0]["DIRS"])
        self.assertIn(frontend_static, settings.STATICFILES_DIRS)


class StaticPageRouteTests(SimpleTestCase):
    def test_home_about_and_contact_pages_are_available(self):
        pages = {
            "/": "Home.html",
            "/about": "About.html",
            "/contact": "Contact.html",
        }

        for url, template_name in pages.items():
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200)
                self.assertTemplateUsed(response, template_name)

    def test_each_page_has_best_cars_navigation(self):
        for url in ("/", "/about", "/contact"):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertContains(response, "Best Cars")
                self.assertContains(response, 'href="/"')
                self.assertContains(response, 'href="/about"')
                self.assertContains(response, 'href="/contact"')
                self.assertContains(response, "navbar-toggler")

    def test_about_page_introduces_best_cars_and_three_team_members(self):
        response = self.client.get("/about")

        self.assertContains(response, "About Best Cars")
        self.assertContains(response, 'class="team-member', count=3)
        self.assertContains(response, 'href="mailto:', count=3)
        self.assertContains(response, "@bestcars.example")

    def test_contact_page_lists_contact_methods_and_business_hours(self):
        response = self.client.get("/contact")

        self.assertContains(response, "Contact Best Cars")
        self.assertContains(response, "hello@bestcars.example")
        self.assertContains(response, "+1 (800) 555-0127")
        self.assertContains(response, "Business hours")
