#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
LOG_DIR="$ROOT/tonton_logs"
TS="$(date +%Y%m%d-%H%M%S)"
LOG="$LOG_DIR/smoke_e2e_$TS.log"

API_LOCAL="http://127.0.0.1:3010"
API_PUBLIC="https://api.delishafrica.ne"

mkdir -p "$LOG_DIR"

pick_base(){
  if curl -fsS "$API_LOCAL/api/health" >/dev/null 2>&1; then echo "$API_LOCAL"; return; fi
  if curl -fsS "$API_PUBLIC/api/health" >/dev/null 2>&1; then echo "$API_PUBLIC"; return; fi
  echo ""
}

BASE="$(pick_base)"
if [[ -z "$BASE" ]]; then
  echo "❌ Aucun API joignable (local 3010 / public). Lance d'abord da_api_supervisor_3010.sh" | tee -a "$LOG"
  exit 1
fi

log(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

log "== SMOKE E2E =="
log "BASE=$BASE"
log "LOG=$LOG"

log "[1] health"
curl -fsS "$BASE/api/health" | head -c 300 | tee -a "$LOG"; echo | tee -a "$LOG"

log "[2] create demo order"
CREATE="$(curl -fsS -X POST "$BASE/api/v1/orders/demo/create" -H 'content-type: application/json' -d '{}' )"
echo "$CREATE" | head -c 500 | tee -a "$LOG"; echo | tee -a "$LOG"
ORDER_ID="$(echo "$CREATE" | sed -n 's/.*"orderId":"\([^"]\+\)".*/\1/p' | head -n 1)"
if [[ -z "$ORDER_ID" ]]; then
  log "❌ orderId introuvable dans response create."
  exit 1
fi
log "orderId=$ORDER_ID"

log "[3] set READY"
READY_RES="$(curl -fsS -X POST "$BASE/api/v1/orders/demo/status" -H 'content-type: application/json' -d "{\"orderId\":\"$ORDER_ID\",\"status\":\"ready\"}")"
echo "$READY_RES" | head -c 500 | tee -a "$LOG"; echo | tee -a "$LOG"

log "[4] list READY (probe)"
curl -fsS "$BASE/api/v1/orders?status=ready" | head -c 600 | tee -a "$LOG"; echo | tee -a "$LOG"

log "[5] missions (if exists)"
if curl -fsS "$BASE/api/missions" >/dev/null 2>&1; then
  curl -fsS "$BASE/api/missions" | head -c 600 | tee -a "$LOG"; echo | tee -a "$LOG"
else
  log "ℹ️ /api/missions non dispo (OK si pas encore branché)."
fi

log "✅ SMOKE E2E DONE"
