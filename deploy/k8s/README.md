# Word Dash Kubernetes Resources

These manifests define the `word-dash` namespace, Redis, backend, frontend, and
Traefik routes. Use the repository's deployment script from the repository root;
do not apply this directory as the normal deployment workflow:

```bash
deploy/deploy.sh --version v1.2.3
```

The initial deployment must also provide the Cloudflare tunnel credentials as
described in the [canonical deployment guide](../README.me).

Flux updates the backend and frontend image setters together when a stable
release is published. `v0.0.0` in the source manifests is only the initial
setter value and is not intended to be deployed.

Inspect the application resources with:

```bash
kubectl get deployments,pods,services --namespace word-dash
kubectl get ingressroute --namespace word-dash
kubectl logs --namespace word-dash deployment/backend
```

For advanced troubleshooting, render this component without applying it:

```bash
kubectl kustomize deploy/k8s
```
