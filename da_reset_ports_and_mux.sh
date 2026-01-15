#!/usr/bin/env bash
set -euo pipefail

SESSION="delish"

PORTS=(
  8081 8082 8083
  19000 19001 19002
)

kill_port() {
  local p="$1"
  local pids
  pids="$(lsof -ti tcp:"$p" 2>/dev/null || true)"
  if [ -n "${pids:-}" ]; then
    echo "🧨 Kill port $p -> $pids"
    kill -9 $pids || true
  else
    echo "✅ Port $p libre"
  fi
}

echo "🧼 1) Kill tmux session (si existe)"
tmux kill-session -t "$SESSION" >/dev/null 2>&1 || true

echo "🧯 2) Kill Metro/Expo/Node classiques (best effort)"
pkill -f "expo start" >/dev/null 2>&1 || true
pkill -f "metro" >/dev/null 2>&1 || true
pkill -f "react-native" >/dev/null 2>&1 || true
pkill -f "node .*808[123]" >/dev/null 2>&1 || true

echo "🔓 3) Libérer ports"
for p in "${PORTS[@]}"; do
  kill_port "$p"
done

echo "🚀 4) Relancer la session tmux officielle"
# Si ton da_mux est ailleurs, ajuste ici :
/usr/local/bin/da_mux

echo "✅ Reset + mux OK"
