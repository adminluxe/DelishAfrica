#!/usr/bin/env bash
set -euo pipefail

SESSION="delishafrica"
ROOT="/opt/delishafrica/monorepo"

tmux has-session -t "$SESSION" 2>/dev/null || { echo "Session tmux '$SESSION' introuvable"; exit 1; }

restart(){
  local win="$1" dir="$2" port="$3"
  tmux send-keys -t "$SESSION:$win" C-c || true
  sleep 0.3
  tmux send-keys -t "$SESSION:$win" "cd \"$dir\"; unset CI; export CI=false; export EXPO_NO_TELEMETRY=1; npx expo start --dev-client --tunnel --port $port --clear" C-m
}

# mapping fenêtres
restart 5 "$ROOT/apps/client" 8081
restart 7 "$ROOT/apps/courier" 8082
restart 6 "$ROOT/apps/merchant" 8083

echo "✅ Metros relancés (CI=false). QR attendu dans 5/6/7."
