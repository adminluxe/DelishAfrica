#!/usr/bin/env bash
set -euo pipefail

# ========= CONFIG =========
MONOREPO_ROOT="/opt/delishafrica/monorepo"
SESSION="DA_DEV"

# Mets ici le chemin exact trouvé via `find ... | grep ops`
OPS_DIR="${OPS_DIR:-/opt/delishafrica/delishafrica-ops}"

# Ports à garder propres (Expo + extras)
PORTS_TO_FREE=(8081 8082 8083 8084 8085 8086 19000 19001 19002 3010 4001)

# ========= HELPERS =========
need() { command -v "$1" >/dev/null 2>&1 || { echo "❌ Missing: $1" >&2; exit 1; }; }

free_ports() {
  for p in "${PORTS_TO_FREE[@]}"; do
    # kill process listening on port
    if lsof -tiTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "→ Free port :$p"
      lsof -tiTCP:"$p" -sTCP:LISTEN | xargs -r kill -9 || true
    fi
  done
}

kill_expo_ngrok_node() {
  echo "→ Kill Expo/Metro/ngrok/cloudflared (safe kill)"
  pkill -f "expo start" >/dev/null 2>&1 || true
  pkill -f "metro" >/dev/null 2>&1 || true
  pkill -f "ngrok" >/dev/null 2>&1 || true
  pkill -f "cloudflared" >/dev/null 2>&1 || true
  pkill -f "node .*expo" >/dev/null 2>&1 || true
}

tmux_clean() {
  tmux has-session -t "$SESSION" >/dev/null 2>&1 && {
    echo "→ Kill existing tmux session: $SESSION"
    tmux kill-session -t "$SESSION"
  }
}

run_in_window() {
  local win="$1"; shift
  local cmd="$*"
  tmux send-keys -t "${SESSION}:${win}" "bash -lc '$cmd'" C-m
}

# ========= CHECKS =========
need tmux
need lsof

if [[ ! -d "$MONOREPO_ROOT" ]]; then
  echo "❌ Monorepo root introuvable: $MONOREPO_ROOT" >&2
  exit 1
fi

# ========= RESET SAFE =========
tmux_clean
kill_expo_ngrok_node
free_ports

# ========= TMUX LAYOUT (6 windows) =========
tmux new-session -d -s "$SESSION" -n "shell" -c "$MONOREPO_ROOT"

tmux new-window  -t "$SESSION" -n "api-logs"  -c "$MONOREPO_ROOT"
tmux new-window  -t "$SESSION" -n "client"    -c "$MONOREPO_ROOT"
tmux new-window  -t "$SESSION" -n "courier"   -c "$MONOREPO_ROOT"
tmux new-window  -t "$SESSION" -n "merchant"  -c "$MONOREPO_ROOT"
tmux new-window  -t "$SESSION" -n "platform"  -c "$OPS_DIR"

# ========= COMMANDS =========
# API logs (adapte si votre service/log tool diffère)
run_in_window "api-logs"  "cd '$MONOREPO_ROOT' && (docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' || true) && echo '---' && (docker logs -f --tail=200 delishafrica-api-1 2>/dev/null || docker compose logs -f --tail=200 api || true)"

# Apps (monorepo pnpm/turbo). On force un cmd stable depuis la racine.
run_in_window "client"   "cd '$MONOREPO_ROOT' && (pnpm --filter=apps/client dev || pnpm --filter=client dev)"
run_in_window "courier"  "cd '$MONOREPO_ROOT' && (pnpm --filter=apps/courier dev || pnpm --filter=courier dev)"
run_in_window "merchant" "cd '$MONOREPO_ROOT' && (pnpm --filter=apps/merchant dev || pnpm --filter=merchant dev)"

# Platform/ops : pnpm si possible, sinon npm
run_in_window "platform" "cd '$OPS_DIR' && ( (test -f pnpm-lock.yaml && pnpm dev) || (test -f package-lock.json && npm run dev) || (npm run dev) )"

tmux select-window -t "$SESSION:shell"
tmux attach -t "$SESSION"
