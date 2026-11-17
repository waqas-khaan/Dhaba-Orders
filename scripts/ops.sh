#!/usr/bin/env bash
set -euo pipefail
cmd="${1:-help}"
case "$cmd" in
 status) kubectl get nodes; for ns in staging production; do echo "== $ns =="; kubectl get pods,deploy,svc -n "$ns"; done ;;
 db) for ns in staging production; do echo "== $ns =="; kubectl get pods,pvc -n "$ns" | grep -E 'postgres|redis|NAME'; done ;;
 logs) service="${2:?Usage: ops.sh logs SERVICE}"; ns="${3:-staging}"; kubectl logs -n "$ns" -l app="$service" --tail=100 -f ;;
 load) seconds="${2:-30}"; URL="${URL:-http://staging.example.test}"; scripts/load.sh "$URL" "$seconds" ;;
 *) echo "Usage: ops.sh {status|db|logs SERVICE [NAMESPACE]|load SECONDS}" ;;
esac
