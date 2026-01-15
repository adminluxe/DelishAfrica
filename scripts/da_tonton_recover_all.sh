#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
LOG_DIR="$ROOT/tonton_logs"
TS="$(date +'%Y%m%d-%H%M%S')"
LOG="$LOG_DIR/recover_all_$TS.log"
mkdir -p "$LOG_DIR"

log(){ echo "[$(date +'%H:%M:%S')] $*" | tee -a "$LOG"; }

log "== TONTON RECOVER ALL =="
log "LOG=$LOG"

# 1) stop likely conflict processes (expo/metro + cloudflared) but DON'T kill tmux itself
log "[A] Kill expo/metro (best effort)"
pkill -f "expo start" >/dev/null 2>&1 || true
pkill -f "expo-dev-server" >/dev/null 2>&1 || true
pkill -f "metro" >/dev/null 2>&1 || true
pkill -f "cloudflared" >/dev/null 2>&1 || true

# 2) free common ports (apps + api)
log "[B] Free common ports"
for p in 3010 8081 8082 8083 19000 19001 19002 19006 19007; do
  bash "$ROOT/scripts/da_kill_port.sh" "$p" >/dev/null 2>&1 || true
done

# 3) start API stable
log "[C] Start API supervisor 3010"
bash "$ROOT/scripts/da_api_supervisor_3010.sh" | tee -a "$LOG"

# 4) Run flow gate E2E (create + READY + probes)
log "[D] Run flow gate E2E"
bash "$ROOT/scripts/da_flow_gate_e2e.sh" | tee -a "$LOG"

log "✅ RECOVER ALL DONE"
