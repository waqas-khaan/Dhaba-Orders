#!/usr/bin/env bash
set -euo pipefail
for ns in staging production; do
  kubectl exec -n "$ns" statefulset/postgres -- pg_isready -U "${DB_USER:-dhaba}" || echo "ALERT PostgreSQL unavailable in $ns"
  kubectl exec -n "$ns" statefulset/redis -- redis-cli ping || echo "ALERT Redis unavailable in $ns"
done
