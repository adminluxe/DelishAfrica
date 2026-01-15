#!/usr/bin/env bash
set -euo pipefail

BASE="${1:-https://api.delishafrica.me}"
PARTNER="${2:-thieyp}"

echo "=== PROBE ORDERS ==="
echo "BASE=$BASE"
echo "PARTNER=$PARTNER"
echo

echo "[1] Create demo order"
CREATE="$(curl -fsS -X POST "$BASE/api/v1/orders/demo/create" -H 'content-type: application/json' -d '{}' )"
echo "$CREATE" | head -c 900; echo; echo

echo "[2] List demo orders for partnerSlug=$PARTNER"
LIST="$(curl -fsS -X POST "$BASE/api/v1/orders/demo/list" -H 'content-type: application/json' -d "{\"partnerSlug\":\"$PARTNER\"}" )"
echo "$LIST" | head -c 1200; echo; echo

echo "DONE."
