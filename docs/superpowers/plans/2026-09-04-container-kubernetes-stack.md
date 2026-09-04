# Containerized Kubernetes Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and locally prove a provider-neutral Kubernetes deployment of the complete Django/React, Express, MongoDB, and sentiment-analysis stack.

**Architecture:** Build three non-root application images and deploy them as separate Kubernetes workloads connected by ClusterIP Services; expose only the web Service. Persist MongoDB and Django SQLite data, use Kustomize for portable image substitution and secret generation, and validate the full user journey on the installed Kind cluster.

**Tech Stack:** Docker 29, multi-stage Dockerfiles, Python 3.12, Node.js 24, Gunicorn 26.2.0, WhiteNoise 6.12.0, MongoDB 8.0, Kubernetes 1.34, kubectl/Kustomize 5.8, Kind 0.30

**Spec:** `docs/superpowers/specs/2026-09-04-container-kubernetes-stack-design.md`

## Global Constraints

- Keep browsers talking only to Django; only Express may access MongoDB.
- Expose only the Django/React web Service outside the cluster.
- Keep the web Deployment at one replica because SQLite is a single-writer database.
- Persist MongoDB reviews and Django users, sessions, makes, and models across pod restarts.
- Never delete existing dealer or review records during application startup.
- Keep image names provider-neutral and replaceable through Kustomize.
- Do not commit credentials, registry URLs, or `k8s/base/secrets.env`.
- Do not add cloud-specific resources, a managed database, an ingress controller, or continuous deployment.
- Preserve existing routes, payloads, and user-safe downstream 502 responses.
- Use focused tests first, then all repository lint and test suites.

---

### Task 1: Environment-driven Django production configuration

**Files:**
- Create: `server/djangoapp/config.py`
- Modify: `server/djangoapp/tests.py`
- Modify: `server/djangoproj/settings.py`
- Modify: `server/requirements.txt`

**Interfaces:**
- Consumes: process environment variables and the existing Django settings module.
- Produces: `env_bool(name, default=False)` and `env_list(name, default=())`; settings for `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`, and `DJANGO_DB_PATH`.

- [ ] **Step 1: Add failing configuration-helper tests**

Add `import os` and these imports near the top of `server/djangoapp/tests.py`:

```python
from .config import env_bool, env_list
```

Add this test class:

```python
class EnvironmentConfigurationTests(SimpleTestCase):
    @patch.dict(os.environ, {"FEATURE_FLAG": "true"}, clear=False)
    def test_env_bool_accepts_true(self):
        self.assertTrue(env_bool("FEATURE_FLAG"))

    @patch.dict(os.environ, {"HOSTS": "app.example, api.example"}, clear=False)
    def test_env_list_splits_and_strips_values(self):
        self.assertEqual(env_list("HOSTS"), ["app.example", "api.example"])

    @patch.dict(os.environ, {}, clear=True)
    def test_environment_helpers_use_defaults(self):
        self.assertFalse(env_bool("FEATURE_FLAG"))
        self.assertEqual(env_list("HOSTS", ["localhost"]), ["localhost"])
```

- [ ] **Step 2: Run the focused tests and confirm the missing module failure**

Run:

```bash
server/.venv/bin/python server/manage.py test djangoapp.tests.EnvironmentConfigurationTests
```

Expected: FAIL because `djangoapp.config` does not exist.

- [ ] **Step 3: Implement the environment helpers**

Create `server/djangoapp/config.py`:

```python
import os


TRUE_VALUES = {"1", "true", "yes", "on"}


def env_bool(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in TRUE_VALUES


def env_list(name, default=()):
    value = os.getenv(name)
    if value is None:
        return list(default)
    return [item.strip() for item in value.split(",") if item.strip()]
```

- [ ] **Step 4: Wire production settings and static-file serving**

In `server/djangoproj/settings.py`, import the helpers:

```python
from djangoapp.config import env_bool, env_list
```

Replace the hard-coded security settings with:

```python
SECRET_KEY = os.getenv(
    "DJANGO_SECRET_KEY",
    "django-insecure-local-development-only",
)
DEBUG = env_bool("DJANGO_DEBUG", default=True)
ALLOWED_HOSTS = env_list(
    "DJANGO_ALLOWED_HOSTS",
    default=["localhost", "127.0.0.1", "testserver"],
)
CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS")
```

Place WhiteNoise immediately after Django's security middleware:

```python
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
```

Replace the SQLite name with:

```python
'NAME': Path(os.getenv("DJANGO_DB_PATH", BASE_DIR / "db.sqlite3")),
```

Add after the static-file settings:

```python
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}
```

Replace `server/requirements.txt` with:

```text
requests
Django
Pillow
gunicorn==26.2.0
python-dotenv
whitenoise==6.12.0
```

- [ ] **Step 5: Install dependencies and verify the focused tests**

Run:

```bash
server/.venv/bin/python -m pip install -r server/requirements.txt
server/.venv/bin/python server/manage.py test djangoapp.tests.EnvironmentConfigurationTests
DJANGO_DEBUG=false DJANGO_ALLOWED_HOSTS=example.test DJANGO_DB_PATH=/tmp/dealership-settings.sqlite3 server/.venv/bin/python server/manage.py check --deploy
```

Expected: helper tests pass; the deployment check completes and may report only Django hardening warnings not applicable behind an external TLS-terminating LoadBalancer.

- [ ] **Step 6: Run Django lint and tests**

Run:

```bash
server/.venv/bin/python -m flake8 server --max-line-length=100 --extend-exclude=server/.venv,server/frontend/node_modules,server/database/node_modules,server/djangoapp/migrations
server/.venv/bin/python server/manage.py test djangoapp
```

Expected: lint exits 0 and all Django tests pass.

- [ ] **Step 7: Commit Django production configuration**

```bash
git add server/djangoapp/config.py server/djangoapp/tests.py server/djangoproj/settings.py server/requirements.txt
git commit -m "feat: configure Django container runtime"
```

---

### Task 2: Idempotent Django initialization and web image

**Files:**
- Create: `server/djangoapp/management/__init__.py`
- Create: `server/djangoapp/management/commands/__init__.py`
- Create: `server/djangoapp/management/commands/seed_cars.py`
- Create: `server/docker-entrypoint.sh`
- Create: `server/Dockerfile`
- Create: `server/.dockerignore`
- Modify: `server/djangoapp/tests.py`

**Interfaces:**
- Consumes: `djangoapp.populate.initiate`, `DJANGO_DB_PATH`, and the React package lock.
- Produces: `python manage.py seed_cars`; image `dealership-web:dev` listening on port 8000.

- [ ] **Step 1: Add a failing idempotent seed-command test**

Add imports to `server/djangoapp/tests.py`:

```python
from django.core.management import call_command
from djangoapp.models import CarMake, CarModel
```

Add:

```python
class SeedCarsCommandTests(TestCase):
    def test_seed_cars_is_idempotent(self):
        call_command("seed_cars")
        call_command("seed_cars")

        self.assertEqual(CarMake.objects.count(), 2)
        self.assertEqual(CarModel.objects.count(), 2)
```

- [ ] **Step 2: Confirm the management command is absent**

Run:

```bash
server/.venv/bin/python server/manage.py test djangoapp.tests.SeedCarsCommandTests
```

Expected: FAIL with `Unknown command: 'seed_cars'`.

- [ ] **Step 3: Implement the seed command**

Create empty `__init__.py` files in both management directories, then create
`server/djangoapp/management/commands/seed_cars.py`:

```python
from django.core.management.base import BaseCommand

from djangoapp.populate import initiate


class Command(BaseCommand):
    help = "Create or update the initial dealership car inventory"

    def handle(self, *args, **options):
        initiate()
        self.stdout.write(self.style.SUCCESS("Car inventory initialized"))
```

- [ ] **Step 4: Add the web entrypoint**

Create `server/docker-entrypoint.sh`:

```sh
#!/bin/sh
set -eu

python manage.py migrate --noinput
python manage.py seed_cars
exec gunicorn djangoproj.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers 2 \
  --timeout 60
```

- [ ] **Step 5: Add the multi-stage web Dockerfile**

Create `server/Dockerfile`:

```dockerfile
FROM node:24-bookworm-slim AS frontend-builder
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/public ./public
COPY frontend/src ./src
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_DEBUG=false \
    DJANGO_DB_PATH=/data/db.sqlite3
WORKDIR /app
RUN groupadd --gid 10001 app && useradd --uid 10001 --gid app --no-create-home app \
    && mkdir /data && chown app:app /data
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY --chown=app:app . .
COPY --from=frontend-builder --chown=app:app /build/frontend/build ./frontend/build
RUN chmod 755 docker-entrypoint.sh
RUN python manage.py collectstatic --noinput
USER app
EXPOSE 8000
ENTRYPOINT ["./docker-entrypoint.sh"]
```

Create `server/.dockerignore`:

```text
.venv
**/__pycache__
**/*.pyc
db.sqlite3
frontend/build
frontend/node_modules
database
djangoapp/microservices
```

- [ ] **Step 6: Verify initialization and build the web image**

Run:

```bash
server/.venv/bin/python server/manage.py test djangoapp.tests.SeedCarsCommandTests
docker build -t dealership-web:dev server
docker run --rm --entrypoint python dealership-web:dev manage.py check --deploy
```

Expected: the test passes, the image builds, and Django's deployment check runs successfully with only documented TLS hardening warnings.

- [ ] **Step 7: Smoke-test the web image**

Run the image in one terminal:

```bash
docker run --rm --name dealership-web-smoke \
  -p 8000:8000 \
  -e DJANGO_SECRET_KEY=local-container-smoke-secret \
  -e DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1 \
  dealership-web:dev
```

In another terminal run:

```bash
curl --fail http://127.0.0.1:8000/
docker stop dealership-web-smoke
```

Expected: curl exits 0 and returns the Best Cars landing HTML.

- [ ] **Step 8: Commit the web container**

```bash
git add server/Dockerfile server/.dockerignore server/docker-entrypoint.sh server/djangoapp/management server/djangoapp/tests.py
git commit -m "build: containerize Django and React"
```

---

### Task 3: Non-destructive Express seeding and production image

**Files:**
- Modify: `server/database/app.js`
- Modify: `server/database/app.test.js`
- Modify: `server/database/Dockerfile`

**Interfaces:**
- Consumes: bundled dealership/review JSON and `MONGO_URL`.
- Produces: exported `seedDatabase({ ReviewModel, DealershipModel })`; image `dealer-api:dev` on port 3030 that seeds only empty collections.

- [ ] **Step 1: Add failing non-destructive seed tests**

Add this import after the JSON fixture imports in `server/database/app.test.js`:

```javascript
const { createApp, seedDatabase } = require('./app');
```

Remove the local `require('./app')` from the existing `before` callback, then add:

```javascript
test('seedDatabase preserves populated collections', async () => {
  const model = {
    countDocuments: async () => 1,
    insertMany: async () => assert.fail('must not replace existing records'),
  };

  await seedDatabase({ ReviewModel: model, DealershipModel: model });
});

test('seedDatabase initializes empty collections', async () => {
  const inserted = [];
  const model = {
    countDocuments: async () => 0,
    insertMany: async (documents) => inserted.push(documents),
  };

  await seedDatabase({ ReviewModel: model, DealershipModel: model });

  assert.equal(inserted.length, 2);
  assert.ok(inserted.every((documents) => documents.length > 0));
});
```

- [ ] **Step 2: Confirm the preservation test fails**

Run:

```bash
npm test --prefix server/database
```

Expected: FAIL because the current `seedDatabase` ignores injected models and calls `deleteMany`.

- [ ] **Step 3: Implement seed-only-when-empty behavior**

Replace `seedDatabase` in `server/database/app.js` with:

```javascript
async function seedCollection(Model, documents) {
  if (await Model.countDocuments() === 0) {
    await Model.insertMany(documents);
  }
}

async function seedDatabase({
  ReviewModel = Reviews,
  DealershipModel = Dealerships,
} = {}) {
  const reviews = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'data', 'reviews.json'), 'utf8'),
  ).reviews;
  const dealerships = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'data', 'dealerships.json'), 'utf8'),
  ).dealerships;

  await Promise.all([
    seedCollection(ReviewModel, reviews),
    seedCollection(DealershipModel, dealerships),
  ]);
}
```

Keep `startServer()` calling `seedDatabase()` and retain this export:

```javascript
module.exports = { createApp, seedDatabase, startServer };
```

- [ ] **Step 4: Replace the Express Dockerfile with a locked non-root build**

Set `server/database/Dockerfile` to:

```dockerfile
FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --chown=node:node app.js dealership.js inventory.js review.js ./
COPY --chown=node:node data ./data
USER node
EXPOSE 3030
CMD ["node", "app.js"]
```

- [ ] **Step 5: Verify Express and build its image**

Run:

```bash
npm run lint --prefix server/database
npm test --prefix server/database
docker build -t dealer-api:dev server/database
```

Expected: lint and all Express tests pass; the image builds.

- [ ] **Step 6: Commit Express persistence behavior**

```bash
git add server/database/app.js server/database/app.test.js server/database/Dockerfile
git commit -m "fix: preserve dealership data across restarts"
```

---

### Task 4: Self-contained sentiment image

**Files:**
- Create: `server/djangoapp/microservices/test_app.py`
- Modify: `server/djangoapp/microservices/app.py`
- Modify: `server/djangoapp/microservices/requirements.txt`
- Modify: `server/djangoapp/microservices/Dockerfile`

**Interfaces:**
- Consumes: bundled `sentiment/vader_lexicon.zip`.
- Produces: JSON `{"sentiment": "positive|negative|neutral"}` from `/analyze/<text>`; image `sentiment:dev` on port 5050.

- [ ] **Step 1: Add a focused sentiment API test**

Create `server/djangoapp/microservices/test_app.py`:

```python
import unittest

from app import app


class SentimentApiTests(unittest.TestCase):
    def test_analyze_returns_json_sentiment(self):
        response = app.test_client().get("/analyze/I%20love%20this%20car")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"sentiment": "positive"})


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Confirm the bundled lexicon/JSON test fails**

Run:

```bash
server/.venv/bin/python -m pip install -r server/djangoapp/microservices/requirements.txt
cd server/djangoapp/microservices && ../../.venv/bin/python -m unittest test_app.py
```

Expected: FAIL because NLTK cannot reliably discover the bundled lexicon or the response is not declared as JSON.

- [ ] **Step 3: Configure bundled NLTK data and return native JSON**

At the top of `server/djangoapp/microservices/app.py`, use:

```python
from pathlib import Path

from flask import Flask
import nltk
from nltk.sentiment import SentimentIntensityAnalyzer


nltk.data.path.insert(0, str(Path(__file__).resolve().parent))
app = Flask("Sentiment Analyzer")
sia = SentimentIntensityAnalyzer()
```

Replace the final JSON serialization in `analyze_sentiment` with:

```python
    return {"sentiment": res}
```

Remove the unused `json` import and debug `print` calls.

- [ ] **Step 4: Add Gunicorn and replace the sentiment Dockerfile**

Set `server/djangoapp/microservices/requirements.txt` to:

```text
Flask
nltk
gunicorn==26.2.0
```

Set `server/djangoapp/microservices/Dockerfile` to:

```dockerfile
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    NLTK_DATA=/app
WORKDIR /app
RUN groupadd --gid 10001 app && useradd --uid 10001 --gid app --no-create-home app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY --chown=app:app app.py ./
COPY --chown=app:app sentiment ./sentiment
USER app
EXPOSE 5050
CMD ["gunicorn", "--bind", "0.0.0.0:5050", "--workers", "2", "app:app"]
```

- [ ] **Step 5: Verify sentiment behavior and image**

Run:

```bash
cd server/djangoapp/microservices && ../../.venv/bin/python -m unittest test_app.py
cd ../../.. && server/.venv/bin/python -m flake8 server/djangoapp/microservices --max-line-length=100
docker build -t sentiment:dev server/djangoapp/microservices
```

Expected: test and lint pass; image builds without downloading NLTK data at runtime.

- [ ] **Step 6: Commit the sentiment container**

```bash
git add server/djangoapp/microservices/app.py server/djangoapp/microservices/test_app.py server/djangoapp/microservices/requirements.txt server/djangoapp/microservices/Dockerfile
git commit -m "build: make sentiment service self-contained"
```

---

### Task 5: Provider-neutral Kustomize resources

**Files:**
- Create: `k8s/base/kustomization.yaml`
- Create: `k8s/base/namespace.yaml`
- Create: `k8s/base/configmap.yaml`
- Create: `k8s/base/mongodb.yaml`
- Create: `k8s/base/dealer-api.yaml`
- Create: `k8s/base/sentiment.yaml`
- Create: `k8s/base/web.yaml`
- Create: `k8s/base/secrets.env.example`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: images `dealership-web:dev`, `dealer-api:dev`, `sentiment:dev`, official `mongo:8.0`, and untracked `k8s/base/secrets.env`.
- Produces: namespace `dealership`; Services `mongo`, `dealer-api`, `sentiment`, and `web`; durable claims for MongoDB and Django.

- [ ] **Step 1: Protect the real secret and add the local example**

Append to `.gitignore`:

```text
k8s/base/secrets.env
```

Create `k8s/base/secrets.env.example`:

```text
DJANGO_SECRET_KEY=unsafe-local-kind-development-key
```

- [ ] **Step 2: Add namespace and shared configuration**

Create `k8s/base/namespace.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: dealership
```

Create `k8s/base/configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: dealership-config
data:
  DJANGO_DEBUG: "false"
  DJANGO_ALLOWED_HOSTS: "*"
  DJANGO_DB_PATH: /data/db.sqlite3
  backend_url: http://dealer-api:3030
  sentiment_analyzer_url: http://sentiment:5050
  MONGO_URL: mongodb://mongo:27017/dealershipsDB
```

- [ ] **Step 3: Add persistent MongoDB**

Create `k8s/base/mongodb.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mongo
spec:
  clusterIP: None
  selector:
    app.kubernetes.io/name: mongo
  ports:
    - name: mongodb
      port: 27017
      targetPort: mongodb
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mongo
spec:
  serviceName: mongo
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: mongo
  template:
    metadata:
      labels:
        app.kubernetes.io/name: mongo
    spec:
      containers:
        - name: mongo
          image: mongo:8.0
          imagePullPolicy: IfNotPresent
          ports:
            - name: mongodb
              containerPort: 27017
          startupProbe:
            tcpSocket:
              port: mongodb
            periodSeconds: 5
            failureThreshold: 30
          readinessProbe:
            tcpSocket:
              port: mongodb
            periodSeconds: 10
          livenessProbe:
            tcpSocket:
              port: mongodb
            periodSeconds: 20
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          volumeMounts:
            - name: mongo-data
              mountPath: /data/db
  volumeClaimTemplates:
    - metadata:
        name: mongo-data
      spec:
        accessModes: [ReadWriteOnce]
        resources:
          requests:
            storage: 1Gi
```

- [ ] **Step 4: Add the internal Express workload**

Create `k8s/base/dealer-api.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: dealer-api
spec:
  selector:
    app.kubernetes.io/name: dealer-api
  ports:
    - name: http
      port: 3030
      targetPort: http
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dealer-api
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: dealer-api
  template:
    metadata:
      labels:
        app.kubernetes.io/name: dealer-api
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
      containers:
        - name: dealer-api
          image: dealer-api:dev
          imagePullPolicy: IfNotPresent
          env:
            - name: MONGO_URL
              valueFrom:
                configMapKeyRef:
                  name: dealership-config
                  key: MONGO_URL
          ports:
            - name: http
              containerPort: 3030
          startupProbe:
            httpGet:
              path: /
              port: http
            periodSeconds: 5
            failureThreshold: 30
          readinessProbe:
            httpGet:
              path: /
              port: http
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /
              port: http
            periodSeconds: 20
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
```

- [ ] **Step 5: Add the internal sentiment workload**

Create `k8s/base/sentiment.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: sentiment
spec:
  selector:
    app.kubernetes.io/name: sentiment
  ports:
    - name: http
      port: 5050
      targetPort: http
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sentiment
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: sentiment
  template:
    metadata:
      labels:
        app.kubernetes.io/name: sentiment
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 10001
        runAsGroup: 10001
      containers:
        - name: sentiment
          image: sentiment:dev
          imagePullPolicy: IfNotPresent
          ports:
            - name: http
              containerPort: 5050
          startupProbe:
            httpGet:
              path: /
              port: http
            periodSeconds: 5
            failureThreshold: 30
          readinessProbe:
            httpGet:
              path: /
              port: http
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /
              port: http
            periodSeconds: 20
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
```

- [ ] **Step 6: Add persistent, externally reachable web workload**

Create `k8s/base/web.yaml`:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: web-data
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 1Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app.kubernetes.io/name: web
  template:
    metadata:
      labels:
        app.kubernetes.io/name: web
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 10001
        runAsGroup: 10001
        fsGroup: 10001
      containers:
        - name: web
          image: dealership-web:dev
          imagePullPolicy: IfNotPresent
          envFrom:
            - configMapRef:
                name: dealership-config
            - secretRef:
                name: dealership-secrets
          ports:
            - name: http
              containerPort: 8000
          startupProbe:
            httpGet:
              path: /
              port: http
            periodSeconds: 5
            failureThreshold: 30
          readinessProbe:
            httpGet:
              path: /
              port: http
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /
              port: http
            periodSeconds: 20
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: "1"
              memory: 512Mi
          volumeMounts:
            - name: web-data
              mountPath: /data
      volumes:
        - name: web-data
          persistentVolumeClaim:
            claimName: web-data
---
apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  type: LoadBalancer
  selector:
    app.kubernetes.io/name: web
  ports:
    - name: http
      port: 80
      targetPort: http
```

- [ ] **Step 7: Compose resources with Kustomize**

Create `k8s/base/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: dealership
resources:
  - namespace.yaml
  - configmap.yaml
  - mongodb.yaml
  - dealer-api.yaml
  - sentiment.yaml
  - web.yaml
secretGenerator:
  - name: dealership-secrets
    envs:
      - secrets.env
generatorOptions:
  disableNameSuffixHash: true
images:
  - name: dealership-web
    newTag: dev
  - name: dealer-api
    newTag: dev
  - name: sentiment
    newTag: dev
```

- [ ] **Step 8: Render and validate the resources**

Run:

```bash
cp k8s/base/secrets.env.example k8s/base/secrets.env
kubectl kustomize k8s/base > /tmp/dealership-rendered.yaml
kubectl apply --dry-run=client -f /tmp/dealership-rendered.yaml
git status --short
```

Expected: rendering and client validation succeed; `secrets.env` remains absent
from Git status.

- [ ] **Step 9: Commit Kubernetes resources**

```bash
git add .gitignore k8s/base
git commit -m "feat: add provider-neutral Kubernetes stack"
```

---

### Task 6: Deployment guide and complete Kind acceptance test

**Files:**
- Create: `k8s/README.md`

**Interfaces:**
- Consumes: all images and `k8s/base`; installed Docker, kubectl, Kustomize, and Kind.
- Produces: repeatable local and cloud-neutral deployment instructions plus acceptance evidence for the graded user journeys.

- [ ] **Step 1: Write the deployment guide**

Create `k8s/README.md` documenting these exact local commands:

```bash
docker build -t dealership-web:dev server
docker build -t dealer-api:dev server/database
docker build -t sentiment:dev server/djangoapp/microservices

if ! kind get clusters | grep -qx dealership; then
  kind create cluster --name dealership --wait 5m
fi
kind load docker-image dealership-web:dev dealer-api:dev sentiment:dev --name dealership

cp k8s/base/secrets.env.example k8s/base/secrets.env
kubectl apply -k k8s/base
kubectl rollout status statefulset/mongo -n dealership --timeout=5m
kubectl rollout status deployment/dealer-api -n dealership --timeout=5m
kubectl rollout status deployment/sentiment -n dealership --timeout=5m
kubectl rollout status deployment/web -n dealership --timeout=5m
kubectl get pods,services,pvc -n dealership
kubectl port-forward service/web 8000:80 -n dealership
```

Document cloud image substitution without modifying the repository by copying
the base into a temporary directory and running:

```bash
: "${IMAGE_REGISTRY:?Set IMAGE_REGISTRY to your cloud registry/repository prefix}"
: "${IMAGE_TAG:?Set IMAGE_TAG to an immutable release tag}"
DEPLOY_DIR="$(mktemp -d)"
cp -R k8s/base/. "$DEPLOY_DIR/"
(
  cd "$DEPLOY_DIR"
  kustomize edit set image \
    dealership-web="${IMAGE_REGISTRY}/dealership-web:${IMAGE_TAG}" \
    dealer-api="${IMAGE_REGISTRY}/dealer-api:${IMAGE_TAG}" \
    sentiment="${IMAGE_REGISTRY}/sentiment:${IMAGE_TAG}"
)
kubectl apply -k "$DEPLOY_DIR"
```

Explain that the cloud operator must export `IMAGE_REGISTRY` and `IMAGE_TAG`
before running the snippet and that standalone `kustomize` is required only for
the `edit set image` command.
Document `kubectl delete -k k8s/base` and `kind delete cluster --name dealership`
as cleanup commands, noting that deletion removes local test data.

- [ ] **Step 2: Run every repository lint and test suite**

Run:

```bash
server/.venv/bin/python -m flake8 server --max-line-length=100 --extend-exclude=server/.venv,server/frontend/node_modules,server/database/node_modules,server/djangoapp/migrations
npm run lint --prefix server/frontend
npm run lint --prefix server/database
server/.venv/bin/python server/manage.py test djangoapp
CI=true npm test --prefix server/frontend -- --watchAll=false
npm test --prefix server/database
(cd server/djangoapp/microservices && ../../.venv/bin/python -m unittest test_app.py)
npm run build --prefix server/frontend
```

Expected: all linters, tests, and the React production build pass.

- [ ] **Step 3: Rebuild and load immutable local images**

Run:

```bash
docker build -t dealership-web:dev server
docker build -t dealer-api:dev server/database
docker build -t sentiment:dev server/djangoapp/microservices
kind load docker-image dealership-web:dev dealer-api:dev sentiment:dev --name dealership
```

Expected: all builds and image loads exit 0.

- [ ] **Step 4: Deploy and wait for the complete stack**

Run:

```bash
cp k8s/base/secrets.env.example k8s/base/secrets.env
kubectl apply -k k8s/base
kubectl rollout status statefulset/mongo -n dealership --timeout=5m
kubectl rollout status deployment/dealer-api -n dealership --timeout=5m
kubectl rollout status deployment/sentiment -n dealership --timeout=5m
kubectl rollout status deployment/web -n dealership --timeout=5m
kubectl get pods,services,pvc -n dealership
```

Expected: all four workloads become Ready and both claims are Bound.

- [ ] **Step 5: Exercise the application through Django**

Run port-forwarding in a separate terminal:

```bash
kubectl port-forward service/web 8000:80 -n dealership
```

Then run:

```bash
curl --fail http://127.0.0.1:8000/
curl --fail http://127.0.0.1:8000/djangoapp/get_dealers
curl --fail http://127.0.0.1:8000/djangoapp/dealer/3

curl --fail -c /tmp/dealership.cookies \
  -H 'Content-Type: application/json' \
  -d '{"userName":"kind-reviewer","firstName":"Kind","lastName":"Reviewer","email":"kind@example.test","password":"local-test-password"}' \
  http://127.0.0.1:8000/djangoapp/register

curl --fail -b /tmp/dealership.cookies \
  -H 'Content-Type: application/json' \
  -d '{"dealership":3,"review":"Excellent Kubernetes deployment","purchase":true,"purchase_date":"2026-09-04","car_make":"Toyota","car_model":"Camry","car_year":2022}' \
  http://127.0.0.1:8000/djangoapp/add_review

curl --fail http://127.0.0.1:8000/djangoapp/reviews/dealer/3
```

Expected: landing HTML loads; dealer endpoints return status 200 payloads; registration authenticates `kind-reviewer`; review insertion succeeds; the review list contains `Excellent Kubernetes deployment` with positive sentiment.

- [ ] **Step 6: Prove persistence across application restarts**

Run:

```bash
kubectl rollout restart deployment/web deployment/dealer-api -n dealership
kubectl rollout status deployment/web -n dealership --timeout=5m
kubectl rollout status deployment/dealer-api -n dealership --timeout=5m
```

Restart port-forwarding if needed, then run:

```bash
curl --fail -c /tmp/dealership.cookies \
  -H 'Content-Type: application/json' \
  -d '{"userName":"kind-reviewer","password":"local-test-password"}' \
  http://127.0.0.1:8000/djangoapp/login
curl --fail http://127.0.0.1:8000/djangoapp/reviews/dealer/3
```

Expected: login still authenticates and the submitted review still appears.

- [ ] **Step 7: Inspect final state and commit documentation**

Run:

```bash
git diff --check
git status --short --branch
```

Expected: no whitespace errors; only `k8s/README.md` is uncommitted and the ignored secret is not listed.

Commit:

```bash
git add k8s/README.md
git commit -m "docs: add Kubernetes deployment guide"
```

- [ ] **Step 8: Preserve the running cluster for user verification**

Run:

```bash
kubectl get pods,services,pvc -n dealership
git status --short --branch
git log --oneline -7
```

Expected: workloads remain available for browser screenshots, the repository is clean, and the implementation commits are visible. Do not delete the namespace or Kind cluster until the user has completed grading verification.
