# Cloudflare Tunnel Resources

These manifests define the `cloudflare` namespace, tunnel configuration, and
cloudflared Deployment. Use the complete deployment script rather than applying
this directory separately:

```bash
deploy/deploy.sh \
  --cloudflare-credentials /path/to/TUNNEL_UUID.json \
  --version v1.2.3
```

The script creates or updates `secret/cloudflared-credentials`. On later runs,
omit `--cloudflare-credentials` while that Secret remains in the cluster. It
survives normal host, k3s, Flux, and pod restarts; it must be recreated after
cluster or namespace deletion, datastore loss, migration, or credential
rotation.

Flux reconciles these manifests but does not manage or prune the manually
created Secret. Full setup and recovery instructions are in the
[canonical deployment guide](../README.me).

Inspect the tunnel with:

```bash
kubectl get deployments,pods --namespace cloudflare
kubectl get secret cloudflared-credentials --namespace cloudflare
kubectl logs --namespace cloudflare deployment/cloudflared
```

For advanced troubleshooting, render this component without applying it:

```bash
kubectl kustomize deploy/cloudflare
```
