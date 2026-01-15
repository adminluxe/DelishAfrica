#!/usr/bin/env bash
set -euo pipefail

API_BASE="${1:-https://api.delishafrica.me}"
API_BASE="${API_BASE%/}"

BASES=(
  "/api/v1/orders/demo"
  "/api/v1/api/orders/demo"
)

post_try() {
  local path="$1"
  local json="$2"
  local last=""
  for b in "${BASES[@]}"; do
    local url="${API_BASE}${b}${path}"
    last="$url"
    if out="$(curl -fsS -X POST "$url" -H "Content-Type: application/json" -d "$json")"; then
      printf '%s' "$out"
      return 0
    fi
  done
  echo "❌ Impossible d'appeler ${path} (dernier essai: ${last})" >&2
  return 1
}

get_order_id() {
  python3 -c 'import json,sys
j=json.load(sys.stdin)
oid = j.get("orderId") or (j.get("order") or {}).get("id") or ""
print(oid)
'
}

json_has_error_not_found() {
  python3 -c 'import json,sys
try:
  j=json.load(sys.stdin)
  print("1" if (j.get("error")=="not_found") else "0")
except Exception:
  print("0")
' 2>/dev/null
}

list_contains_order() {
  local oid="$1"
  local list_res="$2"
  python3 - <<PY 2>/dev/null
import json
oid="$oid"
j=json.loads("""$list_res""")
orders = j.get("orders") or j.get("data") or j.get("items") or []
def oid_of(o):
  if isinstance(o, dict):
    return o.get("orderId") or o.get("id") or (o.get("order") or {}).get("id")
  return None
print("1" if any(oid_of(o)==oid for o in orders) else "0")
PY
}

echo "➡️ API_BASE=$API_BASE"

echo "— Reset"
post_try "/reset" '{}' >/dev/null || true

echo "— Create order (Thieyp)"
CREATE_PAYLOAD='{
  "partnerSlug":"thieyp",
  "partnerName":"Thieyp",
  "currency":"EUR",
  "items":[{"sku":"thieyp-fri-002","name":"Thiéboudieune","priceEUR":21.9,"qty":1}]
}'
create_res="$(post_try "/create" "$CREATE_PAYLOAD")"
echo "$create_res"

orderId="$(printf '%s' "$create_res" | get_order_id)"
if [ -z "$orderId" ]; then
  echo "❌ orderId introuvable (ni orderId, ni order.id) dans la réponse create" >&2
  exit 1
fi
echo "✅ orderId=$orderId"

echo "— List (avant READY) : doit contenir l'order"
list_before="$(post_try "/list" '{}')"
echo "$list_before"
if [ "$(list_contains_order "$orderId" "$list_before")" != "1" ]; then
  echo "⚠️ L'order n'apparait pas dans /list. On continue quand même (selon implémentation API)." >&2
else
  echo "✅ /list contient l'order (OK)"
fi

echo "— Status READY"
post_try "/status" "{\"orderId\":\"$orderId\",\"status\":\"READY\"}" >/dev/null \
  || post_try "/status" "{\"orderId\":\"$orderId\",\"status\":\"ready\"}" >/dev/null
echo "✅ READY OK"

echo "— Status DELIVERED"
post_try "/status" "{\"orderId\":\"$orderId\",\"status\":\"DELIVERED\"}" >/dev/null \
  || post_try "/status" "{\"orderId\":\"$orderId\",\"status\":\"delivered\"}" >/dev/null
echo "✅ DELIVERED OK"

echo "— Get (peut être not_found si l'API purge après livraison)"
get_res="$(post_try "/get" "{\"orderId\":\"$orderId\"}")"
echo "$get_res"

is_nf="$(printf '%s' "$get_res" | json_has_error_not_found)"
if [ "$is_nf" = "1" ]; then
  echo "ℹ️ /get => not_found. Vérifions /list après livraison."
  list_after="$(post_try "/list" '{}')"
  echo "$list_after"
  if [ "$(list_contains_order "$orderId" "$list_after")" = "1" ]; then
    echo "❌ Incohérent: /list contient l'order mais /get not_found" >&2
    exit 1
  fi
  echo "✅ OK: commande purgée après livraison (comportement attendu)."
else
  echo "✅ OK: /get a renvoyé la commande."
fi

echo "✅ Smoke test Thieyp terminé."
