#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
SESSION="DA_REL"
PATH_FIXED="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
NOW="$(date +%Y%m%d_%H%M%S)"
BKP="$ROOT/.tonton_backups/fix_enotempty_$NOW"
LOG="$BKP/run.log"
mkdir -p "$BKP"

log(){ echo -e "\n[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }
die(){ echo -e "\n[ERROR] $*" | tee -a "$LOG" >&2; exit 1; }

command -v tmux >/dev/null 2>&1 || die "tmux introuvable"
tmux has-session -t "$SESSION" >/dev/null 2>&1 || die "Session tmux '$SESSION' introuvable"
cd "$ROOT" || die "ROOT introuvable: $ROOT"

export PATH="$PATH_FIXED"
hash -r || true

log "1) Fix PATH global tmux + stop commandes en cours (Ctrl+C)"
tmux set-environment -t "$SESSION" -g PATH "$PATH_FIXED"
for w in 2 5 6 7; do
  tmux send-keys -t "$SESSION:$w" C-c
done

log "2) Kill processes pnpm/expo éventuels (pour éviter la concurrence)"
pkill -f "pnpm" >/dev/null 2>&1 || true
pkill -f "expo start" >/dev/null 2>&1 || true
pkill -f "metro" >/dev/null 2>&1 || true

log "3) Sanity pnpm"
command -v pnpm >/dev/null 2>&1 || die "pnpm introuvable"
pnpm -v | tee -a "$LOG"

log "4) Backup minimal"
[[ -f "$ROOT/pnpm-lock.yaml" ]] && cp -a "$ROOT/pnpm-lock.yaml" "$BKP/" || true
[[ -f "$ROOT/package.json" ]] && cp -a "$ROOT/package.json" "$BKP/" || true

clean_stage1(){
  log "5A) Clean stage 1: wipe node_modules/.pnpm (source ENOTEMPTY)"
  rm -rf "$ROOT/node_modules/.pnpm" "$ROOT/node_modules/.modules.yaml" 2>/dev/null || true
}

clean_stage2(){
  log "5B) Clean stage 2 (fallback): wipe node_modules COMPLET"
  rm -rf "$ROOT/node_modules" 2>/dev/null || true
  # wipe app/service node_modules au cas où
  find "$ROOT/apps" -maxdepth 2 -type d -name node_modules -prune -exec rm -rf {} + 2>/dev/null || true
  find "$ROOT/services" -maxdepth 2 -type d -name node_modules -prune -exec rm -rf {} + 2>/dev/null || true
}

install_root(){
  log "6) pnpm -w install --force (UNIQUE install, solo)"
  pnpm -w install --force
}

clean_stage1
if ! install_root; then
  log "⚠️ Install a échoué après stage1 -> stage2 + retry"
  clean_stage2
  install_root
fi

log "7) Fix API-nest reflect-metadata (si absent)"
API_PKG="$ROOT/services/api-nest/package.json"
if [[ -f "$API_PKG" ]]; then
  if ! grep -q '"reflect-metadata"' "$API_PKG"; then
    log "Ajout reflect-metadata dans services/api-nest"
    pnpm -C "$ROOT/services/api-nest" add reflect-metadata
  else
    log "reflect-metadata déjà présent dans services/api-nest"
  fi
else
  log "⚠️ services/api-nest/package.json introuvable -> skip"
fi

log "8) Relance panes (API + 3 metros) via pnpm exec expo (PAS npm)"
# API: on tente PORT=4001 pour éviter conflit avec docker:3010
tmux send-keys -t "$SESSION:2" "cd '$ROOT/services/api-nest' && export PATH='$PATH_FIXED' && export PORT=4001 && pnpm -v && (pnpm run start:dev || pnpm run start || node dist/main.js) ; exec bash" C-m

# Client 8081
tmux send-keys -t "$SESSION:5" "cd '$ROOT/apps/client' && export PATH='$PATH_FIXED' && pnpm -v && pnpm exec expo start --dev-client --tunnel --port 8081 --clear ; exec bash" C-m
# Merchant 8083
tmux send-keys -t "$SESSION:6" "cd '$ROOT/apps/merchant' && export PATH='$PATH_FIXED' && pnpm -v && pnpm exec expo start --dev-client --tunnel --port 8083 --clear ; exec bash" C-m
# Courier 8082
tmux send-keys -t "$SESSION:7" "cd '$ROOT/apps/courier' && export PATH='$PATH_FIXED' && pnpm -v && pnpm exec expo start --dev-client --tunnel --port 8082 --clear ; exec bash" C-m

log "✅ Terminé. Va voir les fenêtres 2/5/6/7."
log "Log: $LOG"
