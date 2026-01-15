#!/usr/bin/env bash
set -euo pipefail

API="https://api.delishafrica.me"
TS="$(date +%Y%m%d-%H%M%S)"
OUT="/opt/delishafrica/monorepo/.tonton_smoke_$TS.log"

log(){ echo -e "\n🧡 $*\n" | tee -a "$OUT"; }
try(){
  local method="$1"; shift
  local url="$1"; shift
  local data="${1:-}"
  if [ -n "$data" ]; then
    curl -sS -X "$method" "$url" -H "content-type: application/json" -d "$data" -w "\n[HTTP:%{http_code}]\n" | tee -a "$OUT"
  else
    curl -sS -X "$method" "$url" -w "\n[HTTP:%{http_code}]\n" | tee -a "$OUT"
  fi
}

log "SMOKE FLOW via API — log: $OUT"
log "API base: $API"

log "1) Health checks"
try GET "$API/health" || true
try GET "$API/api/health" || true
try GET "$API/api/v1/health" || true

log "2) Reset demo (si existe)"
try POST "$API/api/v1/orders/demo/reset" '{}' || true
try POST "$API/api/orders/demo/reset" '{}' || true
try POST "$API/orders/demo/reset" '{}' || true

log "3) Create demo order (on tente plusieurs endpoints)"
RESP=""
set +e
RESP="$(curl -sS -X POST "$API/api/v1/orders/demo/create" -H "content-type: application/json" -d '{}' 2>/dev/null)"
CODE=$?
set -e
if [ $CODE -ne 0 ] || [ -z "$RESP" ]; then
  # fallback
  for u in \
    "$API/api/orders/demo/create" \
    "$API/orders/demo/create" \
    "$API/api/v1/orders" \
    "$API/api/orders" \
    "$API/orders"
  do
    log "Trying create on: $u"
    try POST "$u" '{"restaurant":"thieyp","items":[{"name":"Thieb","qty":1}],"notes":"smoke-test"}' || true
  done
else
  log "Create response (api/v1/orders/demo/create):"
  echo "$RESP" | tee -a "$OUT"
fi

log "4) List orders (pending/ready/delivered) — endpoints probes"
for u in \
  "$API/api/v1/orders" \
  "$API/api/orders" \
  "$API/orders" \
  "$API/api/v1/orders?status=pending" \
  "$API/api/v1/orders?status=ready" \
  "$API/api/v1/orders?status=delivered"
do
  log "GET $u"
  try GET "$u" || true
done

log "✅ SMOKE terminé. Lis le log:"
echo "   $OUT"
