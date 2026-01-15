#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
API_DIR="$ROOT/services/api-nest"
TS="$(date +%Y%m%d-%H%M%S)"
LOG="$ROOT/.tonton_api_reset_$TS.log"

log(){ echo -e "\n🧡 $*\n" | tee -a "$LOG"; }
need(){ command -v "$1" >/dev/null 2>&1 || { echo "❌ Missing: $1"; exit 1; }; }

need lsof
need curl
need ps
need awk

PORTS=(3010 3000 3001 8080 8081 8082 8083 19000 19001 19002)

log "1) Snapshot listeners (avant)"
for p in "${PORTS[@]}"; do
  lsof -iTCP:"$p" -sTCP:LISTEN -n -P >/dev/null 2>&1 && {
    echo "— LISTEN :$p" | tee -a "$LOG"
    lsof -iTCP:"$p" -sTCP:LISTEN -n -P | tee -a "$LOG"
  } || true
done

log "2) Kill uniquement les listeners node (safe) sur ports critiques"
for p in 3010 3000 3001; do
  HITS="$(lsof -iTCP:"$p" -sTCP:LISTEN -n -P 2>/dev/null || true)"
  if [ -n "$HITS" ]; then
    PIDS="$(echo "$HITS" | awk 'NR>1 {print $2}' | sort -u)"
    for pid in $PIDS; do
      CMD="$(ps -p "$pid" -o command= 2>/dev/null || true)"
      if echo "$CMD" | grep -Eqi '(node|nest|next|delish|ops)'; then
        log "→ kill -TERM $pid (port $p) :: $CMD"
        kill -TERM "$pid" 2>/dev/null || true
      else
        log "⚠️ Skip $pid (pas node/delish) :: $CMD"
      fi
    done
  fi
done

sleep 1

log "3) Forcer libération si encore bloqué (KILL node/delish seulement)"
for p in 3010 3000 3001; do
  HITS="$(lsof -iTCP:"$p" -sTCP:LISTEN -n -P 2>/dev/null || true)"
  if [ -n "$HITS" ]; then
    PIDS="$(echo "$HITS" | awk 'NR>1 {print $2}' | sort -u)"
    for pid in $PIDS; do
      CMD="$(ps -p "$pid" -o command= 2>/dev/null || true)"
      if echo "$CMD" | grep -Eqi '(node|nest|next|delish|ops)'; then
        log "→ kill -KILL $pid (port $p)"
        kill -KILL "$pid" 2>/dev/null || true
      fi
    done
  fi
done

sleep 1

log "4) Re-check ports 3010/3000/3001"
for p in 3010 3000 3001; do
  if lsof -iTCP:"$p" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
    log "❌ Port $p encore occupé. Voici le listener:"
    lsof -iTCP:"$p" -sTCP:LISTEN -n -P | tee -a "$LOG"
    echo "Log: $LOG"
    exit 1
  else
    log "✅ Port $p libre."
  fi
done

log "5) Relance API Nest (api-nest)"
if [ ! -d "$API_DIR" ]; then
  log "❌ API_DIR introuvable: $API_DIR"
  exit 1
fi

cd "$API_DIR"

if [ -f pnpm-lock.yaml ]; then
  log "pnpm install (si nécessaire)"
  pnpm install | tee -a "$LOG"
  log "pnpm build"
  pnpm build | tee -a "$LOG"
  log "pnpm start (background via nohup)"
  nohup pnpm start > "$ROOT/.tonton_api_nest_$TS.out" 2>&1 &
else
  log "npm install (si nécessaire)"
  npm install | tee -a "$LOG"
  log "npm run build"
  npm run build | tee -a "$LOG"
  log "npm run start (background via nohup)"
  nohup npm run start > "$ROOT/.tonton_api_nest_$TS.out" 2>&1 &
fi

sleep 2

log "6) Healthchecks rapides"
BASE="http://127.0.0.1:3010"
for path in "/api/v1/orders/demo/health" "/api/health" "/health"; do
  code="$(curl -s -o /dev/null -w "%{http_code}" "$BASE$path" || true)"
  echo "GET $BASE$path => HTTP $code" | tee -a "$LOG"
done

log "✅ Reset API terminé. Logs:"
echo " - $LOG"
echo " - $ROOT/.tonton_api_nest_$TS.out"
