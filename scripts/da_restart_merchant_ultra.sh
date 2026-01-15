#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APP="$ROOT/apps/merchant"
PORT="${1:-8083}"
TS="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="$ROOT/tonton_logs"
LOG="$LOG_DIR/merchant_ultra_${TS}.log"

mkdir -p "$LOG_DIR"
log(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

log "=== MERCHANT ULTRA RESTART ==="
log "APP=$APP"
log "PORT=$PORT"
log "LOG=$LOG"

# Expo peut ne pas afficher le QR si CI/NO_INTERACTIVE est set
unset CI || true
unset EXPO_NO_INTERACTIVE || true

log "[1] Kill expo/metro (best effort)"
pkill -f "expo.*merchant" 2>/dev/null || true
pkill -f "metro.*merchant" 2>/dev/null || true
pkill -f "react-native.*merchant" 2>/dev/null || true
pkill -f "node.*merchant" 2>/dev/null || true

log "[2] Free port $PORT"
PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
if [ -n "${PIDS:-}" ]; then
  log "Listeners on $PORT: $PIDS -> killing"
  for pid in $PIDS; do kill -TERM "$pid" 2>/dev/null || true; done
  sleep 0.8
  for pid in $PIDS; do kill -KILL "$pid" 2>/dev/null || true; done
else
  log "No listener on $PORT"
fi

log "[3] Clear caches (merchant)"
rm -rf "$APP/.expo" "$APP/.expo-shared" 2>/dev/null || true
rm -rf "$APP/node_modules/.cache" 2>/dev/null || true
rm -rf "$ROOT/node_modules/.cache" 2>/dev/null || true

log "[4] Start merchant with tunnel + clear (QR must appear)"
cd "$APP"
( pnpm dev -- --tunnel --port "$PORT" --clear 2>&1 | tee -a "$LOG" )

