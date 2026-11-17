#!/usr/bin/env bash
set -euo pipefail
for base in "${STAGING_URL:-http://staging.example.test}" "${PRODUCTION_URL:-http://example.test}"; do
  for endpoint in /api/menu /api/stats; do
    code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$base$endpoint" || true)
    [[ "$code" == "200" ]] || echo "ALERT $base$endpoint returned $code"
  done
done
