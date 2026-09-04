import json
import logging

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from . import restapis
from .models import CarModel


logger = logging.getLogger(__name__)


@require_GET
def get_cars(request):
    cars = CarModel.objects.select_related("car_make").order_by(
        "car_make__name",
        "name",
    )
    car_models = [
        {"CarModel": car.name, "CarMake": car.car_make.name}
        for car in cars
    ]
    return JsonResponse({"CarModels": car_models})


def _downstream_error(error):
    return JsonResponse({"status": 502, "error": str(error)}, status=502)


@require_GET
def get_dealerships(request, state=None):
    endpoint = "/fetchDealers"
    if state and state != "All":
        endpoint = f"{endpoint}/{state}"

    try:
        dealers = restapis.get_request(endpoint)
    except restapis.DownstreamServiceError as error:
        return _downstream_error(error)

    if not isinstance(dealers, list):
        return _downstream_error(
            restapis.DownstreamServiceError(
                "Dealer service returned an invalid response",
            ),
        )
    return JsonResponse({"status": 200, "dealers": dealers})


@require_GET
def get_dealer_details(request, dealer_id):
    try:
        dealer = restapis.get_request(f"/fetchDealer/{dealer_id}")
    except restapis.DownstreamServiceError as error:
        return _downstream_error(error)

    if not isinstance(dealer, list):
        return _downstream_error(
            restapis.DownstreamServiceError(
                "Dealer service returned an invalid response",
            ),
        )
    return JsonResponse({"status": 200, "dealer": dealer})


@require_GET
def get_dealer_reviews(request, dealer_id):
    try:
        reviews = restapis.get_request(f"/fetchReviews/dealer/{dealer_id}")
        if not isinstance(reviews, list):
            raise restapis.DownstreamServiceError(
                "Dealer service returned an invalid response",
            )

        enriched_reviews = []
        for review in reviews:
            if not isinstance(review, dict) or not isinstance(
                review.get("review"),
                str,
            ):
                raise restapis.DownstreamServiceError(
                    "Dealer service returned an invalid response",
                )
            sentiment = restapis.analyze_review_sentiments(review["review"])
            enriched_reviews.append({**review, "sentiment": sentiment["sentiment"]})
    except restapis.DownstreamServiceError as error:
        return _downstream_error(error)

    return JsonResponse({"status": 200, "reviews": enriched_reviews})


@csrf_exempt
@require_POST
def add_review(request):
    if not request.user.is_authenticated:
        return JsonResponse(
            {"status": 401, "error": "Authentication required"},
            status=401,
        )

    data, error_response = _json_body(request)
    if error_response:
        return error_response

    required_fields = (
        "dealership",
        "review",
        "purchase",
        "purchase_date",
        "car_make",
        "car_model",
        "car_year",
    )
    missing = [
        field
        for field in required_fields
        if field not in data
        or data[field] is None
        or (isinstance(data[field], str) and not data[field].strip())
    ]
    if missing:
        return JsonResponse(
            {
                "status": 400,
                "error": f"Missing required fields: {', '.join(missing)}",
            },
            status=400,
        )

    try:
        dealership = int(data["dealership"])
        car_year = int(data["car_year"])
    except (TypeError, ValueError):
        return JsonResponse(
            {"status": 400, "error": "Invalid dealership or car year"},
            status=400,
        )

    text_fields = ("review", "purchase_date", "car_make", "car_model")
    if (
        dealership < 1
        or not 2015 <= car_year <= 2023
        or not isinstance(data["purchase"], bool)
        or any(not isinstance(data[field], str) for field in text_fields)
    ):
        return JsonResponse(
            {"status": 400, "error": "Invalid review data"},
            status=400,
        )

    reviewer_name = request.user.get_full_name().strip() or request.user.username
    review_data = {
        "name": reviewer_name,
        "dealership": dealership,
        "review": data["review"].strip(),
        "purchase": data["purchase"],
        "purchase_date": data["purchase_date"].strip(),
        "car_make": data["car_make"].strip(),
        "car_model": data["car_model"].strip(),
        "car_year": car_year,
    }

    try:
        saved_review = restapis.post_review(review_data)
    except restapis.DownstreamServiceError as error:
        return _downstream_error(error)

    if not isinstance(saved_review, dict):
        return _downstream_error(
            restapis.DownstreamServiceError(
                "Dealer service returned an invalid response",
            ),
        )
    return JsonResponse({"status": 200, "review": saved_review})


def _json_body(request):
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None, JsonResponse({"error": "Invalid JSON body"}, status=400)

    if not isinstance(data, dict):
        return None, JsonResponse({"error": "Invalid JSON body"}, status=400)

    return data, None


def _missing_fields(data, fields):
    return [field for field in fields if not data.get(field)]


@csrf_exempt
@require_POST
def login_user(request):
    data, error_response = _json_body(request)
    if error_response:
        return error_response

    missing = _missing_fields(data, ("userName", "password"))
    if missing:
        return JsonResponse(
            {"error": f"Missing required fields: {', '.join(missing)}"},
            status=400,
        )

    username = data["userName"]
    user = authenticate(username=username, password=data["password"])
    if user is None:
        return JsonResponse(
            {"userName": username, "error": "Invalid credentials"},
            status=401,
        )

    login(request, user)
    return JsonResponse({"userName": username, "status": "Authenticated"})


def logout_user(request):
    logout(request)
    return JsonResponse({"status": "Logged out"})


@csrf_exempt
@require_POST
def registration(request):
    data, error_response = _json_body(request)
    if error_response:
        return error_response

    required_fields = ("userName", "firstName", "lastName", "email", "password")
    missing = _missing_fields(data, required_fields)
    if missing:
        return JsonResponse(
            {"error": f"Missing required fields: {', '.join(missing)}"},
            status=400,
        )

    username = data["userName"]
    if User.objects.filter(username=username).exists():
        return JsonResponse(
            {"userName": username, "error": "Already registered"},
            status=409,
        )

    user = User.objects.create_user(
        username=username,
        first_name=data["firstName"],
        last_name=data["lastName"],
        email=data["email"],
        password=data["password"],
    )
    login(request, user)
    return JsonResponse(
        {"userName": username, "status": "Authenticated"},
        status=201,
    )
