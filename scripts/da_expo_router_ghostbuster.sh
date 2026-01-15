#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=(client courier merchant)
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.backups/da_expo_router_ghostbuster_$TS"

log()  { printf "\n\033[1;32m[ghostbuster]\033[0m %s\n" "$*"; }
warn() { printf "\n\033[1;33m[ghostbuster]\033[0m %s\n" "$*"; }
err()  { printf "\n\033[1;31m[ghostbuster]\033[0m %s\n" "$*"; }

need() { command -v "$1" >/dev/null 2>&1 || { err "Missing dependency: $1"; exit 1; }; }

backup_path() {
  local p="$1"
  [ -e "$p" ] || return 0
  mkdir -p "$BACKUP_DIR"
  local rel="${p#$ROOT/}"
  mkdir -p "$BACKUP_DIR/$(dirname "$rel")"
  cp -a "$p" "$BACKUP_DIR/$rel"
}

kill_port() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
    if [ -n "${pids:-}" ]; then
      warn "Killing processes on port $port: $pids"
      kill -9 $pids || true
    else
      log "No process found on port $port"
    fi
  else
    warn "lsof not installed; skipping port kill for $port"
  fi
}

ensure_known_good_orders_demo() {
  local appdir="$1"
  local appname="$2"
  local file="$appdir/app/orders-demo.tsx"

  mkdir -p "$appdir/app"

  # Backup existing route files (both variants)
  for f in "$appdir/app/orders-demo.tsx" "$appdir/app/orders_demo.tsx" \
           "$appdir/app/orders-demo.js"  "$appdir/app/orders_demo.js"; do
    backup_path "$f"
  done

  cat > "$file" <<'TSX'
import React from "react";
import { View, Text } from "react-native";

export default function OrdersDemoRoute() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
      <Text style={{ fontSize: 16, fontWeight: "600", textAlign: "center" }}>Orders Demo</Text>
      <Text style={{ marginTop: 8, textAlign: "center" }}>
        Route placeholder (ghostbuster forced default export)
      </Text>
    </View>
  );
}
TSX

  # Remove the snake_case duplicates to avoid weird resolution paths
  rm -f "$appdir/app/orders_demo.tsx" "$appdir/app/orders-demo.js" "$appdir/app/orders_demo.js" || true

  log "Written known-good route: $file"
  log "First lines:"
  sed -n '1,18p' "$file"
}

need bash
need python3
mkdir -p "$ROOT/.backups"

log "0) Stop Metro/Expo servers by killing common ports (8081/8082/8083)"
kill_port 8081
kill_port 8082
kill_port 8083

log "1) Deep-clean Expo/Router/Metro caches (per app) + backup"
for a in "${APPS[@]}"; do
  APPDIR="$ROOT/apps/$a"
  [ -d "$APPDIR" ] || { warn "Missing app dir: $APPDIR (skip)"; continue; }

  log "---- App: $a"
  # Backup then remove key caches
  for p in \
    "$APPDIR/.expo" \
    "$APPDIR/.expo-shared" \
    "$APPDIR/.metro-cache" \
    "$APPDIR/.metro" \
    "$APPDIR/.cache" \
    "$APPDIR/node_modules/.cache" \
    "$APPDIR/.turbo" \
    "$APPDIR/.next" \
    "$APPDIR/dist" \
    "$APPDIR/build" \
  ; do
    if [ -e "$p" ]; then
      backup_path "$p"
      rm -rf "$p" || true
      log "Removed cache: $p"
    fi
  done

  # Also backup & clean any nested ".expo" below the app (rare but causes ghosts)
  while IFS= read -r -d '' p; do
    backup_path "$p"
    rm -rf "$p" || true
    warn "Removed nested cache: $p"
  done < <(find "$APPDIR" -maxdepth 5 -type d \( -name ".expo" -o -name ".expo-shared" -o -name ".metro-cache" \) -print0 2>/dev/null || true)

  log "2) Enforce a known-good orders-demo route in $a"
  ensure_known_good_orders_demo "$APPDIR" "$a"
done

log "3) Extra: show any remaining orders-demo references in router-generated folders (if any)"
if command -v rg >/dev/null 2>&1; then
  rg -n "orders-demo\.tsx|orders_demo\.tsx|Route \./orders-demo\.tsx" "$ROOT/apps" || true
else
  warn "rg not found; skipping deep grep."
fi

log "DONE ✅"
echo
echo "Backups saved here:"
echo "  $BACKUP_DIR"
echo
cat <<'NEXT'
NEXT (important):
1) Relaunch the 3 apps with --clear (fresh router manifest):
   cd /opt/delishafrica/monorepo/apps/client   && pnpm dev -- --tunnel --port 8081 --clear
   cd /opt/delishafrica/monorepo/apps/courier  && pnpm dev -- --tunnel --port 8082 --clear
   cd /opt/delishafrica/monorepo/apps/merchant && pnpm dev -- --tunnel --port 8083 --clear

2) iPhone:
   - swipe-close complètement les 3 apps
   - re-scan les 3 QR

If you ever need to rollback:
- restore from the backups folder printed above.
NEXT
