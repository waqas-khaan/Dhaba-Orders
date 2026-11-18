#!/bin/bash
set -euo pipefail

ENV=$1
TAG=$2
REGION=ap-southeast-2
REGISTRY=139716594109.dkr.ecr.$REGION.amazonaws.com
SERVICES="web menu-api orders-api kitchen-worker stats-api"
NS=$(grep -m1 '^namespace:' "k8s/overlays/$ENV/kustomization.yaml" | awk '{print $2}')

echo "Deploying $TAG to namespace $NS"

# 1. make sure the namespace exists, then refresh the ECR pull secret
kubectl create namespace "$NS" --dry-run=client -o yaml | kubectl apply -f -
kubectl -n "$NS" delete secret ecr-secret --ignore-not-found
kubectl -n "$NS" create secret docker-registry ecr-secret \
  --docker-server="$REGISTRY" --docker-username=AWS \
  --docker-password="$(aws ecr get-login-password --region $REGION)"
kubectl -n "$NS" patch serviceaccount default \
  -p '{"imagePullSecrets":[{"name":"ecr-secret"}]}'

# 2. work on a temporary copy so the git checkout stays clean
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
cp -r k8s "$WORK/k8s"
cd "$WORK/k8s/overlays/$ENV"
for s in $SERVICES; do
  kustomize edit set image "example.invalid/dhaba/$s=$REGISTRY/dhaba-orders-$s:$TAG"
done

# 3. apply once, then wait; roll everything back if one service fails
kubectl apply -k .
for s in $SERVICES; do
  if ! kubectl -n "$NS" rollout status "deploy/$s" --timeout=180s; then
    echo "FAILED on $s, rolling back"
    for x in $SERVICES; do kubectl -n "$NS" rollout undo "deploy/$x" || true; done
    exit 1
  fi
done
echo "Deployed $TAG to $NS"
