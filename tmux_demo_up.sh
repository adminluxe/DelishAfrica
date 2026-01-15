#!/usr/bin/env bash
set -euo pipefail

SESSION="delish-demo"

ROOT="/opt/delishafrica"
COMPOSE="/opt/delishafrica/compose"
MONO="/opt/delishafrica/delishafrica-monorepo"

API_DIR="$MONO/services/api"
CLIENT_DIR="$COMPOSE/apps/client"
COURIER_DIR="$COMPOSE/apps/courier"
MERCHANT_DIR="$COMPOSE/apps/merchant"

# Ports
API_PORT="4001"
CLIENT_PORT="8081"
COURIER_PORT="8082"
MERCHANT_PORT="8083"

# Expo options
EXPO_FLAGS="--dev-client -c --tunnel"

pick_api_cmd () {
  # Renvoie la commande à exécuter pour l'API (start:dev -> dev -> start)
  local scripts
  scripts="$(pnpm -C "$API_DIR" -s run 2>/dev/null || true)"

  if echo "$scripts" | grep -qE '^\s*start:dev\b'; then
    echo "PORT=$API_PORT pnpm start:dev"
    return 0
  fi

  if echo "$scripts" | grep -qE '^\s*dev\b'; then
    echo "PORT=$API_PORT pnpm dev"
    return 0
  fi

  if echo "$scripts" | grep -qE '^\s*start\b'; then
    echo "PORT=$API_PORT pnpm start"
    return 0
  fi

  # Fallback ultime (si build déjà dispo)
  echo "PORT=$API_PORT node dist/main.js"
}

echo "🚀 Starting Delish demo in tmux session: $SESSION"

# Preconditions
for d in "$API_DIR" "$CLIENT_DIR" "$COURIER_DIR" "$MERCHANT_DIR"; do
  [[ -d "$d" ]] || { echo "❌ Missing dir: $d"; exit 1; }
done

# Stop anything already running
"$COMPOSE/tmux_demo_down.sh" || true

# Prevent ngrok bind conflicts (selon setup)
for p in 4049 4040 4041; do
  sudo fuser -k "$p/tcp" 2>/dev/null || true
done

# Create tmux session
tmux new-session -d -s "$SESSION" -n "demo"

# Layout: 4 panes (2x2)
tmux split-window -h -t "$SESSION":0
tmux split-window -v -t "$SESSION":0.0
tmux split-window -v -t "$SESSION":0.1
tmux select-layout -t "$SESSION":0 tiled >/dev/null

# Pane mapping (tiled):
# 0.0 = API
# 0.1 = Client
# 0.2 = Courier
# 0.3 = Merchant

API_CMD="$(pick_api_cmd)"

# API
tmux send-keys -t "$SESSION":0.0 "cd '$API_DIR'" C-m
tmux send-keys -t "$SESSION":0.0 "echo '=== API (port $API_PORT) ==='" C-m
tmux send-keys -t "$SESSION":0.0 "echo 'API cmd: $API_CMD'" C-m
tmux send-keys -t "$SESSION":0.0 "pnpm install --silent || true" C-m
tmux send-keys -t "$SESSION":0.0 "$API_CMD" C-m

# Client
tmux send-keys -t "$SESSION":0.1 "cd '$CLIENT_DIR'" C-m
tmux send-keys -t "$SESSION":0.1 "echo '=== CLIENT (metro $CLIENT_PORT) ==='" C-m
tmux send-keys -t "$SESSION":0.1 "pnpm exec expo start $EXPO_FLAGS --port $CLIENT_PORT" C-m

# Courier
tmux send-keys -t "$SESSION":0.2 "cd '$COURIER_DIR'" C-m
tmux send-keys -t "$SESSION":0.2 "echo '=== COURIER (metro $COURIER_PORT) ==='" C-m
tmux send-keys -t "$SESSION":0.2 "pnpm exec expo start $EXPO_FLAGS --port $COURIER_PORT" C-m

# Merchant
tmux send-keys -t "$SESSION":0.3 "cd '$MERCHANT_DIR'" C-m
tmux send-keys -t "$SESSION":0.3 "echo '=== MERCHANT (metro $MERCHANT_PORT) ==='" C-m
tmux send-keys -t "$SESSION":0.3 "pnpm exec expo start $EXPO_FLAGS --port $MERCHANT_PORT" C-m

echo "✅ tmux ready."
echo "Attach with: tmux attach -t $SESSION"
