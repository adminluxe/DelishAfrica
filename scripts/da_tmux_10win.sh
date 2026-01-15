#!/usr/bin/env bash
set -euo pipefail

SESSION="${1:-DA_REL}"
ROOT="/opt/delishafrica/monorepo"
COMPOSE="/opt/delishafrica/compose"

if ! command -v tmux >/dev/null 2>&1; then
  echo "ERROR: tmux introuvable. Installe-le puis relance."
  exit 1
fi

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "Session tmux '$SESSION' existe déjà -> attach"
  exec tmux attach -t "$SESSION"
fi

# options globales anti-fermeture + confort
tmux new-session -d -s "$SESSION" -n "shell" -c "$ROOT"
tmux set -t "$SESSION" -g remain-on-exit on
tmux set -t "$SESSION" -g allow-rename off
tmux set -t "$SESSION" -g renumber-windows on
tmux set -t "$SESSION" -g history-limit 200000
tmux set -t "$SESSION" -g mouse on

# helper
send() { tmux send-keys -t "$SESSION:$1" "$2" C-m; }

# 1 cmd (shell vide)
tmux new-window -t "$SESSION:1" -n "cmd" -c "$ROOT"

# 2 api
tmux new-window -t "$SESSION:2" -n "api" -c "$ROOT"
if [[ -d "$COMPOSE" ]] && (ls "$COMPOSE"/docker-compose*.yml "$COMPOSE"/compose.yml >/dev/null 2>&1); then
  send 2 "cd '$COMPOSE' && docker compose up -d && docker compose logs -f --tail=200"
elif [[ -d "$ROOT/services/api" ]]; then
  send 2 "cd '$ROOT/services/api' && (pnpm dev || pnpm start || npm run dev || npm start)"
else
  send 2 "echo 'API: dossier compose/services/api introuvable. Lance manuellement ici.'"
fi

# 3 health
tmux new-window -t "$SESSION:3" -n "health" -c "$ROOT"
send 3 "bash -lc 'while true; do d=\$(date +\"%F %T\"); code=\$(curl -s -o /dev/null -w \"%{http_code}\" http://localhost:3010/health || true); if [ \"\$code\" = \"\" ] || [ \"\$code\" = \"000\" ]; then code=\$(curl -s -o /dev/null -w \"%{http_code}\" http://localhost:3010/ || true); fi; echo \"[\$d] API status: \$code\"; sleep 2; done'"

# 4 ports
tmux new-window -t "$SESSION:4" -n "ports" -c "$ROOT"
send 4 "bash -lc 'command -v ss >/dev/null && watch -n 1 \"ss -lntp | egrep \\\"(3010|8081|8082|8083)\\\" || true\" || watch -n 1 \"netstat -lntp 2>/dev/null | egrep \\\"(3010|8081|8082|8083)\\\" || true\"'"

# Expo flags (par défaut tunnel = le plus robuste en serveur)
EXPO_NET_FLAG="${DA_EXPO_NET_FLAG:---tunnel}"

# 5 client
tmux new-window -t "$SESSION:5" -n "client" -c "$ROOT/apps/client"
send 5 "cd '$ROOT/apps/client' && pnpm exec expo start --dev-client -c $EXPO_NET_FLAG --port 8081"

# 6 merchant
tmux new-window -t "$SESSION:6" -n "merchant" -c "$ROOT/apps/merchant"
send 6 "cd '$ROOT/apps/merchant' && pnpm exec expo start --dev-client -c $EXPO_NET_FLAG --port 8082"

# 7 courier
tmux new-window -t "$SESSION:7" -n "courier" -c "$ROOT/apps/courier"
send 7 "cd '$ROOT/apps/courier' && pnpm exec expo start --dev-client -c $EXPO_NET_FLAG --port 8083"

# 8 platform
tmux new-window -t "$SESSION:8" -n "platform" -c "$ROOT"
if command -v docker >/dev/null 2>&1; then
  send 8 "watch -n 2 'docker ps --format \"table {{.Names}}\t{{.Status}}\t{{.Ports}}\"'"
else
  send 8 "echo 'docker non détecté. (Optionnel) Lance htop/df/journalctl ici.'"
fi

# 9 shell2
tmux new-window -t "$SESSION:9" -n "shell2" -c "$ROOT"

# focus sur cmd
tmux select-window -t "$SESSION:1"
exec tmux attach -t "$SESSION"
