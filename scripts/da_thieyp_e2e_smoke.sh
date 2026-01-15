#!/usr/bin/env bash
set -euo pipefail

BASE="${1:-https://api.delishafrica.me}"

echo "== Health =="
curl -fsS "$BASE/api/health" | head -c 400; echo -e "\n"

echo "== Partners (head) =="
curl -fsS "$BASE/api/partners" | head -c 400; echo -e "\n"

echo "== Thieyp =="
curl -fsS "$BASE/api/partners/thieyp" | head -c 400; echo -e "\n"

echo "== Create order =="
CREATE_PAYLOAD='{"partnerSlug":"thieyp","items":[{"sku":"thieyp-001","qty":1}],"client":{"name":"Demo Client"}}'
CREATE_RES="$(curl -fsS -X POST "$BASE/api/v1/orders/demo/create" -H 'content-type: application/json' -d "$CREATE_PAYLOAD")"
echo "$CREATE_RES" | head -c 800; echo -e "\n"

# Prefer jq if available, fallback to sed.
ORDER_ID=""
if command -v jq >/dev/null 2>&1; then
  ORDER_ID="$(echo "$CREATE_RES" | jq -r '.order.id // .orderId // .id // empty')"
else
  # Extract order.id first
  ORDER_ID="$(echo "$CREATE_RES" | sed -n 's/.*"order"[^{]*{[^}]*"id":"\([^"]*\)".*/\1/p' | head -n1)"
  # Fallback: any "orderId"
  if [[ -z "${ORDER_ID:-}" ]]; then
    ORDER_ID="$(echo "$CREATE_RES" | sed -n 's/.*"orderId":"\([^"]*\)".*/\1/p' | head -n1)"
  fi
fi

if [[ -z "${ORDER_ID:-}" || "${ORDER_ID}" == "null" ]]; then
  echo "ERROR: Impossible d'extraire l'ID (attendu .order.id)."
  exit 2
fi

echo "orderId=$ORDER_ID"
echo

echo "== Merchant -> READY =="
curl -fsS -X POST "$BASE/api/v1/orders/demo/status" \
  -H 'content-type: application/json' \
  -d "{\"orderId\":\"$ORDER_ID\",\"id\":\"$ORDER_ID\",\"status\":\"READY\"}" | head -c 600; echo -e "\n"

echo "== Courier sees READY (list) =="
curl -fsS -X POST "$BASE/api/v1/orders/demo/list" \
  -H 'content-type: application/json' \
  -d '{"status":"READY"}' | head -c 900; echo -e "\n"

echo "== Courier -> DELIVERED =="
curl -fsS -X POST "$BASE/api/v1/orders/demo/status" \
  -H 'content-type: application/json' \
  -d "{\"orderId\":\"$ORDER_ID\",\"id\":\"$ORDER_ID\",\"status\":\"DELIVERED\"}" | head -c 600; echo -e "\n"

echo "✅ E2E smoke OK"
