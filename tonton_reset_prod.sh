#!/usr/bin/env bash
set -euo pipefail

say(){ echo -e "\n\033[1;36m==> $*\033[0m"; }
ok(){  echo -e "\033[1;32m✔\033[0m $*"; }
warn(){ echo -e "\033[1;33m⚠\033[0m $*"; }

API_BASE="https://api.delishafrica.me"
SESSION="delish"

ROOT="/opt/delishafrica/compose"
API_DIR="$ROOT/services/api"
COURIER_DIR="$ROOT/apps/courier"
CLIENT_DIR="$ROOT/apps/client"
MERCHANT_DIR="$ROOT/apps/merchant"

# fallback monorepo
[ -d "$API_DIR" ] || API_DIR="/opt/delishafrica/monorepo/services/api"
[ -d "$COURIER_DIR" ] || COURIER_DIR="/opt/delishafrica/monorepo/apps/courier"
[ -d "$CLIENT_DIR" ] || CLIENT_DIR="/opt/delishafrica/monorepo/apps/client"
[ -d "$MERCHANT_DIR" ] || MERCHANT_DIR="/opt/delishafrica/monorepo/apps/merchant"

say "0) Sanity paths"
for d in "$API_DIR" "$COURIER_DIR" "$CLIENT_DIR" "$MERCHANT_DIR"; do
  [ -d "$d" ] || { echo "❌ Dossier introuvable: $d"; exit 1; }
done
ok "Paths OK"

say "1) Logs folder"
mkdir -p /var/log/delish
ok "/var/log/delish prêt"

say "2) Corepack (évite les délires yarn/pnpm)"
command -v corepack >/dev/null 2>&1 && corepack enable >/dev/null 2>&1 || true
ok "corepack ok (si présent)"

say "3) Kill ports (4010 + 8081/8082/8083/8084)"
for p in 4010 8081 8082 8083 8084; do
  fuser -k "${p}/tcp" >/dev/null 2>&1 || true
done
pkill -f "expo start" >/dev/null 2>&1 || true
pkill -f "MetroBundler" >/dev/null 2>&1 || true
pkill -f "react-native" >/dev/null 2>&1 || true
ok "Ports nettoyés"

say "4) tmux install"
if ! command -v tmux >/dev/null 2>&1; then
  apt-get update -y >/dev/null
  apt-get install -y tmux >/dev/null
fi
ok "tmux OK"

say "5) Reset session tmux"
tmux kill-session -t "$SESSION" >/dev/null 2>&1 || true
ok "Session tmux reset"

# helper: lance une commande, log, et GARDE la fenêtre ouverte même si crash
run_keep_open () {
  local title="$1"
  local cmd="$2"
  local logfile="$3"

  # bash -lc pour charger env + garder une trace, puis "exec bash" pour rester ouvert
  echo "bash -lc 'set -o pipefail; echo \"[$title] start: \$(date)\"; $cmd 2>&1 | tee -a \"$logfile\"; echo; echo \"[$title] exited with code \$?\"; echo \"Log: $logfile\"; echo \"(Fenêtre gardée ouverte)\"; exec bash'"
}

say "6) Start tmux session + 4 fenêtres (api / courier / client / merchant)"
tmux new-session -d -s "$SESSION" -n api

# API (4010)
API_CMD="cd \"$API_DIR\" && export PORT=4010 && (pnpm dev || npm run dev || yarn dev)"
tmux send-keys -t "$SESSION:api" "$(run_keep_open "api" "$API_CMD" "/var/log/delish/api.log")" C-m

# courier (8081)
COURIER_CMD="cd \"$COURIER_DIR\" && export EXPO_PUBLIC_API_BASE_URL=\"$API_BASE\" && (pnpm exec expo start --dev-client --tunnel -c --port 8081 || npx expo start --dev-client --tunnel -c --port 8081)"
tmux new-window -t "$SESSION" -n courier
tmux send-keys -t "$SESSION:courier" "$(run_keep_open "courier" "$COURIER_CMD" "/var/log/delish/courier.log")" C-m

# client (8082)
CLIENT_CMD="cd \"$CLIENT_DIR\" && export EXPO_PUBLIC_API_BASE_URL=\"$API_BASE\" && (pnpm exec expo start --dev-client --tunnel -c --port 8082 || npx expo start --dev-client --tunnel -c --port 8082)"
tmux new-window -t "$SESSION" -n client
tmux send-keys -t "$SESSION:client" "$(run_keep_open "client" "$CLIENT_CMD" "/var/log/delish/client.log")" C-m

# merchant (8083)
MERCHANT_CMD="cd \"$MERCHANT_DIR\" && export EXPO_PUBLIC_API_BASE_URL=\"$API_BASE\" && (pnpm exec expo start --dev-client --tunnel -c --port 8083 || npx expo start --dev-client --tunnel -c --port 8083)"
tmux new-window -t "$SESSION" -n merchant
tmux send-keys -t "$SESSION:merchant" "$(run_keep_open "merchant" "$MERCHANT_CMD" "/var/log/delish/merchant.log")" C-m

ok "tmux lancé (session: $SESSION)"

say "7) Checks rapides"
tmux list-windows -t "$SESSION" || true

echo
echo "- Test API public (on teste 2 routes possibles)"
curl -sS --max-time 6 "$API_BASE/health" || true
echo
curl -sS --max-time 6 "$API_BASE/api/health" || true

echo
echo "- Test API local (4010) (on attend 2s)"
sleep 2
curl -sS --max-time 2 "http://127.0.0.1:3010/health" || true
echo
curl -sS --max-time 2 "http://127.0.0.1:3010/api/health" || true

say "DONE. Live: tmux attach -t $SESSION"
