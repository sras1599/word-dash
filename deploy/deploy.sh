#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly WORD_DASH_NAMESPACE="word-dash"
readonly CLOUDFLARE_NAMESPACE="cloudflare"
readonly CLOUDFLARE_SECRET="cloudflared-credentials"

CLOUDFLARE_CREDENTIALS_FILE="${CLOUDFLARE_CREDENTIALS_FILE:-}"
ROLLOUT_TIMEOUT="${ROLLOUT_TIMEOUT:-5m}"
APP_VERSION="${APP_VERSION:-}"

usage() {
  cat <<'EOF'
Usage: deploy/deploy.sh [options]

Apply Word Dash and wait for every workload to become ready. By default, the
version pinned in deploy/k8s is used.

Options:
  --cloudflare-credentials FILE  Create or update the Cloudflare credentials
                                 secret from FILE. The existing in-cluster
                                 secret is reused when this option is omitted.
  --version VERSION              Deploy an immutable release tag such as v1.2.3.
  --timeout DURATION             Rollout timeout accepted by kubectl (default: 5m).
  -h, --help                     Show this help.

Environment variables:
  CLOUDFLARE_CREDENTIALS_FILE    Same as --cloudflare-credentials.
  APP_VERSION                    Same as --version.
  ROLLOUT_TIMEOUT                Same as --timeout.
EOF
}

log() {
  printf '\n==> %s\n' "$*"
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

while (($# > 0)); do
  case "$1" in
    --cloudflare-credentials)
      (($# >= 2)) || die "--cloudflare-credentials requires a file path"
      CLOUDFLARE_CREDENTIALS_FILE="$2"
      shift 2
      ;;
    --timeout)
      (($# >= 2)) || die "--timeout requires a duration"
      ROLLOUT_TIMEOUT="$2"
      shift 2
      ;;
    --version)
      (($# >= 2)) || die "--version requires a version"
      APP_VERSION="$2"
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      die "unknown option: $1"
      ;;
  esac
done

if [[ -n "$APP_VERSION" && ! "$APP_VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  die "version must be a stable SemVer tag in the form vX.Y.Z"
fi

command -v kubectl >/dev/null 2>&1 || die "kubectl is required"
K8S_MANIFESTS="$(kubectl kustomize "$SCRIPT_DIR/k8s")" || \
  die "the Word Dash manifests are invalid"

if [[ -z "$APP_VERSION" ]] && \
  grep -Eq \
    'ghcr\.io/sras1599/word-dash/(backend|frontend):v0\.0\.0([[:space:]]|$)' \
    <<<"$K8S_MANIFESTS"; then
  die "the Word Dash manifests still use the v0.0.0 placeholder; pass --version vX.Y.Z or pull the Flux commit that pins a published release"
fi

kubectl kustomize "$SCRIPT_DIR/cloudflare" >/dev/null || die "the Cloudflare manifests are invalid"
kubectl cluster-info >/dev/null || die "kubectl cannot connect to the current cluster"

if ! kubectl get customresourcedefinition \
  ingressroutes.traefik.io middlewares.traefik.io >/dev/null 2>&1; then
  die "Traefik and its CRDs must be installed before deploying Word Dash; see deploy/README.me"
fi

if [[ -z "$(kubectl get deployment \
  --all-namespaces \
  --selector app.kubernetes.io/name=traefik \
  --output name)" ]]; then
  die "a running Traefik deployment is required; see deploy/README.me"
fi

kubectl wait deployment \
  --all-namespaces \
  --selector app.kubernetes.io/name=traefik \
  --for condition=Available \
  --timeout "$ROLLOUT_TIMEOUT" >/dev/null || \
  die "the Traefik deployment did not become available within $ROLLOUT_TIMEOUT"

if [[ -n "$CLOUDFLARE_CREDENTIALS_FILE" ]]; then
  [[ -f "$CLOUDFLARE_CREDENTIALS_FILE" ]] || \
    die "Cloudflare credentials file does not exist: $CLOUDFLARE_CREDENTIALS_FILE"
elif ! kubectl get secret "$CLOUDFLARE_SECRET" \
  --namespace "$CLOUDFLARE_NAMESPACE" >/dev/null 2>&1; then
  die "Cloudflare credentials are required; pass --cloudflare-credentials FILE"
fi

log "Using Kubernetes context $(kubectl config current-context)"

log "Ensuring namespaces and the Cloudflare secret exist"
kubectl apply -f "$SCRIPT_DIR/k8s/namespace.yaml"
kubectl apply -f "$SCRIPT_DIR/cloudflare/namespace.yaml"

if [[ -n "$CLOUDFLARE_CREDENTIALS_FILE" ]]; then
  kubectl create secret generic "$CLOUDFLARE_SECRET" \
    --namespace "$CLOUDFLARE_NAMESPACE" \
    --from-file="credentials.json=$CLOUDFLARE_CREDENTIALS_FILE" \
    --dry-run=client \
    --output=yaml | kubectl apply -f -
else
  printf 'Reusing secret/%s in namespace %s.\n' \
    "$CLOUDFLARE_SECRET" "$CLOUDFLARE_NAMESPACE"
fi

log "Applying application manifests${APP_VERSION:+ at $APP_VERSION}"
if [[ -n "$APP_VERSION" ]]; then
  printf '%s\n' "$K8S_MANIFESTS" | \
    sed -E \
      -e "s#(ghcr.io/sras1599/word-dash/backend:)v[0-9]+\.[0-9]+\.[0-9]+#\\1$APP_VERSION#" \
      -e "s#(ghcr.io/sras1599/word-dash/frontend:)v[0-9]+\.[0-9]+\.[0-9]+#\\1$APP_VERSION#" | \
    kubectl apply -f -
else
  kubectl apply -k "$SCRIPT_DIR/k8s"
fi
kubectl apply -k "$SCRIPT_DIR/cloudflare"

log "Waiting for workloads to become ready (timeout: $ROLLOUT_TIMEOUT)"
for deployment in redis backend frontend; do
  kubectl rollout status "deployment/$deployment" \
    --namespace "$WORD_DASH_NAMESPACE" \
    --timeout "$ROLLOUT_TIMEOUT"
done
kubectl rollout status deployment/cloudflared \
  --namespace "$CLOUDFLARE_NAMESPACE" \
  --timeout "$ROLLOUT_TIMEOUT"

log "Deployment is ready"
kubectl get deployments,pods,services --namespace "$WORD_DASH_NAMESPACE"
kubectl get ingressroute --namespace "$WORD_DASH_NAMESPACE"
kubectl get deployments,pods --namespace "$CLOUDFLARE_NAMESPACE"
