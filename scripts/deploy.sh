#!/bin/bash
set -e

ENV=$1
TAG=$2

NS=$ENV
REG=139716594109.dkr.ecr.ap-southeast-2.amazonaws.com/dhaba
SERVICES="web menu-api orders-api kitchen-worker stats-api"

# Refresh ECR secret
kubectl -n "$NS" delete secret ecr-secret --ignore-not-found

kubectl -n "$NS" create secret docker-registry ecr-secret \
  --docker-server=139716594109.dkr.ecr.ap-southeast-2.amazonaws.com \
  --docker-username=AWS \
  --docker-password="$(aws ecr get-login-password --region ap-southeast-2)"

# Apply Kubernetes configuration
kubectl apply -k "k8s/overlays/$ENV"

# Update container images
for s in $SERVICES; do
  kubectl -n "$NS" set image deployment/"$s" "$s=$REG/$s:$TAG"
done

# Wait for deployments
for s in $SERVICES; do
  if ! kubectl -n "$NS" rollout status deployment/"$s" --timeout=180s; then
    echo "Deployment failed. Rolling back..."

    for x in $SERVICES; do
      kubectl -n "$NS" rollout undo deployment/"$x"
    done

    exit 1
  fi
done

echo "Successfully deployed $TAG to $NS"
