#!/usr/bin/env bash

set -euo pipefail

for base in \
  "${STAGING_URL:-https://staging.falconsoftwares.com}" \
  "${PRODUCTION_URL:-https://prod.falconsoftwares.com}"; do

  for endpoint in /api/menu /api/stats; do
    code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$base$endpoint" || true)

    [[ "$code" == "200" ]] || echo "ALERT $base$endpoint returned $code"
  done
done
