#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
SESSION="DA_REL"
API_URL_DEFAULT="https://api.delishafrica.me"
UIDN="$(id -u)"
SOCKDIR="/tmp/tmux-$UIDN"

log(){ printf "\n[%s] %s\n" "$(date +%H:%M:%S)" "$*"; }

# 0) tmux present
if ! command -v tmux >/dev/null 2>&1; then
  log "tmux absent -> installation"
  apt-get update -y
  apt-get install -y tmux
fi

# 1) fix socket dir
log "Fix socket dir: $SOCKDIR"
tmux kill-server 2>/dev/null || true
rm -rf "$SOCKDIR" 2>/dev/null || true
mkdir -p "$SOCKDIR"
chmod 700 "$SOCKDIR"

# 2) sanity repo
[ -d "$ROOT/apps" ] || { echo "ERROR: $ROOT/apps introuvable"; exit 1; }

# 3) create session + 10 windows
log "Create session: $SESSION"
tmux new-session -d -s "$SESSION" -n "0:shell" "bash -il || tail -f /dev/null"
tmux new-window  -t "$SESSION:1" -n "1:cmd"   "bash -il || tail -f /dev/null"

run_keep(){
  local idx="$1"; local name="$2"; local cmd="$3"
  tmux new-window -t "$SESSION:$idx" -n "$name" "bash -il -c '$cmd; echo; echo \"[done]\"; exec bash -il' || tail -f /dev/null"
}

# 2 API / 3 HEALTH / 4 PORTS
run_keep 2 "2:api"    "cd $ROOT && echo \"(API) Lance ton script API ici si besoin\""
run_keep 3 "3:health" "while true; do date; curl -fsS $API_URL_DEFAULT/api/health && echo \" OK\" || echo \" NOK\"; sleep 3; done"
run_keep 4 "4:ports"  "while true; do date; ss -lntp | egrep \"(:8081|:8082|:8083|:1900)\" || true; echo; sleep 2; done"

# 5/6/7 DEV CLIENT metros (force expo start)
run_keep 5 "5:client"  "cd $ROOT/apps/client   && export EXPO_USE_METRO_WORKSPACE_ROOT=1; export EXPO_PUBLIC_API_URL=\${EXPO_PUBLIC_API_URL:-$API_URL_DEFAULT}; npx expo start --dev-client --tunnel --port 8081 --clear || true"
run_keep 6 "6:merchant" "cd $ROOT/apps/merchant && export EXPO_USE_METRO_WORKSPACE_ROOT=1; export EXPO_PUBLIC_API_URL=\${EXPO_PUBLIC_API_URL:-$API_URL_DEFAULT}; npx expo start --dev-client --tunnel --port 8083 --clear || true"
run_keep 7 "7:courier"  "cd $ROOT/apps/courier  && export EXPO_USE_METRO_WORKSPACE_ROOT=1; export EXPO_PUBLIC_API_URL=\${EXPO_PUBLIC_API_URL:-$API_URL_DEFAULT}; npx expo start --dev-client --tunnel --port 8082 --clear || true"

# 8 PLATFORM placeholder
run_keep 8 "8:platform" "cd $ROOT && if [ -d $ROOT/apps/platform ]; then cd $ROOT/apps/platform && (pnpm dev || true); else echo \"(platform) absent\"; fi"

# 9 shell2 keepalive
tmux new-window -t "$SESSION:9" -n "9:shell2" "bash -il || tail -f /dev/null"

# hardening
tmux set-option -t "$SESSION" -g remain-on-exit on
tmux set-option -t "$SESSION" -g mouse on

log "DONE. Check:"
tmux ls || true
echo
echo "ATTACH:"
echo "tmux attach -t $SESSION"
