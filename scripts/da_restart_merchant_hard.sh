#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APP="$ROOT/apps/merchant"
PORT="8083"
TS="$(date +%Y%m%d-%H%M%S)"
LOG="$ROOT/tonton_logs/merchant_restart_$TS.log"
mkdir -p "$(dirname "$LOG")"

log(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

log "=== HARD RESTART MERCHANT ==="
log "APP=$APP"
log "PORT=$PORT"
log "LOG=$LOG"

cd "$APP"

log "[1] Kill expo/metro (best effort)"
pkill -f "expo start.*merchant" 2>/dev/null || true
pkill -f "metro.*merchant" 2>/dev/null || true
pkill -f "react-native start" 2>/dev/null || true
sleep 0.6

log "[2] Free port $PORT"
PIDS="$(lsof -ti tcp:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "${PIDS}" ]]; then
  log "Listener(s) on $PORT: $PIDS -> killing"
  for pid in $PIDS; do kill -TERM "$pid" 2>/dev/null || true; done
  sleep 0.8
  for pid in $PIDS; do kill -KILL "$pid" 2>/dev/null || true; done
else
  log "No listener on $PORT"
fi

log "[3] Clear caches (safe)"
rm -rf "$APP/.expo" "$APP/.expo-shared" 2>/dev/null || true
rm -rf "$APP/node_modules/.cache" 2>/dev/null || true
rm -rf "$ROOT/node_modules/.cache" 2>/dev/null || true

log "[4] Show API env (if any)"
if [[ -f "$APP/.env" ]]; then
  grep -E "EXPO_PUBLIC_API_BASE_URL|API_BASE" "$APP/.env" || true
else
  log "No .env found in merchant (ok)"
fi

log "[5] Start Merchant with NEW tunnel + clear"
log "CMD: pnpm dev -- --tunnel --port $PORT --clear"
pnpm dev -- --tunnel --port "$PORT" --clear 2>&1 | tee -a "$LOG"
