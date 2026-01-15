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

ensure_window () {
  local s="$1" w="$2"
  if ! tmux list-windows -t "$s" -F '#W' 2>/dev/null | grep -qx "$w"; then
    tmux new-window -t "$s" -n "$w" >/dev/null
  fi
}

# Si on est déjà dans tmux, on réutilise la session courante (pour éviter nested tmux)
if [ -n "${TMUX:-}" ]; then
  SESSION="$(tmux display-message -p '#S')"
fi

# Crée la session si besoin (uniquement si pas déjà dedans)
if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  tmux new-session -d -s "$SESSION" -n shell
fi

# Fenêtres (0 shell intact)
ensure_window "$SESSION" "shell"
ensure_window "$SESSION" "api-logs"
ensure_window "$SESSION" "client"
ensure_window "$SESSION" "courier"
ensure_window "$SESSION" "merchant"
ensure_window "$SESSION" "cmd"

# Ports Expo
echo "Kill ports 8081/8082/8083 + quelques ports tunnel fréquents"
kill_port 8081; kill_port 8082; kill_port 8083
# si tu retombes sur 4049x "address already in use"
for p in $(seq 40490 40510); do kill_port "$p"; done

echo "Clear Expo/Metro caches"
rm -rf "$ROOT/apps/client/.expo"   "$ROOT/apps/client/node_modules/.cache"   2>/dev/null || true
rm -rf "$ROOT/apps/courier/.expo"  "$ROOT/apps/courier/node_modules/.cache"  2>/dev/null || true
rm -rf "$ROOT/apps/merchant/.expo" "$ROOT/apps/merchant/node_modules/.cache" 2>/dev/null || true

echo "Start Expo (tunnel + clear) in tmux windows"
tmux send-keys -t "$SESSION:client"   "cd $ROOT/apps/client   && npx expo start --tunnel --clear --port 8081" C-m
tmux send-keys -t "$SESSION:courier"  "cd $ROOT/apps/courier  && npx expo start --tunnel --clear --port 8082" C-m
tmux send-keys -t "$SESSION:merchant" "cd $ROOT/apps/merchant && npx expo start --tunnel --clear --port 8083" C-m

echo "OK. Shell safe: tmux select-window -t $SESSION:cmd"
echo "Attach: tmux attach -t $SESSION"
