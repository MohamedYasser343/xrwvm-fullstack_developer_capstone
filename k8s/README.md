# Kubernetes deployment

This directory deploys the complete dealership stack: the Django/React web
application, dealer API, sentiment service, and MongoDB. The base uses standard
Kubernetes resources and Kustomize, so it can run on Kind or a managed
Kubernetes service without provider-specific manifests.

## Prerequisites

- Docker
- `kubectl` with built-in Kustomize support
- Kind for local deployment
- Standalone `kustomize` only when using the cloud image-substitution example

After installing Docker on Linux, sign out and back in after adding your user to
the `docker` group. Confirm access with `docker version` before continuing.

## Run locally with Kind

Run these commands from the repository root:

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

Open <http://127.0.0.1:8000> while port forwarding is running. A Kind cluster
does not provision an external address for the `LoadBalancer` service, so a
pending external IP is expected locally.

For grading systems that require one literal deployment artifact, the repository
root also contains `deployment.yml`. After building and loading the local images
as shown above, deploy that equivalent manifest with:

```bash
kubectl apply -f deployment.yml
```

The Kustomize files remain the maintainable source for environment-specific
configuration.

The example secret is suitable only for local development. Replace its value
with a strong, unique key before deploying anywhere else. `secrets.env` is
ignored by Git and must not be committed.

## Deploy to another Kubernetes provider

Build and push the three images to the provider's container registry. Export
the registry/repository prefix and an immutable release tag, then use a temporary
copy so the checked-in base remains unchanged:

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

Set a production `DJANGO_SECRET_KEY` in the temporary `secrets.env` before
applying. Standalone `kustomize` is needed only for `edit set image`; regular
deployment uses the Kustomize support built into `kubectl`. Configure the
provider's load balancer, TLS, DNS, storage class, image-pull credentials, and
`DJANGO_ALLOWED_HOSTS`/`DJANGO_CSRF_TRUSTED_ORIGINS` for the target environment.

The Django deployment intentionally has one replica and uses the `Recreate`
strategy because it stores SQLite data on a single-writer volume. MongoDB is a
single-node StatefulSet for this capstone deployment; production environments
should use an appropriately backed-up and replicated database service.

## Deploy the sentiment analyzer to IBM Code Engine

Install the IBM Cloud CLI and Code Engine plugin, then authenticate. From the
repository root, create or select a Code Engine project and deploy the existing
sentiment Dockerfile directly from its local source directory:

```bash
ibmcloud login --sso
ibmcloud target -r us-south
ibmcloud plugin install code-engine

# Run project creation once. If it already exists, only select it.
ibmcloud ce project create --name dealership
ibmcloud ce project select --name dealership

ibmcloud ce app create \
  --name dealership-sentiment \
  --build-source server/djangoapp/microservices \
  --strategy dockerfile \
  --port 5050 \
  --min-scale 1
```

Get the public application URL and verify the required endpoint:

```bash
SENTIMENT_URL="$(
  ibmcloud ce app get --name dealership-sentiment --output url
)"
echo "${SENTIMENT_URL}"
curl --fail "${SENTIMENT_URL}/analyze/Fantastic%20services"
```

The test response must contain `{"sentiment":"positive"}`. Configure Django's
`sentiment_analyzer_url` environment variable with `SENTIMENT_URL`; Django adds
the `/analyze/<text>` path itself. For example, to test the Code Engine service
from the current Kubernetes deployment:

```bash
kubectl set env deployment/web -n dealership \
  sentiment_analyzer_url="${SENTIMENT_URL}"
kubectl rollout status deployment/web -n dealership --timeout=5m
```

Reapplying `k8s/base` restores the cluster-local sentiment service URL.

## Inspect and troubleshoot

```bash
kubectl get pods,services,pvc -n dealership
kubectl describe pod -n dealership POD_NAME
kubectl logs -n dealership deployment/web
kubectl logs -n dealership deployment/dealer-api
kubectl logs -n dealership deployment/sentiment
kubectl logs -n dealership statefulset/mongo
```

## Cleanup

```bash
kubectl delete -k k8s/base
kind delete cluster --name dealership
```

These commands remove the local SQLite and MongoDB test data stored in the
cluster's persistent volumes.
