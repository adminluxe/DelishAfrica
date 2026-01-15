#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d-%H%M%S)"
LOG="$ROOT/tonton_logs/probe_orders_$TS.log"
API_LOCAL="http://127.0.0.1:3010"
API_PUBLIC="https://api.delishafrica.me"

log(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

pick_base() {
  if curl -fsS --max-time 2 "$API_LOCAL/api/health" >/dev/null 2>&1; then echo "$API_LOCAL"; return; fi
  if curl -fsS --max-time 5 "$API_PUBLIC/api/health" >/dev/null 2>&1; then echo "$API_PUBLIC"; return; fi
  echo ""
}

BASE="$(pick_base)"
if [[ -z "$BASE" ]]; then
  log "❌ Aucun /api/health joignable (local/public)."
  log "   - local:  $API_LOCAL/api/health"
  log "   - public: $API_PUBLIC/api/health"
  exit 1
fi

log "✅ BASE=$BASE"
log "== Health =="
curl -fsS "$BASE/api/health" | head -c 500 | tee -a "$LOG"; echo | tee -a "$LOG"

log "== Create demo order =="
CREATE_RES="$(curl -fsS -X POST "$BASE/api/v1/orders/demo/create" -H 'content-type: application/json' -d '{}')"
echo "$CREATE_RES" | head -c 1200 | tee -a "$LOG"; echo | tee -a "$LOG"

ORDER_ID="$(echo "$CREATE_RES" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -n1)"
PARTNER_SLUG="$(echo "$CREATE_RES" | sed -n 's/.*"partnerSlug":"\([^"]*\)".*/\1/p' | head -n1)"

log "orderId=$ORDER_ID"
log "partnerSlug(from create)=$PARTNER_SLUG"

if [[ -z "$ORDER_ID" ]]; then
  log "❌ Impossible d'extraire orderId depuis create → ton endpoint create renvoie un format inattendu."
  exit 1
fi

log "== Probe LIST variants (on veut retrouver l'orderId) =="
probe() {
  local name="$1"
  local body="$2"
  log "-- $name body=$body"
  curl -fsS -X POST "$BASE/api/v1/orders/demo/list" -H 'content-type: application/json' -d "$body" | head -c 1200 | tee -a "$LOG"
  echo | tee -a "$LOG"
}

probe "list:{}" '{}'
if [[ -n "${PARTNER_SLUG:-}" ]]; then
  probe "list:{partnerSlug}" "{\"partnerSlug\":\"$PARTNER_SLUG\"}"
  probe "list:{partnerSlug,status:pending}" "{\"partnerSlug\":\"$PARTNER_SLUG\",\"status\":\"pending\"}"
  probe "list:{partnerSlug,status:ready}" "{\"partnerSlug\":\"$PARTNER_SLUG\",\"status\":\"ready\"}"
fi
probe "list:{status:pending}" '{"status":"pending"}'
probe "list:{status:ready}" '{"status":"ready"}'

log "== DONE =="
log "➡️ Lis le log: $LOG"
