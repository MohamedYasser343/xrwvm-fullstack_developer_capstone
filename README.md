# Best Cars Dealership Review Portal

Best Cars is the Coursera Full-Stack Application Development Capstone. It lets visitors browse United States car dealerships, filter dealerships by state, and read customer reviews. Registered users can sign in and post reviews, while administrators manage car makes and models through Django admin.

## Architecture

- **Web application:** Django with a React frontend
- **Dealership and review service:** Express with MongoDB
- **Sentiment service:** Flask API used to classify review text
- **Car catalog:** Django models persisted in SQLite
- **Delivery:** GitHub Actions linting, Docker images, and Kubernetes manifests

The browser communicates with Django. Django owns authentication and car data and proxies dealership, review, and sentiment requests to the downstream services. Only the Express service accesses MongoDB.

## Main user journeys

- Browse every dealership or filter the directory by state.
- Open a dealership to view its details and sentiment-enriched reviews.
- Register, log in, log out, and submit a dealership review.
- Manage car makes and models through Django admin.
- View the public About Us and Contact Us pages.

## Repository layout

- `server/` — Django application and production container
- `server/frontend/` — React source and static public pages
- `server/database/` — Express/MongoDB dealership and review service
- `server/djangoapp/microservices/` — sentiment-analysis service
- `k8s/` — Kubernetes resources and deployment verification script
- `.github/workflows/main.yml` — continuous-integration workflow

## Local development

Install the Python and JavaScript dependencies, configure the downstream URLs with environment variables, and then run each service:

```bash
python -m venv .venv
.venv/bin/pip install -r server/requirements.txt
npm --prefix server/database ci
npm --prefix server/frontend ci

cd server
../.venv/bin/python manage.py migrate
../.venv/bin/python manage.py runserver
```

The Django site is available at `http://localhost:8000/`. The Express service defaults to port `3030`, and the sentiment service defaults to port `5050`.

## Verification

```bash
cd server
.venv/bin/python manage.py test
npm --prefix database test
CI=true npm --prefix frontend test -- --runInBand
npm --prefix frontend run lint
```

See [`k8s/README.md`](k8s/README.md) for the container and Kubernetes deployment workflow.
