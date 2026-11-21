#!/bin/bash

set -euo pipefail

ENV="${1:?Environment required}"
TAG="${2:?Image tag required}"

REG="139716594109.dkr.ecr.ap-southeast-2.amazonaws.com"
REGION="ap-southeast-2"
SERVICES="web menu-api orders-api kitchen-worker stats-api"

case "$ENV" in
    staging|production)
        NS="$ENV"
        OVERLAY="k8s/overlays/$ENV"
        ;;
<<<<<<< HEAD
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
=======
>>>>>>> 52514ee (revert changes)
    *)
        echo "Invalid environment: $ENV. Use staging or production."
        exit 1
        ;;
esac

# Create or refresh ECR pull secret
kubectl -n "$NS" create secret docker-registry ecr-secret \
    --docker-server="$REG" \
    --docker-username=AWS \
    --docker-password="$(aws ecr get-login-password --region "$REGION")" \
    --dry-run=client -o yaml | kubectl apply -f -

# Apply Kubernetes configuration
kubectl apply -k "$OVERLAY"

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
