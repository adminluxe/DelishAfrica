#!/usr/bin/env bash
set -euo pipefail

SESSION="DA_REL"
ROOT="/opt/delishafrica/monorepo"

CLIENT_PORT=8081
COURIER_PORT=8082
MERCHANT_PORT=8083

need(){ command -v "$1" >/dev/null 2>&1 || { echo "❌ missing: $1"; exit 1; }; }
need tmux
need ss
need curl

# 0) Hard reset
tmux kill-server 2>/dev/null || true
pkill -f "expo start" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true

# libère les ports (best effort)
for p in 3010 "$CLIENT_PORT" "$COURIER_PORT" "$MERCHANT_PORT"; do
  fuser -k "${p}/tcp" 2>/dev/null || true
done

# 1) tmux config stable
cat > /root/.tmux.conf <<'CONF'
set -g mouse on
set -g history-limit 200000
set -g remain-on-exit on
setw -g aggressive-resize on
set -g allow-rename off
set -g set-titles on
set -g set-titles-string "#S:#I #W"
CONF

# 2) Session + 10 windows
tmux new-session -d -s "$SESSION" -n "shell"  "bash -l"
tmux new-window  -t "$SESSION:1" -n "cmd"     "bash -l"
tmux new-window  -t "$SESSION:2" -n "api"     "bash -l"
tmux new-window  -t "$SESSION:3" -n "health"  "bash -l"
tmux new-window  -t "$SESSION:4" -n "ports"   "bash -l"
tmux new-window  -t "$SESSION:5" -n "client"  "bash -l"
tmux new-window  -t "$SESSION:6" -n "merchant""bash -l"
tmux new-window  -t "$SESSION:7" -n "courier" "bash -l"
tmux new-window  -t "$SESSION:8" -n "platform""bash -l"
tmux new-window  -t "$SESSION:9" -n "shell2"  "bash -l"

send(){ tmux send-keys -t "$1" "$2" C-m; }

# API (docker)
send "$SESSION:2" "cd $ROOT && docker compose up -d || true"
send "$SESSION:2" "cd $ROOT && docker compose ps || true"
send "$SESSION:2" "cd $ROOT && (docker compose logs -f --tail=200 delish-api 2>/dev/null || docker compose logs -f --tail=200 api) || true"

# Health loop
send "$SESSION:3" "while true; do date; curl -fsS http://127.0.0.1:3010/api/v1/health && echo ' OK' || echo ' KO'; sleep 2; done"

# Ports watch
send "$SESSION:4" "watch -n 1 'ss -lptn | egrep \":(3010|$CLIENT_PORT|$COURIER_PORT|$MERCHANT_PORT)\\b\" || true'"

# Expo (anti-EIO + QR OK)
# IMPORTANT: pas de CI=1 (sinon reloads désactivés)
send "$SESSION:5" "cd $ROOT/apps/client   && export EXPO_NO_INTERACTIVE=1 NODE_OPTIONS=--max_old_space_size=4096 && pnpm dev -- --tunnel --clear --port $CLIENT_PORT"
send "$SESSION:6" "cd $ROOT/apps/merchant && export EXPO_NO_INTERACTIVE=1 NODE_OPTIONS=--max_old_space_size=4096 && pnpm dev -- --tunnel --clear --port $MERCHANT_PORT"
send "$SESSION:7" "cd $ROOT/apps/courier  && export EXPO_NO_INTERACTIVE=1 NODE_OPTIONS=--max_old_space_size=4096 && pnpm dev -- --tunnel --clear --port $COURIER_PORT"

# Platform placeholder
send "$SESSION:8" "cd $ROOT && ls -la"

tmux select-window -t "$SESSION:5"

# 3) attach / switch
if [ -n "${TMUX:-}" ]; then
  tmux switch-client -t "$SESSION"
else
  tmux attach -t "$SESSION"
fi
