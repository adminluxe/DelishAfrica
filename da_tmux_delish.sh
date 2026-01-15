#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL=https://api.delishafrica.me
SESSION="delish"

ROOT="/opt/delishafrica/compose"
API_DIR="$ROOT/services/api"
COURIER_DIR="$ROOT/apps/courier"
CLIENT_DIR="$ROOT/apps/client"
MERCHANT_DIR="$ROOT/apps/merchant"

# fallback si certains dossiers sont dans monorepo
[ -d "$API_DIR" ] || API_DIR="/opt/delishafrica/monorepo/services/api"
[ -d "$COURIER_DIR" ] || COURIER_DIR="/opt/delishafrica/monorepo/apps/courier"
[ -d "$CLIENT_DIR" ] || CLIENT_DIR="/opt/delishafrica/monorepo/apps/client"
[ -d "$MERCHANT_DIR" ] || MERCHANT_DIR="/opt/delishafrica/monorepo/apps/merchant"

EXPO_CMD="npx expo"
if command -v pnpm >/dev/null 2>&1; then
  EXPO_CMD="pnpm exec expo"
fi

# clean zombies
pkill -f "expo start" || true
tmux kill-session -t "$SESSION" 2>/dev/null || true

tmux new-session -d -s "$SESSION" -n api
tmux set-option -t "$SESSION" mouse on

# Window 0: API
tmux send-keys -t "$SESSION:api" "cd '$API_DIR' && (pnpm dev || npm run dev || yarn dev)" C-m

# Window 1: courier
tmux new-window -t "$SESSION" -n courier
tmux send-keys -t "$SESSION:courier" "cd '$COURIER_DIR' && export EXPO_PUBLIC_API_BASE_URL='$API_BASE_URL' && $EXPO_CMD start --dev-client --tunnel -c --port 8081" C-m

# Window 2: client
tmux new-window -t "$SESSION" -n client
tmux send-keys -t "$SESSION:client" "cd '$CLIENT_DIR' && export EXPO_PUBLIC_API_BASE_URL='$API_BASE_URL' && $EXPO_CMD start --dev-client --tunnel -c --port 8082" C-m

# Window 3: merchant
tmux new-window -t "$SESSION" -n merchant
tmux send-keys -t "$SESSION:merchant" "cd '$MERCHANT_DIR' && export EXPO_PUBLIC_API_BASE_URL='$API_BASE_URL' && $EXPO_CMD start --dev-client --tunnel -c --port 8083" C-m

echo "✅ tmux prêt: tmux attach -t $SESSION"
echo "API_BASE_URL: $API_BASE_URL"
