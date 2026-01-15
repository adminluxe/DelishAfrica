#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
SESSION="${TMUX_SESSION:-delish}"

pkill -f "expo start" || true
pkill -f ngrok || true

for p in 8081 8082 8083 4040 4041 4042 4043 4049; do
  fuser -k ${p}/tcp 2>/dev/null || true
done

tmux has-session -t "$SESSION" 2>/dev/null && tmux kill-session -t "$SESSION" || true

tmux new-session -d -s "$SESSION" -n shell "cd $ROOT && bash"
tmux new-window -t "$SESSION" -n client   "cd $ROOT/apps/client   && npx expo start --dev-client --tunnel --port 8081"
tmux new-window -t "$SESSION" -n courier  "cd $ROOT/apps/courier  && npx expo start --dev-client --tunnel --port 8082"
tmux new-window -t "$SESSION" -n merchant "cd $ROOT/apps/merchant && npx expo start --dev-client --tunnel --port 8083"

echo "✅ Expo relancé: client=8081 courier=8082 merchant=8083 (tmux session: $SESSION)"
echo "➡️ tmux attach -t $SESSION"
