#!/usr/bin/env bash

set -Eeuo pipefail

readonly FLUX_NAMESPACE="flux-system"
readonly GITHUB_OWNER="sras1599"
readonly GITHUB_REPOSITORY="word-dash"
readonly GIT_BRANCH="main"
readonly GIT_PATH="deploy/flux"
readonly IMAGE_AUTOMATION="word-dash"
readonly WORD_DASH_KUSTOMIZATION="word-dash"
readonly CLOUDFLARE_KUSTOMIZATION="word-dash-cloudflare"
readonly IMAGE_COMPONENTS="image-reflector-controller,image-automation-controller"

ASSUME_YES=false

usage() {
  cat <<'EOF'
Usage: deploy/flux.sh COMMAND [--yes]

Manage and inspect the Word Dash Flux installation for the current Kubernetes
context.

Commands:
  bootstrap           Install or upgrade Flux and configure GitHub reconciliation.
  check               Check Flux and its image automation controllers.
  status              Show all relevant Flux resources and the selected image tag.
  reconcile           Reconcile flux-system with its Git source.
  logs                Show Flux error logs.
  suspend-updates     Suspend Word Dash image promotion commits.
  resume-updates      Resume Word Dash image promotion commits.
  suspend-workloads   Suspend application and Cloudflare reconciliation.
  resume-workloads    Resume application and Cloudflare reconciliation.

Options:
  --yes               Skip confirmation for commands that change external state.
  -h, --help          Show this help.

Bootstrap uses github.com/sras1599/word-dash, branch main, and deploy/flux.
Set GITHUB_TOKEN before bootstrap to avoid Flux prompting for a GitHub token.
EOF
}

log() {
  printf '\n==> %s\n' "$*"
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is required"
}

require_cluster() {
  kubectl cluster-info >/dev/null || \
    die "kubectl cannot connect to the current cluster"
}

current_context() {
  kubectl config current-context
}

confirm_action() {
  local action="$1"
  local context

  context="$(current_context)" || die "cannot determine the current Kubernetes context"
  printf '\nKubernetes context: %s\nAction: %s\n' "$context" "$action"

  if [[ "$ASSUME_YES" == true ]]; then
    return 0
  fi

  [[ -t 0 ]] || \
    die "this command requires confirmation; rerun it interactively or pass --yes"

  local response
  read -r -p "Continue? [y/N] " response
  [[ "$response" =~ ^[Yy]([Ee][Ss])?$ ]]
}

run_status_check() {
  local label="$1"
  shift

  log "$label"
  if ! "$@"; then
    printf 'warning: %s check failed\n' "$label" >&2
    STATUS_FAILED=1
  fi
}

show_image_crds() {
  local crds

  crds="$(kubectl get customresourcedefinitions --output name)" || return
  grep 'image.toolkit.fluxcd.io' <<<"$crds"
}

show_selected_image() {
  kubectl get imagepolicy "$IMAGE_AUTOMATION" \
    --namespace "$FLUX_NAMESPACE" \
    --output jsonpath='{.status.latestRef.tag}{"\n"}'
}

bootstrap() {
  flux check --pre
  confirm_action \
    "bootstrap Flux from github.com/$GITHUB_OWNER/$GITHUB_REPOSITORY ($GIT_BRANCH:$GIT_PATH)" || {
      printf '%s\n' "Cancelled."
      return 0
    }

  flux bootstrap github \
    --owner "$GITHUB_OWNER" \
    --repository "$GITHUB_REPOSITORY" \
    --branch "$GIT_BRANCH" \
    --path "$GIT_PATH" \
    --components-extra "$IMAGE_COMPONENTS" \
    --read-write-key \
    --personal
}

check() {
  flux check --components-extra "$IMAGE_COMPONENTS"
}

status() {
  STATUS_FAILED=0

  run_status_check "Kubernetes context" current_context
  run_status_check "Flux installation" check
  run_status_check "Image automation controllers" \
    kubectl get deployments \
      --namespace "$FLUX_NAMESPACE" \
      image-reflector-controller image-automation-controller
  run_status_check "Image automation CRDs" show_image_crds
  run_status_check "Git sources" \
    flux get sources git --namespace "$FLUX_NAMESPACE"
  run_status_check "Kustomizations" \
    flux get kustomizations --namespace "$FLUX_NAMESPACE"
  run_status_check "Image resources" \
    flux get images all --all-namespaces
  run_status_check "Image update automation" \
    flux get image update "$IMAGE_AUTOMATION" --namespace "$FLUX_NAMESPACE"
  run_status_check "Selected Word Dash image tag" show_selected_image

  ((STATUS_FAILED == 0)) || die "one or more Flux status checks failed"
}

reconcile() {
  confirm_action "reconcile flux-system with its Git source" || {
    printf '%s\n' "Cancelled."
    return 0
  }
  flux reconcile kustomization flux-system \
    --namespace "$FLUX_NAMESPACE" \
    --with-source
}

show_logs() {
  flux logs --flux-namespace "$FLUX_NAMESPACE" --level error
}

suspend_updates() {
  confirm_action "suspend Word Dash image promotion" || {
    printf '%s\n' "Cancelled."
    return 0
  }
  flux suspend image update "$IMAGE_AUTOMATION" \
    --namespace "$FLUX_NAMESPACE"
}

resume_updates() {
  confirm_action "resume Word Dash image promotion" || {
    printf '%s\n' "Cancelled."
    return 0
  }
  flux resume image update "$IMAGE_AUTOMATION" \
    --namespace "$FLUX_NAMESPACE"
}

suspend_workloads() {
  confirm_action "suspend Word Dash and Cloudflare reconciliation" || {
    printf '%s\n' "Cancelled."
    return 0
  }
  flux suspend kustomization \
    "$WORD_DASH_KUSTOMIZATION" "$CLOUDFLARE_KUSTOMIZATION" \
    --namespace "$FLUX_NAMESPACE"
}

resume_workloads() {
  confirm_action "resume Word Dash and Cloudflare reconciliation" || {
    printf '%s\n' "Cancelled."
    return 0
  }
  flux resume kustomization \
    "$WORD_DASH_KUSTOMIZATION" "$CLOUDFLARE_KUSTOMIZATION" \
    --namespace "$FLUX_NAMESPACE"
}

main() {
  local command_name=""

  while (($# > 0)); do
    case "$1" in
      --yes)
        ASSUME_YES=true
        ;;
      -h | --help)
        usage
        return 0
        ;;
      -*)
        die "unknown option: $1"
        ;;
      *)
        [[ -z "$command_name" ]] || die "unexpected argument: $1"
        command_name="$1"
        ;;
    esac
    shift
  done

  [[ -n "$command_name" ]] || {
    usage >&2
    return 1
  }

  case "$command_name" in
    bootstrap | check | status | reconcile | logs | \
      suspend-updates | resume-updates | \
      suspend-workloads | resume-workloads)
      ;;
    *)
      die "unknown command: $command_name"
      ;;
  esac

  require_command flux
  require_command kubectl
  require_cluster

  case "$command_name" in
    bootstrap) bootstrap ;;
    check) check ;;
    status) status ;;
    reconcile) reconcile ;;
    logs) show_logs ;;
    suspend-updates) suspend_updates ;;
    resume-updates) resume_updates ;;
    suspend-workloads) suspend_workloads ;;
    resume-workloads) resume_workloads ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
