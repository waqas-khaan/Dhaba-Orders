#!/usr/bin/env bash

set -euo pipefail

timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

for base in \
  "${STAGING_URL:-https://staging.falconsoftwares.com}" \
  "${PRODUCTION_URL:-https://prod.falconsoftwares.com}"; do

  for endpoint in /health /api/menu /api/stats; do
    code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$base$endpoint" || true)

    if [[ "$code" == "200" ]]; then
      echo "{\"time\":\"$timestamp\",\"target\":\"$base$endpoint\",\"status\":$code,\"health\":\"UP\"}"
    else
      echo "{\"time\":\"$timestamp\",\"target\":\"$base$endpoint\",\"status\":$code,\"health\":\"DOWN\",\"alert\":true}"
      echo "ALERT $base$endpoint returned $code"
    fi
  done
done
