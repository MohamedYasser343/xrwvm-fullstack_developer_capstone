import unittest

from app import app


class SentimentApiTests(unittest.TestCase):
    def test_analyze_returns_json_sentiment(self):
        response = app.test_client().get("/analyze/I%20love%20this%20car")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"sentiment": "positive"})


if __name__ == "__main__":
    unittest.main()
