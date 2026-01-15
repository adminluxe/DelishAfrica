#!/usr/bin/env bash
set -euo pipefail

# =========================
# DelishAfrica — TMUX DEV 10 windows (solid)
# =========================

SESSION="${SESSION:-DA_DEV}"
ROOT="${ROOT:-/opt/delishafrica/monorepo}"

# ---- Autorun toggles (0/1) ----
AUTORUN_API_LOGS="${AUTORUN_API_LOGS:-1}"
AUTORUN_HEALTH_WATCH="${AUTORUN_HEALTH_WATCH:-1}"
AUTORUN_PORTS_WATCH="${AUTORUN_PORTS_WATCH:-1}"

AUTORUN_CLIENT="${AUTORUN_CLIENT:-0}"     # set 1 to auto run expo
AUTORUN_MERCHANT="${AUTORUN_MERCHANT:-0}" # set 1 to auto run expo
AUTORUN_COURIER="${AUTORUN_COURIER:-0}"   # set 1 to auto run expo
AUTORUN_PLATFORM="${AUTORUN_PLATFORM:-0}" # set 1 to auto run platform cmd

# ---- API / compose ----
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT/docker-compose.yml}"
API_SERVICE="${API_SERVICE:-api}"
API_LOCAL_BASE="${API_LOCAL_BASE:-http://127.0.0.1:3010}"
API_HEALTH_PATH="${API_HEALTH_PATH:-/api/v1/health}"

# ---- Expo ports ----
CLIENT_PORT="${CLIENT_PORT:-8081}"
COURIER_PORT="${COURIER_PORT:-8082}"
MERCHANT_PORT="${MERCHANT_PORT:-8083}"

# ---- Directories ----
CLIENT_DIR="${CLIENT_DIR:-$ROOT/apps/client}"
COURIER_DIR="${COURIER_DIR:-$ROOT/apps/courier}"
MERCHANT_DIR="${MERCHANT_DIR:-$ROOT/apps/merchant}"
PLATFORM_DIR="${PLATFORM_DIR:-/opt/delishafrica/delishafrica-ops3}"  # adjust if needed

command -v tmux >/dev/null 2>&1 || { echo "ERROR: tmux not installed"; exit 1; }

# If session exists, attach
if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "Session '$SESSION' already exists. Attaching..."
  exec tmux attach -t "$SESSION"
fi

# -------------------------
# Helpers
# -------------------------
tmux_opt() { tmux set-option -t "$SESSION" -g "$1" "$2"; }

# Fancy, very readable prompt (separator between output and prompt)
# - Shows: session | title | time | cwd
PROMPT_EXPORT='
export PROMPT_COMMAND='"'"'__da_title(){ printf "\033]0;%s | %s\007" "${DA_SESSION:-DA}" "${DA_PANE_TITLE:-SHELL}"; }; __da_title'"'"';
export PS1=$'"'"'\n\[\e[38;5;39m\]┌─[\[\e[38;5;45m\]${DA_SESSION:-DA}\[\e[0m\]\[\e[38;5;39m\]|\[\e[38;5;220m\]${DA_PANE_TITLE:-SHELL}\[\e[0m\]\[\e[38;5;39m\]]─[\[\e[38;5;244m\]\t\[\e[0m\]]─[\[\e[38;5;75m\]\w\[\e[0m\]]\n\[\e[38;5;39m\]└─\[\e[38;5;214m\]$ \[\e[0m\]'"'"'
'

send_setup() {
  # $1 target, $2 title, $3 initial_cmd
  local target="$1" title="$2" initial_cmd="${3:-}"
  tmux send-keys -t "$target" "export DA_SESSION='$SESSION'; export DA_PANE_TITLE='$title'; ${PROMPT_EXPORT}" C-m
  # Keep shell alive even if command exits
  if [[ -n "$initial_cmd" ]]; then
    tmux send-keys -t "$target" "bash -lc '$initial_cmd; echo; echo \"[${title}] command ended — shell kept alive.\"; exec bash -i'" C-m
  fi
}

# -------------------------
# Create session + global hardening
# -------------------------
tmux new-session -d -s "$SESSION" -n "ROOT" "bash -i"
tmux_opt base-index 0
tmux_opt renumber-windows off
tmux_opt detach-on-destroy off
tmux_opt set-titles on
tmux_opt history-limit 200000
tmux_opt mouse on
tmux_opt remain-on-exit on
tmux_opt status-interval 1
tmux_opt monitor-activity on
tmux_opt visual-activity on

# Pane borders with titles
tmux_opt pane-border-status top
tmux_opt pane-border-format " #{pane_index}:#T "
tmux_opt allow-rename off

# Status bar (time + session)
tmux_opt status on
tmux_opt status-style "fg=colour231,bg=colour236"
tmux_opt status-left-length 60
tmux_opt status-right-length 120
tmux_opt status-left " #[bold]DelishAfrica #[default] | #S "
tmux_opt status-right " #[fg=colour244]%Y-%m-%d #[fg=colour231]%H:%M:%S #[default] "

# Window 0 prompt
send_setup "$SESSION:0" "ROOT" "cd '$ROOT'; clear; pwd; ls -la | head -n 40"

# -------------------------
# Create windows 1..9 as requested
# -------------------------
tmux new-window -t "$SESSION:1" -n "CMD"     "bash -i"
tmux new-window -t "$SESSION:2" -n "API"     "bash -i"
tmux new-window -t "$SESSION:3" -n "HEALTH"  "bash -i"
tmux new-window -t "$SESSION:4" -n "PORTS"   "bash -i"
tmux new-window -t "$SESSION:5" -n "CLIENT"  "bash -i"
tmux new-window -t "$SESSION:6" -n "MERCHANT""bash -i"
tmux new-window -t "$SESSION:7" -n "COURIER" "bash -i"
tmux new-window -t "$SESSION:8" -n "PLATFORM""bash -i"
tmux new-window -t "$SESSION:9" -n "SHELL"   "bash -i"

send_setup "$SESSION:1" "CMD"     "cd '$ROOT'; clear; echo 'CMD window ready.'"
send_setup "$SESSION:2" "API"     "cd '$ROOT'; clear; echo 'API window.'"
send_setup "$SESSION:3" "HEALTH"  "cd '$ROOT'; clear; echo 'HEALTH window.'"
send_setup "$SESSION:4" "PORTS"   "cd '$ROOT'; clear; echo 'PORTS window.'"
send_setup "$SESSION:5" "CLIENT"  "cd '$CLIENT_DIR'; clear; echo 'CLIENT window.'"
send_setup "$SESSION:6" "MERCHANT""cd '$MERCHANT_DIR'; clear; echo 'MERCHANT window.'"
send_setup "$SESSION:7" "COURIER" "cd '$COURIER_DIR'; clear; echo 'COURIER window.'"
send_setup "$SESSION:8" "PLATFORM""cd '$ROOT'; clear; echo 'PLATFORM window.'"
send_setup "$SESSION:9" "SHELL"   "cd '$ROOT'; clear; echo 'SHELL window ready.'"

# -------------------------
# Autoruns
# -------------------------
if [[ "$AUTORUN_API_LOGS" == "1" ]]; then
  send_setup "$SESSION:2" "API" "cd '$ROOT'; docker compose -f '$COMPOSE_FILE' logs -f --tail=200 '$API_SERVICE'"
fi

if [[ "$AUTORUN_HEALTH_WATCH" == "1" ]]; then
  send_setup "$SESSION:3" "HEALTH" "while true; do echo; date; curl -fsS '$API_LOCAL_BASE$API_HEALTH_PATH' && echo ' ✅' || echo ' ❌'; sleep 2; done"
fi

if [[ "$AUTORUN_PORTS_WATCH" == "1" ]]; then
  send_setup "$SESSION:4" "PORTS" "while true; do echo; date; ss -lntp | egrep '(:18080|:18081|:3010|:8081|:8082|:8083)\\b' || true; sleep 2; done"
fi

if [[ "$AUTORUN_CLIENT" == "1" ]]; then
  send_setup "$SESSION:5" "CLIENT" "cd '$CLIENT_DIR'; pnpm dev -- --tunnel --port '$CLIENT_PORT' --clear"
fi

if [[ "$AUTORUN_MERCHANT" == "1" ]]; then
  send_setup "$SESSION:6" "MERCHANT" "cd '$MERCHANT_DIR'; pnpm dev -- --tunnel --port '$MERCHANT_PORT' --clear"
fi

if [[ "$AUTORUN_COURIER" == "1" ]]; then
  send_setup "$SESSION:7" "COURIER" "cd '$COURIER_DIR'; pnpm dev -- --tunnel --port '$COURIER_PORT' --clear"
fi

if [[ "$AUTORUN_PLATFORM" == "1" ]]; then
  if [[ -d "$PLATFORM_DIR" ]]; then
    send_setup "$SESSION:8" "PLATFORM" "cd '$PLATFORM_DIR'; ls -la | head -n 40; echo 'Set your platform command here.'"
  else
    send_setup "$SESSION:8" "PLATFORM" "echo 'PLATFORM_DIR not found: $PLATFORM_DIR'; echo 'Export PLATFORM_DIR then re-run autorun if needed.'"
  fi
fi

# Focus CMD window by default
tmux select-window -t "$SESSION:1"
exec tmux attach -t "$SESSION"
