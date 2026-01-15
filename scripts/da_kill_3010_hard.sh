#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-3010}"
ROOT="/opt/delishafrica/monorepo"
API_DIR="$ROOT/services/api-nest"

log(){ echo "[$(date +'%H:%M:%S')] $*"; }

log "=== KILL HARD port $PORT ==="

# 1) Show listeners
log "Listeners before:"
ss -ltnp | grep -E ":$PORT\\b" || true

# 2) Kill by port (TERM then KILL)
PIDS="$(lsof -n -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | tr '\n' ' ' || true)"
if [[ -n "${PIDS// }" ]]; then
  log "Killing PIDs on port $PORT: $PIDS"
  kill -TERM $PIDS 2>/dev/null || true
  sleep 1
  kill -KILL $PIDS 2>/dev/null || true
else
  log "OK: no PID on port $PORT"
fi

# 3) Extra: kill node dist/main.js referencing api-nest (ghost)
GHOSTS="$(ps aux | grep -E "node .*dist/main\.js" | grep -F "$API_DIR" | awk '{print $2}' | tr '\n' ' ' || true)"
if [[ -n "${GHOSTS// }" ]]; then
  log "Killing ghost node dist/main.js (api-nest): $GHOSTS"
  kill -TERM $GHOSTS 2>/dev/null || true
  sleep 1
  kill -KILL $GHOSTS 2>/dev/null || true
else
  log "OK: no ghost dist/main.js for api-nest"
fi

# 4) Docker check (optional info)
log "Docker containers exposing $PORT (info):"
docker ps --format "table {{.Names}}\t{{.Ports}}" | grep -E ":$PORT\\b" || true

# 5) Final proof
sleep 0.5
log "Listeners after:"
ss -ltnp | grep -E ":$PORT\\b" || true

log "=== DONE ==="
