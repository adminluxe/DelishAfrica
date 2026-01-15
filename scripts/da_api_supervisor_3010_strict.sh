#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
API_DIR="$ROOT/services/api-nest"
LOG_DIR="$ROOT/tonton_logs"
mkdir -p "$LOG_DIR"

TS="$(date +'%Y%m%d-%H%M%S')"
LOG="$LOG_DIR/api_3010_${TS}.log"
PIDFILE="$LOG_DIR/api_3010.pid"
PORT="3010"

log(){ echo "[$(date +'%H:%M:%S')] $*" | tee -a "$LOG"; }

log "=== API SUPERVISOR STRICT :$PORT ==="
log "LOG=$LOG"
log "PIDFILE=$PIDFILE"

# 0) Kill anything on 3010 + ghost dist/main.js
bash "$ROOT/scripts/da_kill_3010_hard.sh" "$PORT" | tee -a "$LOG" || true

# 1) If pidfile exists, kill it too
if [[ -f "$PIDFILE" ]]; then
  OLD="$(cat "$PIDFILE" 2>/dev/null || true)"
  if [[ -n "${OLD// }" ]]; then
    log "Old PIDFILE found: $OLD -> killing"
    kill -TERM "$OLD" 2>/dev/null || true
    sleep 1
    kill -KILL "$OLD" 2>/dev/null || true
  fi
  rm -f "$PIDFILE" || true
fi

# 2) Install/build WITHOUT husky/scripts issues
cd "$ROOT"
export HUSKY=0
export CI=1
export pnpm_config_ignore_scripts=true

log "Install deps (best effort, scripts OFF)"
if [[ -f pnpm-lock.yaml ]]; then
  pnpm -w install --ignore-scripts 2>&1 | tee -a "$LOG" || true
else
  npm install 2>&1 | tee -a "$LOG" || true
fi

log "Build API (nest build)"
cd "$API_DIR"
pnpm run build 2>&1 | tee -a "$LOG"

# 3) Start with nohup, single instance
log "Start API: nohup node dist/main.js"
nohup node dist/main.js >>"$LOG" 2>&1 & echo $! > "$PIDFILE"
PID="$(cat "$PIDFILE")"
log "PID=$PID"

# 4) Health loop
log "Healthcheck loop..."
for i in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
    log "OK /api/health"
    break
  fi
  sleep 0.5
  if ! kill -0 "$PID" 2>/dev/null; then
    log "❌ Process died. Tail log:"
    tail -n 80 "$LOG" || true
    exit 1
  fi
done

# 5) Final proof
log "Listeners proof:"
ss -ltnp | grep -E ":${PORT}\\b" | tee -a "$LOG" || true

log "=== DONE (API should be stable) ==="
log "TAIL: tail -n 80 $LOG"
