import os
from urllib.parse import quote

import requests
from dotenv import load_dotenv


load_dotenv()

backend_url = os.getenv("backend_url", default="http://localhost:3030")
sentiment_analyzer_url = os.getenv(
    "sentiment_analyzer_url",
    default="http://localhost:5050/",
)
request_timeout = 5


class DownstreamServiceError(Exception):
    """Raised when a downstream service cannot return usable JSON."""


def _service_url(base_url, endpoint):
    return f"{base_url.rstrip('/')}/{endpoint.lstrip('/')}"


def _response_json(response, service_name):
    try:
        response.raise_for_status()
        data = response.json()
    except (requests.RequestException, ValueError) as error:
        raise DownstreamServiceError(
            f"{service_name} service is unavailable",
        ) from error

    if not isinstance(data, (dict, list)):
        raise DownstreamServiceError(
            f"{service_name} service returned an invalid response",
        )
    return data


def get_request(endpoint, **kwargs):
    try:
        response = requests.get(
            _service_url(backend_url, endpoint),
            params=kwargs or None,
            timeout=request_timeout,
        )
    except requests.RequestException as error:
        raise DownstreamServiceError(
            "Dealer service is unavailable",
        ) from error
    return _response_json(response, "Dealer")


def analyze_review_sentiments(text):
    endpoint = f"analyze/{quote(text, safe='')}"
    try:
        response = requests.get(
            _service_url(sentiment_analyzer_url, endpoint),
            timeout=request_timeout,
        )
    except requests.RequestException as error:
        raise DownstreamServiceError(
            "Sentiment service is unavailable",
        ) from error

    data = _response_json(response, "Sentiment")
    if not isinstance(data, dict) or data.get("sentiment") not in {
        "positive",
        "negative",
        "neutral",
    }:
        raise DownstreamServiceError(
            "Sentiment service returned an invalid response",
        )
    return data


def post_review(data_dict):
    try:
        response = requests.post(
            _service_url(backend_url, "/insert_review"),
            json=data_dict,
            timeout=request_timeout,
        )
    except requests.RequestException as error:
        raise DownstreamServiceError(
            "Dealer service is unavailable",
        ) from error
    return _response_json(response, "Dealer")
