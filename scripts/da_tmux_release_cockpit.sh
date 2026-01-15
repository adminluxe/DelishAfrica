#!/usr/bin/env bash
set -euo pipefail

SESSION="${SESSION:-DA_REL}"
ROOT="${ROOT:-/opt/delishafrica/monorepo}"

CLIENT_DIR="${CLIENT_DIR:-$ROOT/apps/client}"
MERCHANT_DIR="${MERCHANT_DIR:-$ROOT/apps/merchant}"
COURIER_DIR="${COURIER_DIR:-$ROOT/apps/courier}"
PLATFORM_DIR="${PLATFORM_DIR:-/opt/delishafrica/delishafrica-ops}"

# Toggles (0/1)
AUTORUN_DEV="${AUTORUN_DEV:-0}"           # expo start
AUTORUN_API_LOGS="${AUTORUN_API_LOGS:-1}"
AUTORUN_HEALTH_WATCH="${AUTORUN_HEALTH_WATCH:-1}"
AUTORUN_PORTS="${AUTORUN_PORTS:-1}"
AUTORUN_PLATFORM="${AUTORUN_PLATFORM:-0}"
AUTORUN_BUILDS="${AUTORUN_BUILDS:-0}"     # eas build (je te conseille 0 par défaut)

need_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "Missing: $1"; exit 1; }; }
need_cmd tmux

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "Session exists: $SESSION -> attach"
  exec tmux attach -t "$SESSION"
fi

tmux new-session -d -s "$SESSION" -n "0" "bash"

# ---- Global tmux UX ----
tmux set-option -t "$SESSION" -g base-index 0
tmux set-option -t "$SESSION" -g renumber-windows off
tmux set-option -t "$SESSION" -g mouse on
tmux set-option -t "$SESSION" -g history-limit 200000
tmux set-option -t "$SESSION" -g remain-on-exit on
tmux set-option -t "$SESSION" -g detach-on-destroy off
tmux set-option -t "$SESSION" -g set-titles on
tmux set-option -t "$SESSION" -g status-interval 1
tmux set-option -t "$SESSION" -g pane-border-status top
tmux set-option -t "$SESSION" -g pane-border-format " #(date +'%H:%M:%S') | #{window_index}:#{window_name} | #{pane_title} "

tmux set-option -t "$SESSION" -g status-left  "#[bold] DA #[default]#{session_name} | "
tmux set-option -t "$SESSION" -g status-right " #(date +'%Y-%m-%d %H:%M:%S') "

set_role_prompt() {
  local target="$1"
  local title="$2"
  local role="${3:-SHELL}"   # <- SAFE: évite le crash si arg manquant

  tmux rename-window -t "$target" "$title" >/dev/null 2>&1 || true
  tmux select-pane -t "$target" -T "$title" >/dev/null 2>&1 || true
  tmux send-keys -t "$target" "export DA_ROLE='$role'; cd '$ROOT'; clear" C-m
}

# ---- Windows layout (0..9) : comme tu veux pour la course finale ----
# 0) on garde (shell)
# 1) shell vide (cmd)
# 2) API
# 3) HEALTH
# 4) PORTS
# 5) CLIENT
# 6) MERCHANT
# 7) COURIER
# 8) PLATFORM
# 9) NOTES (nouveau shell)
tmux new-window -t "$SESSION":1 -n "1" "bash"
tmux new-window -t "$SESSION":2 -n "2" "bash"
tmux new-window -t "$SESSION":3 -n "3" "bash"
tmux new-window -t "$SESSION":4 -n "4" "bash"
tmux new-window -t "$SESSION":5 -n "5" "bash"
tmux new-window -t "$SESSION":6 -n "6" "bash"
tmux new-window -t "$SESSION":7 -n "7" "bash"
tmux new-window -t "$SESSION":8 -n "8" "bash"
tmux new-window -t "$SESSION":9 -n "9" "bash"

set_role_prompt "$SESSION:0"  "shell"     "SHELL"
set_role_prompt "$SESSION:1"  "cmd"       "SHELL"
set_role_prompt "$SESSION:2"  "api"       "API"
set_role_prompt "$SESSION:3"  "health"    "HEALTH"
set_role_prompt "$SESSION:4"  "ports"     "PORTS"
set_role_prompt "$SESSION:5"  "client"    "CLIENT"
set_role_prompt "$SESSION:6"  "merchant"  "MERCHANT"
set_role_prompt "$SESSION:7"  "courier"   "COURIER"
set_role_prompt "$SESSION:8"  "platform"  "PLATFORM"
set_role_prompt "$SESSION:9"  "notes"     "SHELL"

# ---- Autorun commands ----
if [ "$AUTORUN_API_LOGS" = "1" ]; then
  tmux send-keys -t "$SESSION:2" "docker logs -f delish-api 2>/dev/null || docker compose -f '$ROOT/docker-compose.yml' logs -f api" C-m
fi

if [ "$AUTORUN_HEALTH_WATCH" = "1" ]; then
  tmux send-keys -t "$SESSION:3" "watch -n 2 'echo --- API(3010) ---; curl -sS http://127.0.0.1:3010/api/v1/health || true; echo; echo --- NGINX(18080) ---; curl -sS http://127.0.0.1:18080/health || true; echo'" C-m
fi

if [ "$AUTORUN_PORTS" = "1" ]; then
  tmux send-keys -t "$SESSION:4" "watch -n 2 'ss -lntp | egrep \"(:3010|:18080|:18081|:8080|:8081|:8082|:8083|:19000|:19001|:19002)\" || true'" C-m
fi

if [ "$AUTORUN_DEV" = "1" ]; then
  tmux send-keys -t "$SESSION:5" "cd '$CLIENT_DIR' && pnpm exec expo start --tunnel -c" C-m
  tmux send-keys -t "$SESSION:7" "cd '$COURIER_DIR' && pnpm exec expo start --tunnel -c" C-m
  tmux send-keys -t "$SESSION:6" "cd '$MERCHANT_DIR' && pnpm exec expo start --tunnel -c" C-m
fi

if [ "$AUTORUN_PLATFORM" = "1" ]; then
  tmux send-keys -t "$SESSION:8" "cd '$PLATFORM_DIR' || cd '$ROOT'" C-m
fi

if [ "$AUTORUN_BUILDS" = "1" ]; then
  tmux send-keys -t "$SESSION:5" "cd '$CLIENT_DIR' && eas build -p android --profile production" C-m
  tmux send-keys -t "$SESSION:7" "cd '$COURIER_DIR' && eas build -p android --profile production" C-m
  tmux send-keys -t "$SESSION:6" "cd '$MERCHANT_DIR' && eas build -p android --profile production" C-m
fi

tmux select-window -t "$SESSION:1"
exec tmux attach -t "$SESSION"
