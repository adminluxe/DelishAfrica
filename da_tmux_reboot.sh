#!/usr/bin/env bash
set -euo pipefail

SESSION="DA_REL"
ROOT="/opt/delishafrica/monorepo"

echo "== DA tmux reboot =="
echo "ROOT=$ROOT"
echo "SESSION=$SESSION"
echo

# --- Helpers ---
have() { command -v "$1" >/dev/null 2>&1; }

kill_port() {
  local p="$1"
  local pids=""
  if have lsof; then
    pids="$(lsof -tiTCP:"$p" -sTCP:LISTEN 2>/dev/null || true)"
  elif have fuser; then
    pids="$(fuser -n tcp "$p" 2>/dev/null || true)"
  else
    # fallback ss parsing (best effort)
    pids="$(ss -lntp 2>/dev/null | awk -v P=":$p" '$0~P {gsub(/users:\(\("([^"]+)".*/, "", $NF); gsub(/pid=|,.*$/, "", $NF); print $NF}' | tr -d '")' | sort -u || true)"
  fi

  if [ -n "${pids// }" ]; then
    echo "🧨 Killing port $p listeners: $pids"
    kill -9 $pids 2>/dev/null || true
  else
    echo "✅ Port $p already free"
  fi
}

# --- 1) Stop existing tmux (session only, then server if needed) ---
if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "🧹 Killing tmux session $SESSION"
  tmux kill-session -t "$SESSION" || true
fi

# If tmux is bugging, nuke server sockets cleanly
echo "🧹 Killing tmux server (safety)"
tmux kill-server 2>/dev/null || true
rm -rf /tmp/tmux-* 2>/dev/null || true

# --- 2) Kill dev servers that often survive (metro/expo) ---
echo "🧹 Killing expo/metro node processes (host only)"
pkill -f "expo.*start|expo start|metro|react-native|@expo/cli" 2>/dev/null || true
pkill -f "pnpm dev.*apps/(client|merchant|courier)" 2>/dev/null || true

# --- 3) Free the known ports (metro + expo) ---
echo "🧹 Free ports"
for p in 8081 8082 8083 19000 19001 19002 19006 19007 19008; do
  kill_port "$p"
done

# --- 4) Light cache cleanup (safe) ---
echo "🧹 Clear temp metro caches"
rm -rf /tmp/metro-* /tmp/haste-map-* /tmp/react-* 2>/dev/null || true

# --- 5) Ensure API stack up (docker) ---
if [ -f "$ROOT/docker-compose.yml" ]; then
  echo "🐳 docker compose up -d (monorepo)"
  (cd "$ROOT" && docker compose up -d) || true
fi

# --- 6) Recreate tmux session with 10 windows (all shells persistent) ---
echo "🧱 Creating tmux session $SESSION with 10 windows"
tmux new-session -d -s "$SESSION" -n "shell" "bash"

# tmux hardening
tmux set-option -t "$SESSION" -g mouse on
tmux set-option -t "$SESSION" -g remain-on-exit on
tmux set-option -t "$SESSION" -g history-limit 200000
tmux set-option -t "$SESSION" -g renumber-windows on

# Window 1: CMD (shell vide)
tmux new-window -t "$SESSION:1" -n "cmd" "bash"

# Window 2: API logs
tmux new-window -t "$SESSION:2" -n "api" "bash"
tmux send-keys -t "$SESSION:2" "cd '$ROOT' && docker compose ps && echo && docker logs -f delish-api" C-m

# Window 3: HEALTH (loop)
tmux new-window -t "$SESSION:3" -n "health" "bash"
tmux send-keys -t "$SESSION:3" "while true; do date; curl -fsS http://127.0.0.1:3010/api/v1/health && echo ' ✅'; echo; sleep 2; done" C-m

# Window 4: PORTS (loop)
tmux new-window -t "$SESSION:4" -n "ports" "bash"
tmux send-keys -t "$SESSION:4" "while true; do clear; date; echo; ss -lntp 2>/dev/null | egrep ':(3010|8081|8082|8083)\\b' || true; sleep 1; done" C-m

# Node memory guard (helps avoid exit 137/OOM)
NODE_MEM="export NODE_OPTIONS=--max_old_space_size=4096;"

# Window 5: CLIENT
tmux new-window -t "$SESSION:5" -n "client" "bash"
tmux send-keys -t "$SESSION:5" "cd '$ROOT/apps/client' && $NODE_MEM pnpm dev -- --tunnel --clear --port 8081" C-m

# Window 6: MERCHANT
tmux new-window -t "$SESSION:6" -n "merchant" "bash"
tmux send-keys -t "$SESSION:6" "sleep 2; cd '$ROOT/apps/merchant' && $NODE_MEM pnpm dev -- --tunnel --clear --port 8083" C-m

# Window 7: COURIER
tmux new-window -t "$SESSION:7" -n "courier" "bash"
tmux send-keys -t "$SESSION:7" "sleep 4; cd '$ROOT/apps/courier' && $NODE_MEM pnpm dev -- --tunnel --clear --port 8082" C-m

# Window 8: PLATFORM (shell)
tmux new-window -t "$SESSION:8" -n "platform" "bash"
tmux send-keys -t "$SESSION:8" "cd '$ROOT' && ls -la" C-m

# Window 9: SHELL2 (shell vide)
tmux new-window -t "$SESSION:9" -n "shell2" "bash"

# Focus window 1 (cmd)
tmux select-window -t "$SESSION:1"
echo "✅ tmux ready. Attaching…"
tmux attach -t "$SESSION"
