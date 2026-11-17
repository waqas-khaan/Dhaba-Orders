#!/usr/bin/env bash
set -euo pipefail
echo "[$(date -Is)] cluster check"
kubectl get nodes
kubectl get pods -A --no-headers | awk '$4 ~ /CrashLoopBackOff|ImagePullBackOff|Error/ {print "ALERT pod:",$0}'
kubectl get events -A --field-selector type=Warning --sort-by=.lastTimestamp | tail -n 20
kubectl top nodes 2>/dev/null || echo "Metrics API unavailable"
kubectl get pvc -A
