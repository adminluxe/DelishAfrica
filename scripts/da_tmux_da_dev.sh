#!/usr/bin/env bash
set -euo pipefail

SESSION="${SESSION:-DA_DEV}"
ROOT="/opt/delishafrica/monorepo"

# Optional autorun toggles (0/1)
AUTORUN_API_LOGS="${AUTORUN_API_LOGS:-1}"     # logs api docker
AUTORUN_HEALTH_WATCH="${AUTORUN_HEALTH_WATCH:-1}"
AUTORUN_PORTS_WATCH="${AUTORUN_PORTS_WATCH:-1}"
AUTORUN_CLIENT="${AUTORUN_CLIENT:-0}"         # set 1 if you want pnpm dev auto
AUTORUN_MERCHANT="${AUTORUN_MERCHANT:-0}"
AUTORUN_COURIER="${AUTORUN_COURIER:-0}"
AUTORUN_PLATFORM="${AUTORUN_PLATFORM:-0}"

# Directories
CLIENT_DIR="$ROOT/apps/client"
MERCHANT_DIR="$ROOT/apps/merchant"
COURIER_DIR="$ROOT/apps/courier"
PLATFORM_DIR="${PLATFORM_DIR:-/opt/delishafrica/delishafrica-ops}"  # change if needed

# Compose / api
COMPOSE_FILE="$ROOT/docker-compose.yml"
API_SERVICE_NAME="${API_SERVICE_NAME:-api}"
API_CONTAINER_NAME="${API_CONTAINER_NAME:-delish-api}"

# Detect tmux
command -v tmux >/dev/null 2>&1 || { echo "ERROR: tmux not installed"; exit 1; }

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "Session '$SESSION' already exists. Attaching..."
  exec tmux attach -t "$SESSION"
fi

# Helper: send bash prompt setup (clear separation prompt/output)
set_prompt() {
  local target="$1" title="$2"
  tmux send-keys -t "$target" "export DA_PANE_TITLE='$title'" C-m
  tmux send-keys -t "$target" "export PROMPT_COMMAND='echo -ne \"\\033]0;${SESSION} | ${title}\\007\"'" C-m
  # Prompt: time | session:window | title | cwd | $
  tmux send-keys -t "$target" "export PS1='\\[\\e[38;5;220m\\]\\t\\[\\e[0m\\] \\[\\e[38;5;141m\\]${SESSION}\\[\\e[0m\\]:\\[\\e[38;5;81m\\]\\w\\[\\e[0m\\] \\[\\e[38;5;118m\\](${title})\\[\\e[0m\\]\\n\\[\\e[38;5;214m\\]\\u@\\h\\[\\e[0m\\] \\[\\e[38;5;45m\\]\\$\\[\\e[0m\\] '" C-m
}

# Create session with window 0 (index 0)
tmux new-session -d -s "$SESSION" -n "10" "bash"

# ---------- Global tmux hardening / UX ----------
tmux set-option -t "$SESSION" -g base-index 0
tmux set-option -t "$SESSION" -g renumber-windows off
tmux set-option -t "$SESSION" -g detach-on-destroy off
tmux set-option -t "$SESSION" -g set-titles on
tmux set-option -t "$SESSION" -g set-titles-string "#S:#I:#W"
tmux set-option -t "$SESSION" -g mouse on
tmux set-option -t "$SESSION" -g history-limit 200000
tmux set-option -t "$SESSION" -g focus-events on
tmux set-option -t "$SESSION" -g default-terminal "tmux-256color"
tmux set-option -t "$SESSION" -ga terminal-overrides ",xterm-256color:Tc"
tmux set-option -t "$SESSION" -g allow-rename off
tmux set-option -t "$SESSION" -g automatic-rename off
tmux set-option -t "$SESSION" -g remain-on-exit on
tmux set-option -t "$SESSION" -g status-interval 1
tmux set-option -t "$SESSION" -g message-style "fg=colour231,bg=colour52,bold"

# Pane borders show title
tmux set-option -t "$SESSION" -g pane-border-status top
tmux set-option -t "$SESSION" -g pane-border-format "#[fg=colour245]#{pane_index} #[fg=colour81]#{pane_title} #[fg=colour240]#{pane_current_path}"
tmux set-option -t "$SESSION" -g pane-active-border-style "fg=colour45"
tmux set-option -t "$SESSION" -g pane-border-style "fg=colour238"

# Status bar (time + host + session)
tmux set-option -t "$SESSION" -g status-style "fg=colour253,bg=colour234"
tmux set-option -t "$SESSION" -g status-left-length 80
tmux set-option -t "$SESSION" -g status-right-length 120
tmux set-option -t "$SESSION" -g status-left "#[fg=colour234,bg=colour220,bold] DA_DEV #[fg=colour220,bg=colour234,nobold] #[fg=colour141]#S #[fg=colour240]| #[fg=colour81]#(hostname -s) #[fg=colour240]| #[fg=colour118]%Y-%m-%d #[fg=colour45]%H:%M:%S "
tmux set-option -t "$SESSION" -g status-right "#[fg=colour240]CPU:#(awk '{u=$2+$4; t=$2+$4+$5} END{printf(\"%d%%\", (u*100)/t)}' /proc/stat 2>/dev/null || echo '--') #[fg=colour240]| #[fg=colour81]#{?client_prefix,⌨ PREFIX ,}#[fg=colour240]| #[fg=colour118]#{session_windows}w "

# ---------- Create windows 1..9 ----------
tmux new-window -t "$SESSION":1 -n "CMD" "bash"
tmux new-window -t "$SESSION":2 -n "API" "bash"
tmux new-window -t "$SESSION":3 -n "HEALTH" "bash"
tmux new-window -t "$SESSION":4 -n "PORTS" "bash"
tmux new-window -t "$SESSION":5 -n "CLIENT" "bash"
tmux new-window -t "$SESSION":6 -n "MERCHANT" "bash"
tmux new-window -t "$SESSION":7 -n "COURIER" "bash"
tmux new-window -t "$SESSION":8 -n "PLATFORM" "bash"
tmux new-window -t "$SESSION":9 -n "SHELL" "bash"

# ---------- Set pane titles + prompt ----------
for i in 0 1 2 3 4 5 6 7 8 9; do
  tmux select-window -t "$SESSION:$i"
  tmux select-pane -t "$SESSION:$i".0 -T "$(tmux display-message -p -t "$SESSION:$i" '#W')"
done

set_prompt "$SESSION:0.0" "10"
set_prompt "$SESSION:1.0" "CMD"
set_prompt "$SESSION:2.0" "API"
set_prompt "$SESSION:3.0" "HEALTH"
set_prompt "$SESSION:4.0" "PORTS"
set_prompt "$SESSION:5.0" "CLIENT"
set_prompt "$SESSION:6.0" "MERCHANT"
set_prompt "$SESSION:7.0" "COURIER"
set_prompt "$SESSION:8.0" "PLATFORM"
set_prompt "$SESSION:9.0" "SHELL"

# ---------- Seed commands ----------
# Window 1 CMD (parking for manual commands)
tmux send-keys -t "$SESSION:1.0" "cd '$ROOT'" C-m
tmux send-keys -t "$SESSION:1.0" "printf '\nCMD window ready. Use this for one-shot scripts/build commands.\n\n'" C-m

# Window 2 API
tmux send-keys -t "$SESSION:2.0" "cd '$ROOT'" C-m
if [[ "$AUTORUN_API_LOGS" == "1" ]]; then
  tmux send-keys -t "$SESSION:2.0" "echo 'Tailing API logs… (Ctrl+C stops tail, window stays)'" C-m
  tmux send-keys -t "$SESSION:2.0" "if docker compose -f '$COMPOSE_FILE' ps >/dev/null 2>&1; then docker compose -f '$COMPOSE_FILE' logs -f --tail=80 '$API_SERVICE_NAME'; else docker logs -f --tail=80 '$API_CONTAINER_NAME'; fi" C-m
else
  tmux send-keys -t "$SESSION:2.0" "echo 'API window ready (autorun disabled).'" C-m
fi

# Window 3 HEALTH
tmux send-keys -t "$SESSION:3.0" "cd '$ROOT'" C-m
if [[ "$AUTORUN_HEALTH_WATCH" == "1" ]]; then
  tmux send-keys -t "$SESSION:3.0" "bash -lc 'while true; do echo \"---- $(date)\"; \
    echo \"LOCAL 3010:\"; (curl -sS -m 2 -i http://127.0.0.1:3010/health | head -n 5) || true; echo; \
    echo \"NGINX 18080:\"; (curl -sS -m 2 -i http://127.0.0.1:18080/health | head -n 5) || true; echo; \
    echo \"PUBLIC:\"; (curl -sS -m 4 -i https://api.delishafrica.me/health | head -n 5) || true; \
    (curl -sS -m 4 -i https://api.delishafrica.me/api/v1/health | head -n 5) || true; \
    echo; sleep 3; done'" C-m
else
  tmux send-keys -t "$SESSION:3.0" "echo 'HEALTH window ready (autorun disabled).'" C-m
fi

# Window 4 PORTS
tmux send-keys -t "$SESSION:4.0" "cd '$ROOT'" C-m
if [[ "$AUTORUN_PORTS_WATCH" == "1" ]]; then
  tmux send-keys -t "$SESSION:4.0" "bash -lc 'while true; do clear; date; echo; \
    echo \"== ss (key ports) ==\"; ss -lntp | egrep \"(:18080|:3010|:8080|:19000|:19001|:19002)\\b\" || true; echo; \
    echo \"== docker ps (api) ==\"; docker ps --format \"table {{.Names}}\\t{{.Status}}\\t{{.Ports}}\" | egrep \"(NAMES|delish-api|3010)\" || true; \
    echo; sleep 2; done'" C-m
else
  tmux send-keys -t "$SESSION:4.0" "echo 'PORTS window ready (autorun disabled).'" C-m
fi

# Window 5 CLIENT
tmux send-keys -t "$SESSION:5.0" "cd '$CLIENT_DIR' 2>/dev/null || cd '$ROOT'" C-m
tmux send-keys -t "$SESSION:5.0" "echo 'CLIENT window. (Set AUTORUN_CLIENT=1 to auto pnpm dev)'" C-m
if [[ "$AUTORUN_CLIENT" == "1" ]]; then
  tmux send-keys -t "$SESSION:5.0" "pnpm dev" C-m
fi

# Window 6 MERCHANT
tmux send-keys -t "$SESSION:6.0" "cd '$MERCHANT_DIR' 2>/dev/null || cd '$ROOT'" C-m
tmux send-keys -t "$SESSION:6.0" "echo 'MERCHANT window. (Set AUTORUN_MERCHANT=1 to auto pnpm dev)'" C-m
if [[ "$AUTORUN_MERCHANT" == "1" ]]; then
  tmux send-keys -t "$SESSION:6.0" "pnpm dev" C-m
fi

# Window 7 COURIER
tmux send-keys -t "$SESSION:7.0" "cd '$COURIER_DIR' 2>/dev/null || cd '$ROOT'" C-m
tmux send-keys -t "$SESSION:7.0" "echo 'COURIER window. (Set AUTORUN_COURIER=1 to auto pnpm dev)'" C-m
if [[ "$AUTORUN_COURIER" == "1" ]]; then
  tmux send-keys -t "$SESSION:7.0" "pnpm dev" C-m
fi

# Window 8 PLATFORM
tmux send-keys -t "$SESSION:8.0" "if [[ -d '$PLATFORM_DIR' ]]; then cd '$PLATFORM_DIR'; else echo 'PLATFORM_DIR not found: $PLATFORM_DIR'; echo 'Set PLATFORM_DIR env var then cd manually.'; fi" C-m
tmux send-keys -t "$SESSION:8.0" "echo 'PLATFORM window. (Set AUTORUN_PLATFORM=1 to auto start)'" C-m
if [[ "$AUTORUN_PLATFORM" == "1" ]]; then
  tmux send-keys -t "$SESSION:8.0" "pnpm dev || npm run dev || true" C-m
fi

# Window 9 SHELL
tmux send-keys -t "$SESSION:9.0" "cd '$ROOT'" C-m
tmux send-keys -t "$SESSION:9.0" "echo 'SHELL window ready.'" C-m

# Focus CMD window
tmux select-window -t "$SESSION:1"

echo "OK: tmux session '$SESSION' created."
echo "Attach: tmux attach -t $SESSION"
exec tmux attach -t "$SESSION"
