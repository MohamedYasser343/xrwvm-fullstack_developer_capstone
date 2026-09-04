from pathlib import Path
import json
from unittest.mock import Mock, patch

import requests

from django.conf import settings
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.apps import apps
from django.test import SimpleTestCase, TestCase

from . import restapis


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


class CarInventoryTestCase(TestCase):
    def setUp(self):
        super().setUp()
        try:
            self.CarMake = apps.get_model("djangoapp", "CarMake")
            self.CarModel = apps.get_model("djangoapp", "CarModel")
        except LookupError:
            self.fail("CarMake and CarModel must be defined")


class CarInventoryModelTests(CarInventoryTestCase):
    def test_car_model_belongs_to_a_make_and_external_dealership(self):
        make = self.CarMake.objects.create(
            name="Nissan",
            description="Nissan Motors",
        )
        model = self.CarModel.objects.create(
            car_make=make,
            dealer_id=29,
            name="Pathfinder",
            type="SUV",
            year=2023,
        )

        self.assertEqual(str(make), "Nissan")
        self.assertEqual(str(model), "Pathfinder")
        self.assertEqual(model.car_make, make)
        self.assertEqual(model.dealer_id, 29)
        self.assertEqual(list(make.car_models.all()), [model])

    def test_car_model_rejects_unsupported_type(self):
        make = self.CarMake.objects.create(name="Nissan", description="Cars")
        model = self.CarModel(
            car_make=make,
            dealer_id=1,
            name="Pathfinder",
            type="Truck",
            year=2023,
        )

        with self.assertRaises(ValidationError):
            model.full_clean()

    def test_car_model_rejects_year_outside_supported_range(self):
        make = self.CarMake.objects.create(name="Nissan", description="Cars")

        for year in (2014, 2024):
            with self.subTest(year=year):
                model = self.CarModel(
                    car_make=make,
                    dealer_id=1,
                    name="Pathfinder",
                    type="SUV",
                    year=year,
                )
                with self.assertRaises(ValidationError):
                    model.full_clean()


class CarInventoryAdminTests(CarInventoryTestCase):
    def test_car_models_and_makes_are_available_in_admin(self):
        self.assertTrue(admin.site.is_registered(self.CarMake))
        self.assertTrue(admin.site.is_registered(self.CarModel))


class CarInventoryPopulationTests(CarInventoryTestCase):
    def test_initiate_creates_inventory_without_duplicates(self):
        from .populate import initiate

        initiate()
        initiate()

        self.assertEqual(self.CarMake.objects.count(), 2)
        self.assertEqual(self.CarModel.objects.count(), 2)
        self.assertSetEqual(
            set(self.CarModel.objects.values_list("dealer_id", flat=True)),
            {1, 3},
        )


class CarInventoryEndpointTests(CarInventoryTestCase):
    def test_get_cars_returns_make_and_model_names(self):
        nissan = self.CarMake.objects.create(
            name="Nissan",
            description="Nissan Motors",
        )
        toyota = self.CarMake.objects.create(
            name="Toyota",
            description="Toyota Motor Corporation",
        )
        self.CarModel.objects.create(
            car_make=toyota,
            dealer_id=3,
            name="Camry",
            type="Sedan",
            year=2022,
        )
        self.CarModel.objects.create(
            car_make=nissan,
            dealer_id=1,
            name="Pathfinder",
            type="SUV",
            year=2023,
        )

        response = self.client.get("/djangoapp/get_cars")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "CarModels": [
                    {"CarModel": "Pathfinder", "CarMake": "Nissan"},
                    {"CarModel": "Camry", "CarMake": "Toyota"},
                ],
            },
        )


class DealerProxyServiceTests(SimpleTestCase):
    def test_get_request_returns_backend_json(self):
        if not hasattr(restapis, "get_request"):
            self.fail("get_request must be implemented")
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = [{"id": 3, "state": "Alabama"}]

        with (
            patch.object(restapis, "backend_url", "http://localhost:3030"),
            patch.object(restapis.requests, "get", return_value=response) as get,
        ):
            result = restapis.get_request("/fetchDealer/3")

        self.assertEqual(result, [{"id": 3, "state": "Alabama"}])
        get.assert_called_once_with(
            "http://localhost:3030/fetchDealer/3",
            params=None,
            timeout=5,
        )

    def test_get_request_raises_safe_error_when_backend_is_unavailable(self):
        if not hasattr(restapis, "DownstreamServiceError"):
            self.fail("DownstreamServiceError must be implemented")

        with patch.object(
            restapis.requests,
            "get",
            side_effect=requests.RequestException("connection refused"),
        ):
            with self.assertRaises(restapis.DownstreamServiceError):
                restapis.get_request("/fetchDealers")

    def test_analyze_review_sentiments_url_encodes_review_text(self):
        if not hasattr(restapis, "analyze_review_sentiments"):
            self.fail("analyze_review_sentiments must be implemented")
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {"sentiment": "positive"}

        with (
            patch.object(
                restapis,
                "sentiment_analyzer_url",
                "http://localhost:5050/",
            ),
            patch.object(restapis.requests, "get", return_value=response) as get,
        ):
            result = restapis.analyze_review_sentiments("Fantastic services")

        self.assertEqual(result, {"sentiment": "positive"})
        get.assert_called_once_with(
            "http://localhost:5050/analyze/Fantastic%20services",
            timeout=5,
        )

    def test_post_review_sends_json_to_backend(self):
        if not hasattr(restapis, "post_review"):
            self.fail("post_review must be implemented")
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {"id": 101, "review": "Excellent"}
        payload = {
            "name": "Ada Lovelace",
            "dealership": 3,
            "review": "Excellent",
            "purchase": True,
            "purchase_date": "2023-01-02",
            "car_make": "Toyota",
            "car_model": "Camry",
            "car_year": 2022,
        }

        with (
            patch.object(restapis, "backend_url", "http://localhost:3030"),
            patch.object(restapis.requests, "post", return_value=response) as post,
        ):
            result = restapis.post_review(payload)

        self.assertEqual(result, {"id": 101, "review": "Excellent"})
        post.assert_called_once_with(
            "http://localhost:3030/insert_review",
            json=payload,
            timeout=5,
        )


class DealerProxyViewTests(TestCase):
    @patch("djangoapp.restapis.get_request")
    def test_get_dealerships_returns_all_dealers(self, get_request):
        dealers = [{"id": 1, "state": "Texas", "full_name": "Holdlamis"}]
        get_request.return_value = dealers

        response = self.client.get("/djangoapp/get_dealers")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": 200, "dealers": dealers})
        get_request.assert_called_once_with("/fetchDealers")

    @patch("djangoapp.restapis.get_request")
    def test_get_dealerships_filters_by_state(self, get_request):
        dealers = [{"id": 17, "state": "Kansas", "full_name": "Auto Works"}]
        get_request.return_value = dealers

        response = self.client.get("/djangoapp/get_dealers/Kansas")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": 200, "dealers": dealers})
        get_request.assert_called_once_with("/fetchDealers/Kansas")

    @patch("djangoapp.restapis.get_request")
    def test_get_dealer_details_returns_requested_dealer(self, get_request):
        dealer = [{"id": 3, "state": "Alabama", "full_name": "Sub-Ex"}]
        get_request.return_value = dealer

        response = self.client.get("/djangoapp/dealer/3")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": 200, "dealer": dealer})
        get_request.assert_called_once_with("/fetchDealer/3")

    @patch("djangoapp.restapis.analyze_review_sentiments")
    @patch("djangoapp.restapis.get_request")
    def test_get_dealer_reviews_adds_sentiment(self, get_request, analyze):
        reviews = [
            {
                "id": 9,
                "name": "Grace Hopper",
                "dealership": 29,
                "review": "Fantastic services",
                "purchase": True,
                "purchase_date": "2023-01-02",
                "car_make": "Toyota",
                "car_model": "Camry",
                "car_year": 2022,
            },
        ]
        get_request.return_value = reviews
        analyze.return_value = {"sentiment": "positive"}

        response = self.client.get("/djangoapp/reviews/dealer/29")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["reviews"][0]["sentiment"], "positive")
        get_request.assert_called_once_with("/fetchReviews/dealer/29")
        analyze.assert_called_once_with("Fantastic services")

    @patch("djangoapp.restapis.get_request")
    def test_dealer_proxy_failure_returns_bad_gateway(self, get_request):
        get_request.side_effect = restapis.DownstreamServiceError(
            "Dealer service is unavailable",
        )

        response = self.client.get("/djangoapp/get_dealers")

        self.assertEqual(response.status_code, 502)
        self.assertEqual(
            response.json(),
            {"status": 502, "error": "Dealer service is unavailable"},
        )


class AddReviewViewTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="reviewer",
            password="valid-password",
            first_name="Ada",
            last_name="Lovelace",
        )
        self.payload = {
            "name": "Spoofed Name",
            "dealership": "3",
            "review": "Excellent service",
            "purchase": True,
            "purchase_date": "2023-01-02",
            "car_make": "Toyota",
            "car_model": "Camry",
            "car_year": "2022",
        }

    def post_json(self, payload):
        return self.client.post(
            "/djangoapp/add_review",
            data=json.dumps(payload),
            content_type="application/json",
        )

    def test_add_review_requires_authentication(self):
        response = self.post_json(self.payload)

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"status": 401, "error": "Authentication required"})

    @patch("djangoapp.restapis.post_review")
    def test_add_review_uses_authenticated_identity(self, post_review):
        saved_review = {"id": 101, "name": "Ada Lovelace"}
        post_review.return_value = saved_review
        self.client.force_login(self.user)

        response = self.post_json(self.payload)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"status": 200, "review": saved_review},
        )
        post_review.assert_called_once_with(
            {
                "name": "Ada Lovelace",
                "dealership": 3,
                "review": "Excellent service",
                "purchase": True,
                "purchase_date": "2023-01-02",
                "car_make": "Toyota",
                "car_model": "Camry",
                "car_year": 2022,
            },
        )

    @patch("djangoapp.restapis.post_review")
    def test_add_review_rejects_missing_fields(self, post_review):
        self.client.force_login(self.user)
        payload = dict(self.payload)
        payload["review"] = ""

        response = self.post_json(payload)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"status": 400, "error": "Missing required fields: review"},
        )
        post_review.assert_not_called()
