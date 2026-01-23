#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
SESSION="DA_REL"
PATH_FIXED="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

NOW="$(date +%Y%m%d_%H%M%S)"
BKP="$ROOT/.tonton_backups/hard_clean_reinstall_$NOW"
LOG="$BKP/run.log"
mkdir -p "$BKP"

log(){ echo -e "\n[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }
die(){ echo -e "\n[ERROR] $*" | tee -a "$LOG" >&2; exit 1; }

command -v tmux >/dev/null 2>&1 || die "tmux introuvable"
tmux has-session -t "$SESSION" >/dev/null 2>&1 || die "Session tmux '$SESSION' introuvable"
cd "$ROOT" || die "ROOT introuvable: $ROOT"

export PATH="$PATH_FIXED"
hash -r || true

log "1) Stop panes (Ctrl+C) + kill processus pnpm/expo/metro"
for w in 2 5 6 7; do tmux send-keys -t "$SESSION:$w" C-c || true; done
pkill -f "pnpm" >/dev/null 2>&1 || true
pkill -f "expo start" >/dev/null 2>&1 || true
pkill -f "metro" >/dev/null 2>&1 || true

log "2) Backup minimal (lock + npmrc)"
[[ -f "$ROOT/pnpm-lock.yaml" ]] && cp -a "$ROOT/pnpm-lock.yaml" "$BKP/" || true
[[ -f "$ROOT/package.json" ]] && cp -a "$ROOT/package.json" "$BKP/" || true
[[ -f "$ROOT/.npmrc" ]] && cp -a "$ROOT/.npmrc" "$BKP/" || true

log "3) HARD CLEAN node_modules (root + apps + api-nest)"
rm -rf "$ROOT/node_modules" 2>/dev/null || true
rm -rf "$ROOT/apps/client/node_modules" 2>/dev/null || true
rm -rf "$ROOT/apps/merchant/node_modules" 2>/dev/null || true
rm -rf "$ROOT/apps/courier/node_modules" 2>/dev/null || true
rm -rf "$ROOT/services/api-nest/node_modules" 2>/dev/null || true

log "4) Clean caches metro/expo (safe)"
rm -rf /tmp/metro-* /tmp/haste-map-* /tmp/react-* 2>/dev/null || true
find "$ROOT" -maxdepth 4 -type d -name ".expo" -prune -exec rm -rf {} + 2>/dev/null || true

log "5) Sanity pnpm"
command -v pnpm >/dev/null 2>&1 || die "pnpm introuvable"
pnpm -v | tee -a "$LOG"

log "6) Reinstall workspace (UNIQUE install)"
pnpm -w install --force | tee -a "$LOG"

log "7) Checks rapides (expo + reflect-metadata)"
check_node_req(){
  local dir="$1" mod="$2"
  ( cd "$dir" && node -e "require('$mod'); console.log('OK require: $mod')" ) >/dev/null 2>&1
}

if ! check_node_req "$ROOT/apps/client" "expo/package.json"; then
  log "⚠️ expo pas résolu dans client -> reinstall filtré client"
  pnpm -w --filter client... install --force | tee -a "$LOG"
fi

if ! check_node_req "$ROOT/apps/merchant" "expo/package.json"; then
  log "⚠️ expo pas résolu dans merchant -> reinstall filtré merchant"
  pnpm -w --filter merchant... install --force | tee -a "$LOG"
fi

if ! check_node_req "$ROOT/apps/courier" "expo/package.json"; then
  log "⚠️ expo pas résolu dans courier -> reinstall filtré courier"
  pnpm -w --filter courier... install --force | tee -a "$LOG"
fi

if [[ -d "$ROOT/services/api-nest" ]]; then
  if ! check_node_req "$ROOT/services/api-nest" "reflect-metadata"; then
    log "⚠️ reflect-metadata pas résolu dans api-nest -> add + install filtré api-nest"
    pnpm -C "$ROOT/services/api-nest" add reflect-metadata | tee -a "$LOG" || true
    pnpm -w --filter delishafrica-api-nest... install --force | tee -a "$LOG" || true
  fi
fi

log "8) Relance panes (API + metros) en mode SAFE (pas de pnpm install dans les apps)"
# API: on tente start (node dist) d'abord. PORT=4001 pour éviter confusion avec docker:3010
tmux send-keys -t "$SESSION:2" "cd '$ROOT/services/api-nest' && export PATH='$PATH_FIXED' && export PORT=4001 && pnpm -v && (pnpm run start || pnpm run start:dev || node -r reflect-metadata dist/main.js) ; exec bash" C-m

# Metros
tmux send-keys -t "$SESSION:5" "cd '$ROOT/apps/client' && export PATH='$PATH_FIXED' && pnpm -v && pnpm exec expo start --dev-client --tunnel --port 8081 --clear ; exec bash" C-m
tmux send-keys -t "$SESSION:6" "cd '$ROOT/apps/merchant' && export PATH='$PATH_FIXED' && pnpm -v && pnpm exec expo start --dev-client --tunnel --port 8083 --clear ; exec bash" C-m
tmux send-keys -t "$SESSION:7" "cd '$ROOT/apps/courier' && export PATH='$PATH_FIXED' && pnpm -v && pnpm exec expo start --dev-client --tunnel --port 8082 --clear ; exec bash" C-m

log "✅ DONE. Regarde fenêtres 2/5/6/7."
log "Log: $LOG"
