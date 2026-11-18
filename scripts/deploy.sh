
#!/bin/bash

set -euo pipefail

ENV="${1:?Environment required}"
TAG="${2:?Image tag required}"

NS="$ENV"

REG="139716594109.dkr.ecr.ap-southeast-2.amazonaws.com"

SERVICES="web menu-api orders-api kitchen-worker stats-api"

# Validate environment
if [[ "$ENV" != "staging" && "$ENV" != "production" ]]; then
    echo "Invalid environment: $ENV"
    exit 1
fi

# Login to ECR
aws ecr get-login-password --region ap-southeast-2 | \
kubectl -n "$NS" create secret docker-registry ecr-secret \
    --docker-server="$REG" \
    --docker-username=AWS \
    --docker-password="$(aws ecr get-login-password --region ap-southeast-2)" \
    --dry-run=client -o yaml | kubectl apply -f -

# Apply Kubernetes configuration
kubectl apply -k "k8s/overlays/$ENV"

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
