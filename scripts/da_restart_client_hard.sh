#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APP="$ROOT/apps/client"
PORT="8081"

LOG_DIR="$ROOT/tonton_logs"
TS="$(date +%Y%m%d-%H%M%S)"
LOG="$LOG_DIR/client_restart_${TS}.log"
mkdir -p "$LOG_DIR"
log(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

log "=== HARD RESTART CLIENT ==="
cd "$APP"

# IMPORTANT: ne pas laisser CI=1 sinon Expo devient non-interactif / QR parfois absent
unset CI || true
export EXPO_NO_INTERACTIVE=0

log "[1] Kill expo/metro (best effort)"
pkill -f "expo start.*client" 2>/dev/null || true
pkill -f "metro.*client" 2>/dev/null || true
pkill -f "react-native start" 2>/dev/null || true
sleep 0.5

log "[2] Free port $PORT"
PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "${PIDS:-}" ]]; then
  for pid in $PIDS; do kill -TERM "$pid" 2>/dev/null || true; done
  sleep 0.5
  for pid in $PIDS; do kill -KILL "$pid" 2>/dev/null || true; done
fi

log "[3] Clear caches"
rm -rf "$APP/.expo" "$APP/.expo-shared" 2>/dev/null || true
rm -rf "$ROOT/node_modules/.cache" 2>/dev/null || true

log "[4] Start (tunnel + clear)"
pnpm dev -- --tunnel --port "$PORT" --clear 2>&1 | tee -a "$LOG"
