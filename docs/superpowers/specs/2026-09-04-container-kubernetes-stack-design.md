# Containerized Kubernetes Stack Design

## Goal

Package and deploy the complete Best Cars dealership stack on any conformant
Kubernetes cluster without cloud-specific services. The deployed application
must support the graded landing, authentication, dealership, and review
journeys while preserving data across ordinary pod restarts.

## Scope

The stack comprises:

- a Django and React web application;
- the Express dealership and review API;
- MongoDB for dealerships and reviews;
- the Flask sentiment analyzer.

This change adds or updates container build definitions, production-safe
runtime configuration, persistent data initialization, provider-neutral
Kustomize resources, deployment documentation, and focused tests. It does not
add a cloud-specific registry, ingress controller, managed database, continuous
deployment job, or committed credential.

## Architecture

Only the web service is exposed outside the cluster:

```text
Browser
   |
LoadBalancer Service
   |
Django + React
   |-- ClusterIP --> Express API -- ClusterIP --> MongoDB StatefulSet
   `-- ClusterIP --> Sentiment analyzer
```

The web, Express, and sentiment applications each have an independent image and
workload. MongoDB uses its official image. Kubernetes DNS names are the only
service-discovery mechanism inside the cluster.

Kustomize uses logical image names and tagged images with
`imagePullPolicy: IfNotPresent`. Local Kind testing loads those images directly;
cloud deployments replace the same logical names with registry-qualified names
and immutable tags.

## Web Image and Runtime

`server/Dockerfile` is a multi-stage build. A Node.js stage installs the locked
frontend dependencies and produces the React build. A slim Python stage
installs `server/requirements.txt`, copies the Django source and built frontend,
collects static files, and runs as a non-root user.

The production process runs database migrations and idempotent car-data
initialization before starting Gunicorn on port 8000. The SQLite database lives
at an environment-configurable path mounted from a persistent volume. Because
SQLite has a single-writer architecture, the web Deployment remains at one
replica.

Django settings become environment-driven for:

- `DJANGO_SECRET_KEY`;
- `DJANGO_DEBUG`, defaulting to false in the container;
- `DJANGO_ALLOWED_HOSTS`;
- `DJANGO_CSRF_TRUSTED_ORIGINS`;
- `DJANGO_DB_PATH`;
- the existing `backend_url` and `sentiment_analyzer_url` service variables.

WhiteNoise serves collected static assets with Gunicorn. Development defaults
remain usable outside containers, but Kubernetes supplies all production
values explicitly.

## Express Image and Data Initialization

The existing Express image remains a separate production image on port 3030.
Its build uses the package lock and excludes development dependencies.

Startup waits for Kubernetes to restart the pod if MongoDB is not yet ready.
Once connected, seed data is inserted only when the corresponding collection is
empty. Existing dealerships and submitted reviews are never deleted during a
normal API restart. MongoDB stores its database on a persistent volume.

## Sentiment Image and Runtime

The sentiment image includes the bundled VADER lexicon, configures NLTK to find
it without downloading data at runtime, and runs Flask through Gunicorn on port
5050 as a non-root user. No external Code Engine service is required.

## Kubernetes Resources

`k8s/base` contains a Kustomization and focused resource files for:

- the `dealership` Namespace;
- shared non-secret configuration;
- a MongoDB Service, StatefulSet, and persistent volume claim template;
- an Express API Deployment and ClusterIP Service;
- a sentiment Deployment and ClusterIP Service;
- a web persistent volume claim, Deployment, and LoadBalancer Service.

Each workload defines CPU and memory requests/limits plus startup, readiness,
and liveness probes. Existing safe root endpoints are used where possible.
Workload selectors and Service selectors use stable `app.kubernetes.io/*`
labels.

Kustomize generates the Django Secret from an untracked `secrets.env` file.
The repository includes `secrets.env.example` containing variable names and
non-secret instructions. The real secret file is ignored by Git.

## Data Flow and Persistence

The browser sends all application requests to Django. Django uses the internal
`dealer-api` Service for dealerships and reviews and the internal `sentiment`
Service for review sentiment. Only Express talks to MongoDB.

Two persistent volumes are required:

- MongoDB data, including newly submitted reviews;
- Django's SQLite database, including users, sessions, car makes, and models.

The initial dealer/review JSON and car inventory are applied idempotently.
Restarting application pods must not erase user-created records.

## Failure Behavior

Kubernetes probes prevent unready containers from receiving traffic and restart
unhealthy containers. Express may restart while MongoDB starts; Django itself
can become ready independently of downstream services. If an internal service
is unavailable during a request, Django preserves its existing explicit,
user-safe 502 response rather than fabricating dealership or sentiment data.

If the required secret file, image, storage class, or LoadBalancer integration
is absent, deployment instructions surface that prerequisite and show the local
Kind alternative. Kind access uses port-forwarding because it does not supply a
cloud LoadBalancer by default.

## Deployment Workflow

`k8s/README.md` documents these provider-neutral steps:

1. build the web, Express, and sentiment images with immutable local tags;
2. create a Kind cluster and load the images for local testing, or push the
   images to the chosen cloud registry;
3. create `k8s/base/secrets.env` from the example and replace its secret value;
4. set cloud image names through Kustomize when a registry is used;
5. apply the base, wait for all rollouts, and inspect pods and services;
6. port-forward locally or obtain the cloud LoadBalancer address;
7. exercise landing, registration, login, dealer details, and review submission;
8. remove the test namespace or Kind cluster when finished.

No provider credentials or repository mutations are embedded in these steps.

## Verification

Focused automated tests cover:

- environment-driven Django settings and the SQLite path;
- idempotent Django car initialization;
- non-destructive Express seed behavior;
- sentiment operation using the bundled lexicon.

Repository verification includes all existing lint and test suites, a React
production build, Django's deployment checks, Docker builds for all three
images, static Kustomize rendering, server-side Kubernetes dry-run validation,
and a complete rollout on the installed Kind cluster.

The local acceptance test registers and logs in a user, loads the dealer list
and a dealer detail page, submits a review, verifies that review, restarts the
web and API pods, and confirms that the user and review still exist. Exact
commands and observed results are reported in the handoff.
