#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=(client courier merchant)
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/remove_probe_$TS"
REPORT_DIR="$ROOT/.tonton_backups/_reports"
REPORT="$REPORT_DIR/remove_probe_report_$TS.txt"

log()  { printf "\n\033[1;32m[DA]\033[0m %s\n" "$*"; }
warn() { printf "\n\033[1;33m[DA WARN]\033[0m %s\n" "$*"; }

mkdir -p "$BK" "$REPORT_DIR"
: > "$REPORT"

backup_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  local rel="${f#"$ROOT"/}"
  mkdir -p "$BK/$(dirname "$rel")"
  cp -a "$f" "$BK/$rel"
}

kill_ports() {
  local ports=(8081 8082 8083 19000 19001 19002 19006 19007 4040 4049)
  for p in "${ports[@]}"; do
    if lsof -tiTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then
      log "Kill port $p"
      lsof -tiTCP:"$p" -sTCP:LISTEN | xargs -r kill -9 || true
    fi
  done
  pkill -f "expo start" || true
  pkill -f "expo-dev-server" || true
  pkill -f "metro" || true
  pkill -f "ngrok" || true
  pkill -f "@expo/ngrok" || true
}

latest_backup_dir() {
  local prefix="$1" # ex: responder_scalpel
  ls -1dt "$ROOT/.tonton_backups/${prefix}_"* 2>/dev/null | head -n 1 || true
}

restore_from_dir() {
  local SRC="$1"
  [[ -n "$SRC" && -d "$SRC" ]] || return 0
  log "RESTORE from: $SRC"
  ( cd "$SRC" && find . -type f -print0 ) | while IFS= read -r -d '' rel; do
    local src="$SRC/$rel"
    local dst="$ROOT/$rel"
    mkdir -p "$(dirname "$dst")"
    cp -a "$src" "$dst"
  done
}

set_env_normal() {
  local app="$1"
  local envfile="$ROOT/apps/$app/.env.local"
  mkdir -p "$(dirname "$envfile")"
  touch "$envfile"
  backup_file "$envfile"

  set_kv() {
    local k="$1" v="$2"
    grep -q "^$k=" "$envfile" \
      && sed -i "s|^$k=.*|$k=$v|" "$envfile" \
      || echo "$k=$v" >> "$envfile"
  }

  set_kv "EXPO_PUBLIC_BG_OFF" "0"
  set_kv "EXPO_PUBLIC_SCROLL_DIAG" "0"
  set_kv "EXPO_PUBLIC_LAYOUT_SCALPEL" "0"
  set_kv "EXPO_PUBLIC_RESPONDER_SCALPEL" "0"
  set_kv "EXPO_PUBLIC_SCROLL_FIX" "0"
}

scan_leftovers() {
  local app="$1"
  local base="$ROOT/apps/$app"
  [[ -d "$base" ]] || return 0

  {
    echo ""
    echo "=============================="
    echo "LEFTOVERS SCAN: $app"
    echo "=============================="
  } >> "$REPORT"

  # Cherche les marqueurs des écrans test
  grep -RIn --exclude-dir=node_modules --exclude-dir=.git \
    -E "SCROLL PROBE|ScrollProbe|If this scrolls|LAYOUT SCALPEL" \
    "$base/app" "$base/src" "$base/components" "$base/ui" 2>/dev/null >> "$REPORT" || true
}

log "ROOT: $ROOT"
log "REPORT: $REPORT"
log "Backup snapshot (for env edits etc): $BK"

log "1) Stop metros / free ports"
kill_ports

log "2) Restore last responder/layout backups (removes Probe + Layout scalpel)"
RESP="$(latest_backup_dir responder_scalpel)"
LAYO="$(latest_backup_dir layout_scalpel)"

if [[ -z "${RESP}" ]]; then warn "No responder_scalpel backup found."; fi
if [[ -z "${LAYO}" ]]; then warn "No layout_scalpel backup found."; fi

restore_from_dir "$RESP"
restore_from_dir "$LAYO"

log "3) Normalize .env.local flags"
for app in "${APPS[@]}"; do
  [[ -d "$ROOT/apps/$app" ]] || { warn "App missing: $app"; continue; }
  set_env_normal "$app"
done

log "4) Scan leftovers (should be empty)"
for app in "${APPS[@]}"; do
  scan_leftovers "$app"
done

log "✅ Done. Next: restart Expo with --clear + swipe-close iPhone + re-scan QR."
cat <<EOF

# CLIENT
cd $ROOT/apps/client   && pnpm exec expo start --dev-client --tunnel --clear --port 8081
# COURIER
cd $ROOT/apps/courier  && pnpm exec expo start --dev-client --tunnel --clear --port 8082
# MERCHANT
cd $ROOT/apps/merchant && pnpm exec expo start --dev-client --tunnel --clear --port 8083

Leftovers report:
$REPORT
EOF
