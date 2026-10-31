# Deploying to Hetzner k3s

The application deploys as one FastAPI container on the existing Hetzner k3s
cluster. Traefik terminates HTTPS and routes `cs-case-demo.evillab.tech` to the
service. SQLite roll history lives on a one-gigabyte `local-path` PVC at
`/data/cs-case-demo.db`.

This flow intentionally does **not** need Docker Hub or GHCR:

```text
local Podman build → OCI archive → scp → k3s containerd import → kubectl apply
```

## One-time prerequisites

1. Ensure `cs-case-demo.evillab.tech` has an A/AAAA DNS record to the Hetzner
   k3s node. The record must resolve before cert-manager can issue TLS.
2. Confirm the local `hetzner` SSH alias works:

   ```bash
   ssh hetzner 'KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl get nodes'
   ```

3. Create the production seed directly on Hetzner. Do not use the demo default
   and do not commit a real seed.

   ```bash
   ssh hetzner "KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl create namespace cs-case-demo --dry-run=client -o yaml | KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl apply -f -"
   ssh hetzner "KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl -n cs-case-demo create secret generic cs-case-demo-secrets \
     --from-literal=demo-server-seed='REPLACE_WITH_A_LONG_RANDOM_SECRET'"
   ```

## Deploy

From the repository root:

```bash
chmod +x scripts/deploy-hetzner.sh
./scripts/deploy-hetzner.sh
```

The optional first argument overrides the image tag:

```bash
./scripts/deploy-hetzner.sh v0.1.0
```

The script builds an OCI image with Podman, transfers it through `scp`, imports
it with `k3s ctr images import`, applies the manifests, and waits for rollout.
It never sends the server seed from the local machine.

## Verify and operate

```bash
ssh hetzner 'KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl -n cs-case-demo get pods,svc,ingress,pvc'
ssh hetzner 'KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl -n cs-case-demo logs deploy/cs-case-demo --tail=100'
curl --fail https://cs-case-demo.evillab.tech/api/health
```

The PVC uses the cluster's single-node `local-path` provisioner. Back up the
SQLite file before node or storage maintenance:

```bash
ssh hetzner 'POD=$(KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl -n cs-case-demo get pod -l app=cs-case-demo -o jsonpath="{.items[0].metadata.name}"); KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl -n cs-case-demo cp "$POD:/data/cs-case-demo.db" /tmp/cs-case-demo-backup.db'
```

For this fake-money demo, a local SQLite PVC is proportionate. Move to managed
Postgres or libSQL/Turso before relying on shared multi-replica production data.
