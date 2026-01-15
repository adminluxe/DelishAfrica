#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
LOG_DIR="$ROOT/tonton_logs"
TS="$(date +'%Y%m%d-%H%M%S')"
LOG="$LOG_DIR/flow_gate_e2e_$TS.log"
mkdir -p "$LOG_DIR"

API_LOCAL="http://127.0.0.1:3010"
API_PUBLIC="https://api.delishafrica.me"

log(){ echo "[$(date +'%H:%M:%S')] $*" | tee -a "$LOG"; }

pick_base(){
  if curl -fsS "$API_LOCAL/api/health" >/dev/null 2>&1; then echo "$API_LOCAL"; return; fi
  if curl -fsS "$API_PUBLIC/api/health" >/dev/null 2>&1; then echo "$API_PUBLIC"; return; fi
  echo ""
}

BASE="$(pick_base)"
if [[ -z "$BASE" ]]; then
  log "❌ No API reachable (local/public). Start API first."
  log "LOG=$LOG"
  exit 1
fi

log "== FLOW GATE E2E =="
log "BASE=$BASE"
log "LOG=$LOG"

log "[1] health"
curl -fsS "$BASE/api/health" | head -c 400 | tee -a "$LOG"; echo | tee -a "$LOG"

log "[2] create demo order"
CREATE="$(curl -fsS -X POST "$BASE/api/v1/orders/demo/create" -H 'content-type: application/json' -d '{}' )"
echo "$CREATE" | head -c 900 | tee -a "$LOG"; echo | tee -a "$LOG"

# Robust extract order id:
# supports: {"orderId":"..."} OR {"order":{"id":"..."}}
ORDER_ID="$(echo "$CREATE" | sed -n 's/.*"orderId"[[:space:]]*:[[:space:]]*"\([^"]\+\)".*/\1/p' | head -n1 || true)"
if [[ -z "$ORDER_ID" ]]; then
  ORDER_ID="$(echo "$CREATE" | sed -n 's/.*"order"[^{]*{[^}]*"id"[[:space:]]*:[[:space:]]*"\([^"]\+\)".*/\1/p' | head -n1 || true)"
fi

if [[ -z "$ORDER_ID" ]]; then
  log "❌ order id NOT found in create response (API format changed)."
  exit 2
fi
log "orderId=$ORDER_ID"

log "[3] set READY"
READY_RES="$(curl -fsS -X POST "$BASE/api/v1/orders/demo/status" -H 'content-type: application/json' -d "{\"orderId\":\"$ORDER_ID\",\"status\":\"ready\"}")"
echo "$READY_RES" | head -c 700 | tee -a "$LOG"; echo | tee -a "$LOG"

log "[4] probe READY list (best effort)"
curl -fsS "$BASE/api/v1/orders?status=ready" 2>/dev/null | head -c 400 | tee -a "$LOG" || log "ℹ️ /api/v1/orders?status=ready not available"
echo | tee -a "$LOG"

log "[5] probe missions/dispatch endpoints (best effort)"
for ep in \
  "/api/missions" \
  "/api/v1/missions" \
  "/api/dispatch/active" \
  "/api/v1/dispatch/active"
do
  if curl -fsS "$BASE$ep" >/dev/null 2>&1; then
    log "✅ $ep exists:"
    curl -fsS "$BASE$ep" | head -c 400 | tee -a "$LOG"
    echo | tee -a "$LOG"
  else
    log "ℹ️ $ep not available"
  fi
done

log "✅ FLOW GATE DONE"
