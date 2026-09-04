from pathlib import Path
import json

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase


class StaticPageConfigurationTests(SimpleTestCase):
    def test_frontend_static_directory_is_used_for_templates_and_assets(self):
        frontend_static = Path(settings.BASE_DIR) / "frontend" / "static"

        self.assertIn(frontend_static, settings.TEMPLATES[0]["DIRS"])
        self.assertIn(frontend_static, settings.STATICFILES_DIRS)

    def test_react_build_is_configured_for_templates_and_assets(self):
        frontend_build = Path(settings.BASE_DIR) / "frontend" / "build"

        self.assertIn(frontend_build, settings.TEMPLATES[0]["DIRS"])
        self.assertIn(frontend_build / "static", settings.STATICFILES_DIRS)


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

    def test_react_authentication_pages_use_the_production_client(self):
        for url in ("/login", "/register"):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200)
                self.assertTemplateUsed(response, "index.html")
                self.assertContains(response, '<div id="root"></div>', html=True)


class UserManagementEndpointTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="existinguser",
            password="valid-password",
            first_name="Existing",
            last_name="User",
            email="existing@example.com",
        )

    def post_json(self, path, payload):
        return self.client.post(
            path,
            data=json.dumps(payload),
            content_type="application/json",
        )

    def test_valid_credentials_log_the_user_in(self):
        response = self.post_json(
            "/djangoapp/login",
            {"userName": "existinguser", "password": "valid-password"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"userName": "existinguser", "status": "Authenticated"},
        )
        self.assertEqual(
            int(self.client.session["_auth_user_id"]),
            self.user.pk,
        )

    def test_invalid_credentials_are_rejected(self):
        response = self.post_json(
            "/djangoapp/login",
            {"userName": "existinguser", "password": "wrong-password"},
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(
            response.json(),
            {"userName": "existinguser", "error": "Invalid credentials"},
        )
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_logout_clears_the_authenticated_session(self):
        self.client.force_login(self.user)

        response = self.client.get("/djangoapp/logout")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "Logged out"})
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_registration_creates_and_logs_in_a_user(self):
        response = self.post_json(
            "/djangoapp/register",
            {
                "userName": "newuser",
                "firstName": "New",
                "lastName": "User",
                "email": "new@example.com",
                "password": "new-password",
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            response.json(),
            {"userName": "newuser", "status": "Authenticated"},
        )
        created_user = get_user_model().objects.get(username="newuser")
        self.assertEqual(created_user.first_name, "New")
        self.assertEqual(created_user.last_name, "User")
        self.assertEqual(created_user.email, "new@example.com")
        self.assertTrue(created_user.check_password("new-password"))
        self.assertEqual(
            int(self.client.session["_auth_user_id"]),
            created_user.pk,
        )

    def test_registration_rejects_a_duplicate_username(self):
        response = self.post_json(
            "/djangoapp/register",
            {
                "userName": "existinguser",
                "firstName": "Another",
                "lastName": "User",
                "email": "another@example.com",
                "password": "new-password",
            },
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.json(),
            {"userName": "existinguser", "error": "Already registered"},
        )

    def test_authentication_endpoints_reject_invalid_requests(self):
        bad_json = self.client.post(
            "/djangoapp/login",
            data="not-json",
            content_type="application/json",
        )
        missing_registration_field = self.post_json(
            "/djangoapp/register",
            {
                "userName": "newuser",
                "firstName": "New",
                "lastName": "User",
                "email": "new@example.com",
            },
        )
        wrong_method = self.client.get("/djangoapp/login")

        self.assertEqual(bad_json.status_code, 400)
        self.assertEqual(bad_json.json(), {"error": "Invalid JSON body"})
        self.assertEqual(missing_registration_field.status_code, 400)
        self.assertEqual(
            missing_registration_field.json(),
            {"error": "Missing required fields: password"},
        )
        self.assertEqual(wrong_method.status_code, 405)
