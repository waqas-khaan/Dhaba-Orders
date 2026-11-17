#!/usr/bin/env bash
set -euo pipefail
URL="${1:?Usage: scripts/load.sh BASE_URL SECONDS}"
DURATION="${2:-30}"
END=$((SECONDS + DURATION))
OK=0; FAIL=0
while (( SECONDS < END )); do
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$URL/api/orders" \
    -H 'Content-Type: application/json' \
    -d '{"items":[{"dish_id":1,"quantity":1}]}' || true)
  if [[ "$code" == "201" ]]; then ((OK+=1)); else ((FAIL+=1)); fi
done
echo "Succeeded: $OK"
echo "Failed: $FAIL"
