#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APP="$ROOT/apps/merchant"
PORT="8083"
TS="$(date +%Y%m%d-%H%M%S)"
LOG="$ROOT/tonton_logs/merchant_restart_${TS}.log"
mkdir -p "$ROOT/tonton_logs"

log(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

log "== HARD RESTART MERCHANT (QR) =="
log "APP=$APP PORT=$PORT LOG=$LOG"

cd "$APP"

# Force Expo interactif
unset CI
export CI=""
export EXPO_NO_INTERACTIVE=0

log "[1] Kill expo/metro (best-effort)"
pkill -f "expo start.*merchant" 2>/dev/null || true
pkill -f "metro.*merchant" 2>/dev/null || true
pkill -f "react-native start" 2>/dev/null || true
sleep 0.5

log "[2] Free port $PORT"
PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "$PIDS" ]]; then
  log "Killing: $PIDS"
  for p in $PIDS; do kill -TERM "$p" 2>/dev/null || true; done
  sleep 0.8
  for p in $PIDS; do kill -KILL "$p" 2>/dev/null || true; done
fi

log "[3] Clear caches (safe)"
rm -rf "$APP/.expo" "$APP/.expo-shared" 2>/dev/null || true
rm -rf "$APP/node_modules/.cache" 2>/dev/null || true
rm -rf "$ROOT/node_modules/.cache" 2>/dev/null || true

log "[4] Start (tunnel + clear)"
pnpm dev -- --tunnel --port "$PORT" --clear 2>&1 | tee -a "$LOG"
