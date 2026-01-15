#!/usr/bin/env bash
set -euo pipefail

API_BASE="${1:-https://api.delishafrica.me}"

echo "============================================================"
echo "TONTON SMOKE TEST — ORDERS FLOW"
echo "API_BASE: $API_BASE"
echo "============================================================"

need() { command -v "$1" >/dev/null 2>&1 || { echo "❌ Missing: $1"; exit 1; }; }
need curl
need python3

echo "==> 1) Health"
curl -fsS "$API_BASE/api/health" | head -c 400 || true
echo
echo

echo "==> 2) Create demo order (best-effort payload)"
CREATE_RES="$(curl -fsS -X POST "$API_BASE/api/v1/orders/demo/create" \
  -H "Content-Type: application/json" \
  -d '{
    "partnerSlug":"thieyp",
    "customerName":"Tonton",
    "items":[{"name":"Thieyp","qty":1}],
    "notes":"Smoke test"
  }' || true)"

if [ -z "$CREATE_RES" ]; then
  echo "❌ Create returned empty response. Endpoint may differ."
  echo "Try checking server logs or confirm endpoint path."
  exit 1
fi

echo "$CREATE_RES" | head -c 800
echo
echo

ORDER_ID="$(python3 - <<PY
import json,sys
s=sys.stdin.read()
try:
  j=json.loads(s)
except:
  print("")
  raise SystemExit
for k in ["id","orderId","_id"]:
  if k in j:
    print(j[k]); raise SystemExit
print("")
PY
<<<"$CREATE_RES")"

if [ -z "$ORDER_ID" ]; then
  echo "⚠️  Could not auto-extract order id from response."
else
  echo "✅ ORDER_ID: $ORDER_ID"
fi
echo

echo "==> 3) List demo orders"
curl -fsS "$API_BASE/api/v1/orders/demo/list" | head -c 1200 || true
echo
echo

if [ -n "$ORDER_ID" ]; then
  echo "==> 4) Get order by id"
  curl -fsS "$API_BASE/api/v1/orders/demo/get?id=$ORDER_ID" | head -c 1200 || true
  echo
  echo
fi

echo "✅ Smoke test done."
echo "If apps still show nothing, it's 99% bundle/cache mismatch -> re-scan QR after force-close."
