#!/usr/bin/env bash
set -euo pipefail

SESSION="delish-demo"

echo "🧹 Stopping Delish demo…"

# Kill tmux session if exists
if tmux has-session -t "$SESSION" 2>/dev/null; then
  tmux kill-session -t "$SESSION"
  echo "✅ tmux session killed: $SESSION"
else
  echo "ℹ️ tmux session not running: $SESSION"
fi

# Kill listeners on ports (Metro + ngrok web UI)
ports=(8081 8082 8083 4001 4049 4040 4041)
for p in "${ports[@]}"; do
  sudo fuser -k "${p}/tcp" 2>/dev/null || true
done

# Kill common processes (failsafe)
pkill -f "expo start" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true
pkill -f "ngrok" 2>/dev/null || true
pkill -f "nest" 2>/dev/null || true
pkill -f "node.*dist/main" 2>/dev/null || true

echo "✅ Done."
