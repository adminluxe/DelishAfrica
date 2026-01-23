#!/usr/bin/env bash
set -u  # PAS de -e ici: on veut survivre à une commande qui échoue
ROOT="/opt/delishafrica/monorepo"
SESSION="DA_REL"
TMP_SESSION="DA_REL_BOOT_$(date +%H%M%S)"
API_URL_DEFAULT="https://api.delishafrica.me"

log(){ printf "\n[%s] %s\n" "$(date +%H:%M:%S)" "$*"; }

if ! command -v tmux >/dev/null 2>&1; then
  log "tmux absent -> installation"
  apt-get update -y && apt-get install -y tmux
fi

if [ ! -d "$ROOT/apps" ]; then
  echo "ERROR: repo introuvable: $ROOT/apps" >&2
  exit 1
fi

# 1) crée une nouvelle session SAFE d'abord
log "Creation session temporaire: $TMP_SESSION"
tmux new-session -d -s "$TMP_SESSION" -n "0:shell" "bash -l"
tmux new-window  -t "$TMP_SESSION:1" -n "1:cmd" "bash -l"

run_keep(){
  local win="$1"; local name="$2"; local cmd="$3"
  tmux new-window -t "$win" -n "$name" "bash -lc '$cmd; echo; echo \"[done]\"; exec bash -l'"
}

# 2:api / 3:health / 4:ports
run_keep "$TMP_SESSION:2" "2:api"    "cd $ROOT && echo \"(API) lance ton script API ici si besoin\""
run_keep "$TMP_SESSION:3" "3:health" "while true; do date; curl -fsS $API_URL_DEFAULT/api/health && echo \" OK\" || echo \" NOK\"; sleep 3; done"
run_keep "$TMP_SESSION:4" "4:ports"  "while true; do date; ss -lntp | egrep \"(:8081|:8082|:8083|:1900)\" || true; echo; sleep 2; done"

# 5/6/7 metros DEV CLIENT (direct expo start)
# Note: même si expo start échoue, la fenêtre reste vivante.
run_keep "$TMP_SESSION:5" "5:client"  "cd $ROOT/apps/client   && export EXPO_USE_METRO_WORKSPACE_ROOT=1; export EXPO_PUBLIC_API_URL=\${EXPO_PUBLIC_API_URL:-$API_URL_DEFAULT}; npx expo start --dev-client --tunnel --port 8081 --clear || true"
run_keep "$TMP_SESSION:6" "6:merchant" "cd $ROOT/apps/merchant && export EXPO_USE_METRO_WORKSPACE_ROOT=1; export EXPO_PUBLIC_API_URL=\${EXPO_PUBLIC_API_URL:-$API_URL_DEFAULT}; npx expo start --dev-client --tunnel --port 8083 --clear || true"
run_keep "$TMP_SESSION:7" "7:courier"  "cd $ROOT/apps/courier  && export EXPO_USE_METRO_WORKSPACE_ROOT=1; export EXPO_PUBLIC_API_URL=\${EXPO_PUBLIC_API_URL:-$API_URL_DEFAULT}; npx expo start --dev-client --tunnel --port 8082 --clear || true"

# 8:platform placeholder
run_keep "$TMP_SESSION:8" "8:platform" "cd $ROOT && if [ -d $ROOT/apps/platform ]; then cd $ROOT/apps/platform && (pnpm dev || true); else echo \"(platform) absent\"; fi"

# 9:shell2
tmux new-window -t "$TMP_SESSION:9" -n "9:shell2" "bash -l"

# hardening
tmux set-option -t "$TMP_SESSION" -g remain-on-exit on
tmux set-option -t "$TMP_SESSION" -g mouse on

# 2) une fois la session créée, on remplace l’ancienne (si elle existe)
if tmux has-session -t "$SESSION" 2>/dev/null; then
  log "Suppression ancienne session: $SESSION"
  tmux kill-session -t "$SESSION" 2>/dev/null || true
fi

log "Renommage $TMP_SESSION -> $SESSION"
tmux rename-session -t "$TMP_SESSION" "$SESSION"

log "OK. Attache:"
echo "tmux attach -t $SESSION"
