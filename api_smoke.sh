#!/usr/bin/env bash
set -Eeuo pipefail
command -v jq >/dev/null 2>&1 || { echo "✗ jq requis (apt install jq)."; exit 1; }

BASE="http://localhost:${PORT:-3000}"

say(){ echo -e "$*"; }

say "→ Health:" && curl -s "${BASE}/health/db" | jq -c

# 1) admin user id
ADMIN_ID=$(curl -s "${BASE}/users/by-email?email=admin@delish.africa" | jq -r '.id // empty')
if [[ -z "$ADMIN_ID" ]]; then
  ADMIN_ID=$(curl -s "${BASE}/users?email=admin@delish.africa" | jq -r '.items[0].id // empty')
fi
# fallback ultime: via /orders
if [[ -z "$ADMIN_ID" ]]; then
  ADMIN_ID=$(curl -s "${BASE}/orders" | jq -r '.items[0].userId // empty')
fi
[[ -n "$ADMIN_ID" ]] || { echo "✗ Admin introuvable via API"; exit 1; }
say "✓ ADMIN_ID=${ADMIN_ID}"

# 2) merchant id (Mafé House) -> trouve ou crée
MERCHANT_ID=$(curl -s "${BASE}/merchants" | jq -r '.items[] | select(.name=="Mafé House") | .id' | head -n1)
if [[ -z "$MERCHANT_ID" ]]; then
  MERCHANT_ID=$(curl -sX POST "${BASE}/merchants" -H 'Content-Type: application/json' \
    -d '{"name":"Mafé House"}' | jq -r '.id')
fi
say "✓ MERCHANT_ID=${MERCHANT_ID}"

# 3) products pour ce merchant -> crée s'ils manquent
ensure_product() {
  local name="$1" price="$2" desc="$3" cat="$4"
  local pid
  pid=$(curl -s "${BASE}/products?merchantId=${MERCHANT_ID}" | jq -r --arg n "$name" '(.items // [])[] | select(.name==$n) | .id' | head -n1)
  if [[ -z "$pid" ]]; then
    pid=$(curl -sX POST "${BASE}/products" -H 'Content-Type: application/json' \
      -d "$(jq -n --arg mid "$MERCHANT_ID" --arg n "$name" --arg d "$desc" --arg c "$cat" --argjson p "$price" \
          '{merchantId:$mid,name:$n,description:$d,category:$c,price:$p}')" \
      | jq -r '.id')
  fi
  echo "$pid"
}

P1_ID=$(ensure_product "Mafé poulet" 12.9 "Ragoût arachide" "Plat")
P2_ID=$(ensure_product "Yassa poisson" 14.9 "Citron/Oignons" "Plat")
say "✓ P1_ID=${P1_ID}"
say "✓ P2_ID=${P2_ID}"

# 4) create order avec 2 items
ORDER_JSON=$(jq -n --arg u "$ADMIN_ID" --arg m "$MERCHANT_ID" --arg p1 "$P1_ID" --arg p2 "$P2_ID" '
  { userId:$u, merchantId:$m,
    items:[ {productId:$p1, quantity:1}, {productId:$p2, quantity:2} ] }')

ORDER=$(curl -sX POST "${BASE}/orders" -H 'Content-Type: application/json' -d "$ORDER_JSON")
ORDER_ID=$(echo "$ORDER" | jq -r '.id // empty')
[[ -n "$ORDER_ID" ]] || { echo "✗ Création order KO:"; echo "$ORDER" | jq -c; exit 1; }
say "✓ ORDER_ID=${ORDER_ID}"

# 5) passe status -> READY
PATCH=$(curl -sX PATCH "${BASE}/orders/${ORDER_ID}/status" -H 'Content-Type: application/json' -d '{"status":"READY"}' | jq -c)
say "✓ PATCH status=READY → $PATCH"

# 6) récap
echo "— Récap —"
echo "ADMIN_ID   : $ADMIN_ID"
echo "MERCHANT_ID: $MERCHANT_ID"
echo "P1_ID      : $P1_ID"
echo "P2_ID      : $P2_ID"
echo "ORDER_ID   : $ORDER_ID"
