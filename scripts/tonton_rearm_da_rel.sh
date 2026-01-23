#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
SESSION="DA_REL"
PATH_FIXED="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

die(){ echo "[ERROR] $*" >&2; exit 1; }
log(){ echo -e "\n[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

command -v tmux >/dev/null 2>&1 || die "tmux introuvable"
tmux has-session -t "$SESSION" >/dev/null 2>&1 || die "Session tmux '$SESSION' introuvable"

log "1) Fix PATH global pour la session tmux ($SESSION)"
tmux set-environment -t "$SESSION" -g PATH "$PATH_FIXED"

log "2) Re-install workspace (root) via pnpm"
tmux send-keys -t "$SESSION:1" C-c
tmux send-keys -t "$SESSION:1" "cd '$ROOT' && export PATH='$PATH_FIXED' && pnpm -v && pnpm -w install" C-m

log "3) Fix API: reflect-metadata + install + start"
tmux send-keys -t "$SESSION:2" C-c
tmux send-keys -t "$SESSION:2" "cd '$ROOT/services/api-nest' && export PATH='$PATH_FIXED' && pnpm -v && (grep -q '\"reflect-metadata\"' package.json || pnpm add reflect-metadata) && pnpm install && (pnpm run start:dev || pnpm run dev || pnpm run start || node dist/main.js) ; exec bash" C-m

log "4) Fix HEALTH watcher (sleep via /bin/sleep + PATH fixe)"
tmux send-keys -t "$SESSION:3" C-c
tmux send-keys -t "$SESSION:3" "cd '$ROOT' && export PATH='$PATH_FIXED' && clear && echo '[3] HEALTH watcher (fixed)' && bash -lc 'export PATH=\"$PATH_FIXED\"; while true; do for PORT in 3010 4001; do for PATHX in /api/v1/health /api/health /health; do URL=\"http://127.0.0.1:\$PORT\$PATHX\"; if curl -fsS \"\$URL\" >/dev/null 2>&1; then echo \"✅ \$URL\"; else echo \"❌ \$URL\"; fi; done; done; echo \"----\"; /bin/sleep 2; done' ; exec bash" C-m

log "5) Relance metros via pnpm exec expo (pas npm)"
# Client 8081
tmux send-keys -t "$SESSION:5" C-c
tmux send-keys -t "$SESSION:5" "cd '$ROOT/apps/client' && export PATH='$PATH_FIXED' && pnpm -v && pnpm install && pnpm exec expo start --dev-client --tunnel --port 8081 --clear ; exec bash" C-m

# Merchant 8083
tmux send-keys -t "$SESSION:6" C-c
tmux send-keys -t "$SESSION:6" "cd '$ROOT/apps/merchant' && export PATH='$PATH_FIXED' && pnpm -v && pnpm install && pnpm exec expo start --dev-client --tunnel --port 8083 --clear ; exec bash" C-m

# Courier 8082
tmux send-keys -t "$SESSION:7" C-c
tmux send-keys -t "$SESSION:7" "cd '$ROOT/apps/courier' && export PATH='$PATH_FIXED' && pnpm -v && pnpm install && pnpm exec expo start --dev-client --tunnel --port 8082 --clear ; exec bash" C-m

log "✅ Réarmement envoyé dans les fenêtres tmux."
log "Regarde: [2] API, [3] HEALTH, [5/6/7] metros."
