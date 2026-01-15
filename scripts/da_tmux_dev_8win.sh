#!/usr/bin/env bash
set -euo pipefail
ROOT="/opt/delishafrica/monorepo"
SESSION="${TMUX_SESSION:-DA_DEV}"

# stop expo/ngrok qui traînent
pkill -f "expo start" 2>/dev/null || true
pkill -f ngrok 2>/dev/null || true

# libère ports expo + ngrok admin (inclut 4049 => votre "address already in use")
for p in 8081 8082 8083 4040 4041 4042 4043 4044 4045 4046 4047 4048 4049; do
  fuser -k ${p}/tcp 2>/dev/null || true
done

tmux kill-session -t "$SESSION" 2>/dev/null || true

tmux new-session -d -s "$SESSION" -n shell   "cd $ROOT && bash"
tmux new-window  -t "$SESSION" -n api-logs   "cd $ROOT && echo 'Fenêtre API/logs (si besoin).'; bash"
tmux new-window  -t "$SESSION" -n client     "cd $ROOT/apps/client && npx expo start --dev-client --tunnel --port 8081"
tmux new-window  -t "$SESSION" -n courier    "cd $ROOT/apps/courier && npx expo start --dev-client --tunnel --port 8082"
tmux new-window  -t "$SESSION" -n merchant   "cd $ROOT/apps/merchant && npx expo start --dev-client --tunnel --port 8083"
tmux new-window  -t "$SESSION" -n ports      "watch -n 1 'lsof -nP -iTCP -sTCP:LISTEN | egrep \"(:8081|:8082|:8083|:4040|:4049)\" || true'"
tmux new-window  -t "$SESSION" -n grep       "cd $ROOT && bash"
tmux new-window  -t "$SESSION" -n notes      "cd $ROOT && bash"

tmux select-window -t "$SESSION":shell
echo "✅ tmux prêt: tmux attach -t $SESSION"
