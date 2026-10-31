# Deploying to Hetzner k3s

The application deploys as one Bun/Elysia container on the existing Hetzner k3s
cluster. Traefik terminates HTTPS and routes `cs-case-demo.evillab.tech` to the
service. SQLite roll history lives on a one-gigabyte `local-path` PVC at
`/data/cs-case-demo.db`.

The image is built from the repository `Dockerfile`: `oven/bun:1-slim`,
production dependencies installed from `bun.lock`, and the container command
`bun run src/index.ts`.

The Python → Bun port did not change the deployment contract:

- container port `8000` and the Service target port
- the `/data` PVC mount and `CSDEMO_DATABASE_URL=sqlite:////data/cs-case-demo.db`
- readiness and liveness probes on `/api/health`
- Namespace, Service, Ingress, TLS, Secret, and resource requests/limits

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
bun run parity/replay.ts https://cs-case-demo.evillab.tech --structural
```

The replay uses `--structural` against production because the real server seed
keeps exact hash equality unprovable; it checks response structure, case order,
item membership, the unknown-case 404 body, and `/docs`.

## Rollback

Each deploy tags the image with the commit hash or an explicit tag, and the
Deployment uses `imagePullPolicy: Never`. The previous image stays in
containerd after a rollout, so rolling back needs no rebuild or transfer:

```bash
./scripts/deploy-hetzner.sh <previous-tag>
```

List the tags available on the node with:

```bash
ssh hetzner 'sudo k3s ctr images ls | grep cs-case-demo'
```

For a source-level rollback, `pre-elysia` is the git tag of the pre-port
baseline.

## Storage and backup

The PVC uses the cluster's single-node `local-path` provisioner. Back up the
SQLite file before node or storage maintenance:

```bash
ssh hetzner 'POD=$(KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl -n cs-case-demo get pod -l app=cs-case-demo -o jsonpath="{.items[0].metadata.name}"); KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl -n cs-case-demo cp "$POD:/data/cs-case-demo.db" /tmp/cs-case-demo-backup.db'
```

For this fake-money demo, a local SQLite PVC is proportionate. Move to managed
Postgres or libSQL/Turso before relying on shared multi-replica production data.
