#!/usr/bin/env bash
set -euo pipefail

# Build locally with Podman, transfer the OCI archive to the `hetzner` SSH host,
# import it into k3s/containerd, then deploy it with a unique image tag.

deploy_tag="${1:-$(git rev-parse --short HEAD)}"
image="localhost/cs-case-demo:${deploy_tag}"
archive="/tmp/cs-case-demo-${deploy_tag}.tar"
remote_archive="/tmp/cs-case-demo-${deploy_tag}.tar"
hetzner="${HETZNER_HOST:-hetzner}"
kubeconfig="/etc/rancher/k3s/k3s.yaml"

trap 'rm -f "$archive"' EXIT

podman build --tag "$image" .
podman save --format oci-archive --output "$archive" "$image"
scp "$archive" "${hetzner}:${remote_archive}"

# The secret stays on Hetzner; its value never appears in this script or Git.
ssh "$hetzner" "sudo k3s ctr images import '${remote_archive}' && rm -f '${remote_archive}'"

# Namespace, PVC, Service, and Ingress do not change per release. Apply each
# manifest separately; concatenating YAML files without `---` loses documents.
for manifest in k8s/namespace.yaml k8s/pvc.yaml k8s/service.yaml k8s/ingress.yaml; do
  ssh "$hetzner" "KUBECONFIG=${kubeconfig} kubectl apply -f -" <"$manifest"
done

# Apply the Deployment with the unique image tag that was just imported.
sed "s|localhost/cs-case-demo:IMAGE_TAG|${image}|g" k8s/deployment.yaml |
  ssh "$hetzner" "KUBECONFIG=${kubeconfig} kubectl apply -f - && KUBECONFIG=${kubeconfig} kubectl -n cs-case-demo rollout status deployment/cs-case-demo --timeout=90s"

echo "Deployed https://cs-case-demo.evillab.tech with image ${image}"
