#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
LOG_DIR="$ROOT/tonton_logs"
BK="$ROOT/tonton_backups/sync_api_base_$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOG_DIR" "$BK"

TS="$(date +%Y%m%d-%H%M%S)"
LOG="$LOG_DIR/sync_api_base_${TS}.log"
log(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

API_BASE="${1:-https://api.delishafrica.me}"

write_env_file () {
  local app="$1"
  local dir="$ROOT/apps/$app"
  if [[ ! -d "$dir" ]]; then
    log "skip $app (missing dir)"
    return 0
  fi

  # on préfère .env (Expo le lit souvent), sinon .env.local, sinon on crée .env
  local envfile=""
  if [[ -f "$dir/.env" ]]; then envfile="$dir/.env"
  elif [[ -f "$dir/.env.local" ]]; then envfile="$dir/.env.local"
  else envfile="$dir/.env"
  fi

  mkdir -p "$BK/$app"
  [[ -f "$envfile" ]] && cp -a "$envfile" "$BK/$app/$(basename "$envfile").bak" || true

  # Remplace ou ajoute la variable
  if [[ -f "$envfile" ]] && grep -q '^EXPO_PUBLIC_API_BASE_URL=' "$envfile"; then
    sed -i "s|^EXPO_PUBLIC_API_BASE_URL=.*$|EXPO_PUBLIC_API_BASE_URL=${API_BASE}|" "$envfile"
  else
    {
      echo ""
      echo "EXPO_PUBLIC_API_BASE_URL=${API_BASE}"
    } >> "$envfile"
  fi

  log "OK $app -> $(realpath "$envfile") = $API_BASE"
}

log "=== SYNC API BASE ALL APPS ==="
log "API_BASE=$API_BASE"
write_env_file "client"
write_env_file "merchant"
write_env_file "courier"
log "DONE. Backup: $BK"
