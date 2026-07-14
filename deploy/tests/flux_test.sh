#!/usr/bin/env bash

set -Eeuo pipefail

readonly TEST_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly DEPLOY_DIR="$(cd -- "$TEST_DIR/.." && pwd)"
readonly FLUX_SCRIPT="$DEPLOY_DIR/flux.sh"
readonly TEMP_DIR="$(mktemp -d)"
readonly FAKE_BIN="$TEMP_DIR/bin"
readonly FLUX_LOG="$TEMP_DIR/flux.log"
readonly KUBECTL_LOG="$TEMP_DIR/kubectl.log"
export FLUX_SCRIPT FLUX_LOG KUBECTL_LOG

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

reset_logs() {
  : >"$FLUX_LOG"
  : >"$KUBECTL_LOG"
}

mkdir -p "$FAKE_BIN"

cat >"$FAKE_BIN/flux" <<'EOF'
#!/usr/bin/env bash

set -Eeuo pipefail

printf '%s\n' "$*" >>"$FLUX_LOG"

if [[ "${FAIL_FLUX_SOURCE:-false}" == true && \
  "$*" == "get sources git --namespace flux-system" ]]; then
  printf '%s\n' "Git source unavailable" >&2
  exit 1
fi

printf 'flux %s\n' "$*"
EOF

cat >"$FAKE_BIN/kubectl" <<'EOF'
#!/usr/bin/env bash

set -Eeuo pipefail

printf '%s\n' "$*" >>"$KUBECTL_LOG"

case "$1" in
  cluster-info)
    ;;
  config)
    printf '%s\n' "test-context"
    ;;
  get)
    case "$2" in
      deployments)
        printf '%s\n' "image-reflector-controller 1/1" \
          "image-automation-controller 1/1"
        ;;
      customresourcedefinitions)
        printf '%s\n' \
          "customresourcedefinition.apiextensions.k8s.io/imagerepositories.image.toolkit.fluxcd.io" \
          "customresourcedefinition.apiextensions.k8s.io/imagepolicies.image.toolkit.fluxcd.io" \
          "customresourcedefinition.apiextensions.k8s.io/imageupdateautomations.image.toolkit.fluxcd.io"
        ;;
      imagepolicy)
        printf '%s\n' "v1.2.3"
        ;;
    esac
    ;;
esac
EOF

chmod +x "$FAKE_BIN/flux" "$FAKE_BIN/kubectl"

run_helper() {
  local output="$1"
  shift

  PATH="$FAKE_BIN:$PATH" \
    "$FLUX_SCRIPT" "$@" >"$output" 2>&1
}

test_help_and_unknown_command() {
  local output="$TEMP_DIR/help-output"

  reset_logs
  run_helper "$output" --help
  assert_contains "$output" "suspend-workloads"
  assert_not_contains "$KUBECTL_LOG" "cluster-info"

  if run_helper "$output" unknown; then
    fail "unknown command unexpectedly succeeded"
  fi
  assert_contains "$output" "unknown command: unknown"
}

test_status_runs_all_checks_and_aggregates_failure() {
  local output="$TEMP_DIR/status-output"

  reset_logs
  if FAIL_FLUX_SOURCE=true \
    PATH="$FAKE_BIN:$PATH" \
    "$FLUX_SCRIPT" status >"$output" 2>&1; then
    fail "status unexpectedly succeeded when a check failed"
  fi

  assert_contains "$output" "Git sources check failed"
  assert_contains "$output" "one or more Flux status checks failed"
  assert_contains "$FLUX_LOG" "get image update word-dash --namespace flux-system"
  assert_contains "$KUBECTL_LOG" "get imagepolicy word-dash"
}

test_bootstrap_uses_writable_image_automation_components() {
  local output="$TEMP_DIR/bootstrap-output"

  reset_logs
  run_helper "$output" bootstrap --yes

  assert_contains "$FLUX_LOG" "check --pre"
  assert_contains "$FLUX_LOG" \
    "bootstrap github --owner sras1599 --repository word-dash --branch main --path deploy/flux --components-extra image-reflector-controller,image-automation-controller --read-write-key --personal"
  assert_contains "$output" "Kubernetes context: test-context"
}

test_declined_mutation_does_nothing() {
  local output="$TEMP_DIR/declined-output"

  reset_logs
  PATH="$FAKE_BIN:$PATH" \
    bash -c '
      source "$FLUX_SCRIPT"
      confirm_action() { return 1; }
      main suspend-updates
    ' >"$output" 2>&1

  assert_contains "$output" "Cancelled."
  assert_not_contains "$FLUX_LOG" "suspend image update"
}

test_yes_runs_mutating_commands() {
  local output="$TEMP_DIR/mutation-output"

  reset_logs
  run_helper "$output" reconcile --yes
  run_helper "$output" suspend-updates --yes
  run_helper "$output" resume-updates --yes
  run_helper "$output" suspend-workloads --yes
  run_helper "$output" resume-workloads --yes

  assert_contains "$FLUX_LOG" \
    "reconcile kustomization flux-system --namespace flux-system --with-source"
  assert_contains "$FLUX_LOG" \
    "suspend image update word-dash --namespace flux-system"
  assert_contains "$FLUX_LOG" \
    "resume image update word-dash --namespace flux-system"
  assert_contains "$FLUX_LOG" \
    "suspend kustomization word-dash word-dash-cloudflare --namespace flux-system"
  assert_contains "$FLUX_LOG" \
    "resume kustomization word-dash word-dash-cloudflare --namespace flux-system"
}

test_noninteractive_mutation_requires_yes() {
  local output="$TEMP_DIR/noninteractive-output"

  reset_logs
  if run_helper "$output" suspend-updates </dev/null; then
    fail "noninteractive mutation unexpectedly succeeded"
  fi

  assert_contains "$output" "requires confirmation"
  assert_not_contains "$FLUX_LOG" "suspend image update"
}

test_help_and_unknown_command
test_status_runs_all_checks_and_aggregates_failure
test_bootstrap_uses_writable_image_automation_components
test_declined_mutation_does_nothing
test_yes_runs_mutating_commands
test_noninteractive_mutation_requires_yes

printf '%s\n' "PASS: flux.sh regression tests"
