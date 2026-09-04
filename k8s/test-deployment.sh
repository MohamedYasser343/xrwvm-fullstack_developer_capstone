#!/usr/bin/env bash

set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
manifest="${repository_root}/deployment.yml"

if [[ ! -f "${manifest}" ]]; then
  echo "Missing required manifest: deployment.yml" >&2
  exit 1
fi

expected_resources="$(cat <<'EOF'
configmap/dealership-config
deployment.apps/dealer-api
deployment.apps/sentiment
deployment.apps/web
namespace/dealership
persistentvolumeclaim/web-data
secret/dealership-secrets
service/dealer-api
service/mongo
service/sentiment
service/web
statefulset.apps/mongo
EOF
)"

actual_resources="$(
  kubectl apply --dry-run=client -f "${manifest}" -o name | sort
)"

if [[ "${actual_resources}" != "${expected_resources}" ]]; then
  echo "deployment.yml does not contain the complete dealership stack" >&2
  diff -u \
    <(printf '%s\n' "${expected_resources}") \
    <(printf '%s\n' "${actual_resources}")
  exit 1
fi

echo "deployment.yml contains the complete dealership stack"
