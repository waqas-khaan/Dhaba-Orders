#!/bin/bash

set -euo pipefail

ENV="${1:?Environment required}"
TAG="${2:?Image tag required}"

REG="139716594109.dkr.ecr.ap-southeast-2.amazonaws.com"
REGION="ap-southeast-2"

SERVICES="web menu-api orders-api kitchen-worker stats-api"

# Validate environment
case "$ENV" in
    staging|production)
        NS="$ENV"
        OVERLAY="k8s/overlays/$ENV"
        ;;
    preview)
        NS="${NAMESPACE:?NAMESPACE required for preview}"
        HOST="${PREVIEW_HOST:?PREVIEW_HOST required for preview}"
        OVERLAY="k8s/overlays/staging"

        if ! [[ "$NS" =~ ^preview-[a-z0-9-]{1,40}$ ]]; then
            echo "Invalid namespace: $NS"
            exit 1
        fi
        if ! [[ "$HOST" =~ ^[a-z0-9][a-z0-9-]{0,39}\.falconsoftwares\.com$ ]]; then
            echo "Invalid host: $HOST"
            exit 1
        fi
        ;;
    *)
        echo "Invalid environment: $ENV"
        exit 1
        ;;
esac

# Preview only: create the namespace and copy app secrets from staging
if [ "$ENV" = "preview" ]; then
    echo "Preparing namespace $NS..."
    kubectl create namespace "$NS" --dry-run=client -o yaml | kubectl apply -f -

    kubectl -n staging get secret dhaba-secrets -o json \
        | jq 'del(.metadata.namespace, .metadata.uid, .metadata.resourceVersion, .metadata.creationTimestamp, .metadata.ownerReferences, .metadata.managedFields)' \
        | kubectl -n "$NS" apply -f -
fi

# Create/refresh ECR pull secret
kubectl -n "$NS" create secret docker-registry ecr-secret \
    --docker-server="$REG" \
    --docker-username=AWS \
    --docker-password="$(aws ecr get-login-password --region "$REGION")" \
    --dry-run=client -o yaml | kubectl apply -f -

# Apply Kubernetes configuration
if [ "$ENV" = "preview" ]; then
    # Throwaway overlay on top of staging: new namespace + new ingress host.
    TMP="$(mktemp -d -p k8s .preview.XXXXXX)"
    trap 'rm -rf "$TMP"' EXIT
    REL="$(realpath --relative-to="$TMP" "$OVERLAY")"

    cat > "$TMP/kustomization.yaml" <<EOF
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - $REL
namespace: $NS
patches:
  - target:
      kind: Ingress
    patch: |-
      - op: replace
        path: /spec/rules/0/host
        value: $HOST
EOF

    kubectl apply -k "$TMP"
else
    kubectl apply -k "$OVERLAY"
fi

# Update images
for s in $SERVICES; do
    echo "Updating $s..."

    kubectl -n "$NS" set image deployment/"$s" \
        "$s=$REG/dhaba-orders-$s:$TAG"
done

# Wait for deployments
for s in $SERVICES; do
    kubectl -n "$NS" rollout status deployment/"$s" --timeout=180s
done

echo "Successfully deployed $TAG to $NS"
if [ "$ENV" = "preview" ]; then
    echo "URL: https://$HOST"
fi
