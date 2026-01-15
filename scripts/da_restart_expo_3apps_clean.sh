#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
SESSION="delish"

kill_port () {
  local p="$1"
  if lsof -ti :"$p" >/dev/null 2>&1; then
    lsof -ti :"$p" | xargs -r kill -9 || true
  fi
}

echo "🧹 Kill ports 8081/8082/8083 (Metro)"
kill_port 8081
kill_port 8082
kill_port 8083

echo "🧹 Clear Expo/Metro caches"
rm -rf "$ROOT/apps/client/.expo"   "$ROOT/apps/client/node_modules/.cache"   || true
rm -rf "$ROOT/apps/courier/.expo"  "$ROOT/apps/courier/node_modules/.cache"  || true
rm -rf "$ROOT/apps/merchant/.expo" "$ROOT/apps/merchant/node_modules/.cache" || true

tmux has-session -t "$SESSION" 2>/dev/null || tmux new-session -d -s "$SESSION" -n shell

ensure_window () {
  local wname="$1"
  if ! tmux list-windows -t "$SESSION" -F '#W' | grep -qx "$wname"; then
    tmux new-window -t "$SESSION" -n "$wname" >/dev/null
  fi
}

ensure_window "client"
ensure_window "courier"
ensure_window "merchant"

echo "🚀 Start Expo (tunnel + clear) in tmux windows"
tmux send-keys -t "$SESSION:client"   "cd $ROOT/apps/client   && npx expo start --tunnel --clear --port 8081" C-m
tmux send-keys -t "$SESSION:courier"  "cd $ROOT/apps/courier  && npx expo start --tunnel --clear --port 8082" C-m
tmux send-keys -t "$SESSION:merchant" "cd $ROOT/apps/merchant && npx expo start --tunnel --clear --port 8083" C-m

echo "✅ Restart OK."
if [ -n "${TMUX:-}" ]; then
  echo "↪️ Déjà dans tmux: switch sur la session $SESSION"
  tmux switch-client -t "$SESSION" || true
else
  echo "↪️ Attach: tmux a -t $SESSION"
fi
