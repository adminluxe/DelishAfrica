#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d-%H%M%S)"
BK="$ROOT/tonton_backups/sync_api_base_$TS"
LOG="$ROOT/tonton_logs/sync_api_base_$TS.log"
mkdir -p "$BK" "$(dirname "$LOG")"

API_BASE="${1:-https://api.delishafrica.me}"

log(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

write_env() {
  local app="$1"
  local dir="$ROOT/apps/$app"
  local env="$dir/.env"
  if [[ ! -d "$dir" ]]; then log "⚠️ skip $app (dir absent)"; return; fi

  if [[ -f "$env" ]]; then
    mkdir -p "$BK/$app"
    cp -a "$env" "$BK/$app/.env.bak"
    log "Backup $env -> $BK/$app/.env.bak"
  fi

  # On garde un .env simple et clair (Expo)
  cat > "$env" <<EOF
EXPO_PUBLIC_API_BASE_URL=$API_BASE
EOF
  log "✅ $app -> EXPO_PUBLIC_API_BASE_URL=$API_BASE"
}

log "== SYNC API BASE ALL APPS =="
log "API_BASE=$API_BASE"
write_env "client"
write_env "merchant"
write_env "courier"

log "DONE. Log: $LOG"
log "Backup: $BK"
