#!/usr/bin/env bash
set -euo pipefail
: "${AWS_REGION:?Set AWS_REGION}"
: "${TEAM:?Set TEAM}"
services=(web menu-api orders-api kitchen-worker stats-api postgres redis ops-monitor)
for service in "${services[@]}"; do
  name="dhaba-${TEAM}/${service}"
  if aws ecr describe-repositories --repository-names "$name" --region "$AWS_REGION" >/dev/null 2>&1; then
    echo "Already exists: $name"
  else
    aws ecr create-repository --repository-name "$name" --image-scanning-configuration scanOnPush=true --region "$AWS_REGION" >/dev/null
    echo "Created: $name"
  fi
  aws ecr put-lifecycle-policy --repository-name "$name" --region "$AWS_REGION" --lifecycle-policy-text '{"rules":[{"rulePriority":1,"description":"Keep newest 20 images","selection":{"tagStatus":"any","countType":"imageCountMoreThan","countNumber":20},"action":{"type":"expire"}}]}' >/dev/null
done
