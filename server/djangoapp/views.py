import json
import logging

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST


logger = logging.getLogger(__name__)


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
