#!/usr/bin/env bash

set -Eeuo pipefail

readonly TEST_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly DEPLOY_DIR="$(cd -- "$TEST_DIR/.." && pwd)"
readonly DEPLOY_SCRIPT="$DEPLOY_DIR/deploy.sh"
readonly TEMP_DIR="$(mktemp -d)"
readonly FAKE_BIN="$TEMP_DIR/bin"

cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

assert_contains() {
  local file="$1"
  local expected="$2"

  grep -Fq -- "$expected" "$file" || \
    fail "expected $file to contain: $expected"
}

assert_not_contains() {
  local file="$1"
  local unexpected="$2"

  if grep -Fq -- "$unexpected" "$file"; then
    fail "expected $file not to contain: $unexpected"
  fi
}

mkdir -p "$FAKE_BIN"

cat >"$FAKE_BIN/kubectl" <<'EOF'
#!/usr/bin/env bash

set -Eeuo pipefail

printf '%s\n' "$*" >>"$KUBECTL_LOG"

case "$1" in
  kustomize)
    if [[ "$2" == */k8s ]]; then
      cat <<MANIFEST
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  template:
    spec:
      containers:
        - name: backend
          image: ghcr.io/sras1599/word-dash/backend:$FAKE_K8S_VERSION
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
spec:
  template:
    spec:
      containers:
        - name: frontend
          image: ghcr.io/sras1599/word-dash/frontend:$FAKE_K8S_VERSION
MANIFEST
    else
      printf '%s\n' 'apiVersion: v1' 'kind: ConfigMap'
    fi
    ;;
  get)
    if [[ "$*" == *"--selector app.kubernetes.io/name=traefik"* ]]; then
      printf '%s\n' 'deployment.apps/traefik'
    fi
    ;;
  config)
    printf '%s\n' 'test-context'
    ;;
  apply)
    if [[ "$*" == "apply -f -" ]]; then
      tee "$KUBECTL_APPLY_CAPTURE" >/dev/null
    fi
    ;;
esac
EOF
chmod +x "$FAKE_BIN/kubectl"

run_deploy() {
  local version="$1"
  local output="$2"
  local log="$3"
  local capture="$4"
  shift 4

  : >"$log"
  : >"$capture"
  FAKE_K8S_VERSION="$version" \
    KUBECTL_LOG="$log" \
    KUBECTL_APPLY_CAPTURE="$capture" \
    PATH="$FAKE_BIN:$PATH" \
    "$DEPLOY_SCRIPT" "$@" >"$output" 2>&1
}

test_placeholder_fails_before_cluster_access() {
  local output="$TEMP_DIR/placeholder-output"
  local log="$TEMP_DIR/placeholder-log"
  local capture="$TEMP_DIR/placeholder-capture"

  if run_deploy v0.0.0 "$output" "$log" "$capture"; then
    fail "placeholder deployment unexpectedly succeeded"
  fi

  assert_contains "$output" \
    "the Word Dash manifests still use the v0.0.0 placeholder"
  assert_not_contains "$log" "cluster-info"
  assert_not_contains "$log" "apply"
}

test_explicit_version_replaces_both_images() {
  local output="$TEMP_DIR/version-output"
  local log="$TEMP_DIR/version-log"
  local capture="$TEMP_DIR/version-capture"

  run_deploy v0.0.0 "$output" "$log" "$capture" --version v1.2.3

  assert_contains "$capture" \
    "ghcr.io/sras1599/word-dash/backend:v1.2.3"
  assert_contains "$capture" \
    "ghcr.io/sras1599/word-dash/frontend:v1.2.3"
  assert_not_contains "$capture" ":v0.0.0"
}

test_pinned_version_succeeds_without_flag() {
  local output="$TEMP_DIR/pinned-output"
  local log="$TEMP_DIR/pinned-log"
  local capture="$TEMP_DIR/pinned-capture"

  run_deploy v2.3.4 "$output" "$log" "$capture"

  assert_contains "$log" "apply -k $DEPLOY_DIR/k8s"
  assert_contains "$output" "Deployment is ready"
}

test_placeholder_fails_before_cluster_access
test_explicit_version_replaces_both_images
test_pinned_version_succeeds_without_flag

printf '%s\n' 'PASS: deploy.sh regression tests'
