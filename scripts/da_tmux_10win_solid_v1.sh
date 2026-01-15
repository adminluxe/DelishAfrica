#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
SESSION="DA10"

tmux has-session -t "$SESSION" 2>/dev/null && tmux kill-session -t "$SESSION" || true

# Session + fenêtre 0
tmux new-session -d -s "$SESSION" -n "0-KEEP" "bash -i"
tmux set-option -t "$SESSION" -g remain-on-exit on
tmux set-option -t "$SESSION" -g detach-on-destroy off

mkwin () {
  local idx="$1"; local name="$2"
  tmux new-window -t "${SESSION}:${idx}" -n "$name" "bash -i"
}

# 10 fenêtres
mkwin 1 "SHELL"
mkwin 2 "API"
mkwin 3 "HEALTH"
mkwin 4 "PORTS"
mkwin 5 "CLIENT"
mkwin 6 "MERCHANT"
mkwin 7 "COURIER"
mkwin 8 "PLATFORM"
mkwin 9 "SHELL-2"

# Injecte les commandes (send-keys)
tmux send-keys -t "${SESSION}:1" "cd $ROOT; clear; echo SHELL READY" C-m
tmux send-keys -t "${SESSION}:2" "cd $ROOT; echo 'API window (mets docker compose logs si besoin)'" C-m
tmux send-keys -t "${SESSION}:3" "while true; do date; curl -fsS https://api.delishafrica.me/api/health || true; echo; sleep 3; done" C-m
tmux send-keys -t "${SESSION}:4" "while true; do date; lsof -iTCP -sTCP:LISTEN | egrep ':(8081|8082|8083|3010|4010)\\b' || true; echo; sleep 3; done" C-m

tmux send-keys -t "${SESSION}:5" "cd $ROOT/apps/client && pnpm dev -- --tunnel --port 8081 --clear" C-m
tmux send-keys -t "${SESSION}:6" "cd $ROOT/apps/merchant && pnpm dev -- --tunnel --port 8083 --clear" C-m
tmux send-keys -t "${SESSION}:7" "cd $ROOT/apps/courier && pnpm dev -- --tunnel --port 8082 --clear" C-m

tmux send-keys -t "${SESSION}:8" "cd $ROOT; clear; echo PLATFORM READY" C-m
tmux send-keys -t "${SESSION}:9" "cd $ROOT; clear; echo SHELL-2 READY" C-m

tmux select-window -t "${SESSION}:1"

echo "✅ TMUX prêt: tmux attach -t $SESSION"
