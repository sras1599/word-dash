# Flux Setup and Operations

Flux is optional. The initial `deploy/deploy.sh --version vX.Y.Z` deployment is
sufficient to run Word Dash; install Flux when the cluster should automatically
reconcile the repository and promote newly published releases.

Use `deploy/flux.sh` from the repository root for routine Flux operations:

| Command | Purpose |
| --- | --- |
| `deploy/flux.sh bootstrap` | Install or upgrade Flux and connect the cluster to GitHub. |
| `deploy/flux.sh check` | Validate Flux and its image automation controllers. |
| `deploy/flux.sh status` | Show controllers, sources, workloads, images, and the selected tag. |
| `deploy/flux.sh reconcile` | Pull from Git and reconcile the root Flux configuration. |
| `deploy/flux.sh logs` | Show Flux error logs. |
| `deploy/flux.sh suspend-updates` | Stop image promotion commits. |
| `deploy/flux.sh resume-updates` | Resume image promotion commits. |
| `deploy/flux.sh suspend-workloads` | Stop application and Cloudflare reconciliation. |
| `deploy/flux.sh resume-workloads` | Resume application and Cloudflare reconciliation. |

Commands that change GitHub or cluster reconciliation show the current
Kubernetes context and ask for confirmation. Pass `--yes` for intentional
unattended execution. Run `deploy/flux.sh --help` for the authoritative command
interface.

## Prerequisites

Before bootstrapping Flux:

- Configure `kubectl` for the target cluster and install the `flux` CLI.
- Have cluster-admin access and a GitHub personal access token that can
  administer and write to `sras1599/word-dash`.
- Publish at least one matching backend and frontend `vX.Y.Z` release.
- Complete the initial deployment so the manually managed
  `cloudflared-credentials` Secret exists.

Export the token as `GITHUB_TOKEN` to avoid a prompt during bootstrap. The
helper never prints or manages this value; Flux uses it to configure a
repository-scoped SSH deploy key. If the variable is absent, Flux prompts for
the token.

The image packages should be public. If they are private, configure the registry
Secrets described in the [canonical deployment guide](../README.me).

## Bootstrap Flux

Run once from the repository root:

```bash
deploy/flux.sh bootstrap
```

After confirmation, the helper runs:

```bash
flux bootstrap github \
  --owner sras1599 \
  --repository word-dash \
  --branch main \
  --path deploy/flux \
  --components-extra image-reflector-controller,image-automation-controller \
  --read-write-key \
  --personal
```

The writable deploy key is required because image automation commits promoted
tags back to `main`. Bootstrap installs the core controllers plus the image
reflector and automation controllers, writes bootstrap manifests to GitHub, and
configures the cluster to reconcile the repository. Review any resulting
commit.

Keep both `workloads.yaml` and `image-automation.yaml` in this directory's
`kustomization.yaml` when resolving bootstrap changes.

## Verify and Operate Flux

Run the installation check and complete status report:

```bash
deploy/flux.sh check
deploy/flux.sh status
```

The status command runs every diagnostic even when one fails, then exits with a
failure so it can also be used in automation. A healthy `flux-system` namespace
includes:

- `ImageRepository/word-dash-backend`
- `ImagePolicy/word-dash`
- `ImageUpdateAutomation/word-dash`
- `Kustomization/word-dash`
- `Kustomization/word-dash-cloudflare`

Force a Git pull and reconciliation when required:

```bash
deploy/flux.sh reconcile
```

For a durable manual rollback, pause image updates before reverting the Flux
promotion commit, then resume updates after deciding which release should be
selected:

```bash
deploy/flux.sh suspend-updates
deploy/flux.sh resume-updates
```

Suspend both workload Kustomizations before intentionally deleting or manually
changing their resources:

```bash
deploy/flux.sh suspend-workloads
deploy/flux.sh resume-workloads
```

The operational subcommands are thin wrappers around these Flux commands:

```bash
flux reconcile kustomization flux-system --namespace flux-system --with-source
flux logs --flux-namespace flux-system --level error
flux suspend image update word-dash --namespace flux-system
flux resume image update word-dash --namespace flux-system
flux suspend kustomization word-dash word-dash-cloudflare --namespace flux-system
flux resume kustomization word-dash word-dash-cloudflare --namespace flux-system
```

## Image Update Flow

The release workflow publishes matching frontend and backend images. The
backend image is published last and acts as the completion marker. Every minute,
Flux scans its GHCR repository for stable `vX.Y.Z` tags, selects the newest
semantic version, and updates both image setters under `deploy/k8s`.

The image automation commits the promotion to `main` as `chore(deploy):`. Flux
then reconciles the updated manifests into the cluster. Pull that commit before
running `deploy/deploy.sh` without `--version`; the source placeholder `v0.0.0`
is intentionally not deployable.

## Troubleshooting

Start with the aggregate report and controller errors:

```bash
deploy/flux.sh status
deploy/flux.sh logs
```

If Kubernetes reports that it has no `imagerepositories` resource type, the
image automation CRDs are not installed. The equivalent focused checks are:

```bash
flux check \
  --components-extra=image-reflector-controller,image-automation-controller
kubectl get deployments --namespace flux-system
kubectl get crds | grep image.toolkit.fluxcd.io
```

Rerun `deploy/flux.sh bootstrap` to install and manage the optional controllers.
If the controllers are healthy but the Word Dash resources are absent, run
`deploy/flux.sh reconcile`.

For registry authentication, Git push, or release-filtering failures, continue
with the troubleshooting section in the
[canonical deployment guide](../README.me).
