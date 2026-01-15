#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
cd "$ROOT"

# ---- Detect app folders ----
APP_CLIENT="apps/client"

if [[ -d "apps/courier" ]]; then APP_COURIER="apps/courier"
elif [[ -d "apps/coursier" ]]; then APP_COURIER="apps/coursier"
else echo "❌ courier folder not found"; exit 1; fi

if [[ -d "apps/merchant" ]]; then APP_MERCHANT="apps/merchant"
elif [[ -d "apps/marchand" ]]; then APP_MERCHANT="apps/marchand"
else echo "❌ merchant folder not found"; exit 1; fi

# ---- 1) Free ports / stop expo-metro (uses your existing script) ----
if [[ -x "$ROOT/scripts/da_fix_ports_expo.sh" ]]; then
  "$ROOT/scripts/da_fix_ports_expo.sh"
else
  echo "❌ Missing: $ROOT/scripts/da_fix_ports_expo.sh"
  echo "   (recreate it from previous message, then rerun)"
  exit 1
fi

# ---- 2) tmux clean session ----
SESSION="DA_DEV"
tmux kill-session -t "$SESSION" 2>/dev/null || true

tmux new-session -d -s "$SESSION" -n "shell"
tmux set-option -t "$SESSION" -g mouse on
tmux set-option -t "$SESSION" -g history-limit 50000
tmux setw -t "$SESSION" aggressive-resize on
tmux setw -t "$SESSION" window-size largest

# windows: client / courier / merchant
tmux new-window -t "$SESSION" -n "client"
tmux new-window -t "$SESSION" -n "courier"
tmux new-window -t "$SESSION" -n "merchant"
tmux new-window -t "$SESSION" -n "api"

# ---- 3) Start apps (ports are already in your app dev scripts) ----
tmux send-keys -t "$SESSION:client"  "cd $ROOT && pnpm --filter=$APP_CLIENT dev" C-m
tmux send-keys -t "$SESSION:courier" "cd $ROOT && pnpm --filter=$APP_COURIER dev" C-m
tmux send-keys -t "$SESSION:merchant""cd $ROOT && pnpm --filter=$APP_MERCHANT dev" C-m

# ---- 4) API health watcher (optional) ----
tmux send-keys -t "$SESSION:api" "watch -n 2 'curl -sk https://api.delishafrica.me/api/health || true'" C-m

echo "✅ tmux session ready: $SESSION"
echo "➡️ Attach: tmux a -t $SESSION"
