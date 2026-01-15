#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
SESSION="delish"

APPS_DIR="$ROOT/apps"
CLIENT_DIR="$APPS_DIR/client"
COURIER_DIR="$APPS_DIR/courier"
MERCHANT_DIR="$APPS_DIR/merchant"

PORTS=(8081 8082 8083 19000 19001 19002)

need(){ command -v "$1" >/dev/null 2>&1 || { echo "❌ Missing: $1"; exit 1; }; }

free_ports() {
  echo "🔪 Freeing ports: ${PORTS[*]}"
  for p in "${PORTS[@]}"; do
    fuser -k -n tcp "$p" >/dev/null 2>&1 || true
  done
}

kill_node_metros() {
  echo "🔪 Killing node/expo/metro (best effort)"
  pkill -f "expo start" >/dev/null 2>&1 || true
  pkill -f "metro" >/dev/null 2>&1 || true
  pkill -f "react-native" >/dev/null 2>&1 || true
  pkill -f "node.*8081" >/dev/null 2>&1 || true
  pkill -f "node.*8082" >/dev/null 2>&1 || true
  pkill -f "node.*8083" >/dev/null 2>&1 || true
}

start_expo_window() {
  local idx="$1" name="$2" dir="$3" port="$4"
  tmux new-window -t "$SESSION:$idx" -n "$name"
  tmux send-keys  -t "$SESSION:$idx" "cd '$dir'" C-m
  tmux send-keys  -t "$SESSION:$idx" "export EXPO_NO_INTERACTIVE=1" C-m
  tmux send-keys  -t "$SESSION:$idx" "pnpm start -- --dev-client -c --tunnel --port $port" C-m
}

main(){
  need tmux
  need pnpm
  need fuser
  need docker

  [ -d "$ROOT" ] || { echo "❌ Monorepo introuvable: $ROOT"; exit 1; }
  cd "$ROOT"

  # reset
  tmux kill-session -t "$SESSION" >/dev/null 2>&1 || true
  kill_node_metros
  free_ports

  # create session
  tmux new-session -d -s "$SESSION" -n "shell"

  tmux new-window -t "$SESSION:1" -n "api-logs"
  tmux send-keys  -t "$SESSION:1" "cd '$ROOT' && docker compose logs -f api || true" C-m

  start_expo_window 2 "client"   "$CLIENT_DIR"   8081
  start_expo_window 3 "courier"  "$COURIER_DIR"  8082
  start_expo_window 4 "merchant" "$MERCHANT_DIR" 8083

  tmux select-window -t "$SESSION:0"

  echo "✅ OK. Attaching…"

  # Auto-attach robuste :
  # - si on est déjà dans tmux -> switch-client
  # - sinon -> attach
  if tmux display-message -p '#{client_tty}' >/dev/null 2>&1; then
    tmux switch-client -t "$SESSION"
  else
    tmux attach -t "$SESSION"
  fi
}

main "$@"
