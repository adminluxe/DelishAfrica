#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
LOG_DIR="$ROOT/tonton_logs"
TS="$(date +%Y%m%d-%H%M%S)"
LOG="$LOG_DIR/api_3010_${TS}.log"
PIDFILE="$LOG_DIR/tonton_api_3010.pid"

mkdir -p "$LOG_DIR"
log(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

PORT="3010"
API_DIR="$ROOT/services/api-nest"

log "=== API SUPERVISOR 3010 ==="
log "LOG=$LOG"

log "[1] Kill anything on :$PORT (hard)"
PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "${PIDS:-}" ]]; then
  log "Listener(s) on $PORT: $PIDS"
  for pid in $PIDS; do kill -TERM "$pid" 2>/dev/null || true; done
  sleep 0.8
  for pid in $PIDS; do kill -KILL "$pid" 2>/dev/null || true; done
else
  log "OK: no listener on $PORT"
fi

log "[2] Stop docker delish-api if exists (best effort)"
docker ps --format '{{.Names}}' | grep -E '^delish-api$' >/dev/null 2>&1 && docker stop delish-api >/dev/null 2>&1 || true

log "[3] Build + start API (nohup) in $API_DIR"
cd "$API_DIR"
pnpm -s install >/dev/null 2>&1 || true
pnpm -s run build | tee -a "$LOG"

nohup node dist/main.js >/dev/null 2>&1 &
API_PID="$!"
echo "$API_PID" > "$PIDFILE"
log "Started node dist/main.js pid=$API_PID (pidfile=$PIDFILE)"

log "[4] Healthcheck loop"
for i in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
    log "OK: API is UP"
    exit 0
  fi
  sleep 0.4
done

log "ERROR: API not responding on /api/health"
log "Tail log:"
tail -n 60 "$LOG" || true
exit 1
