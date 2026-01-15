#!/usr/bin/env bash
set -euo pipefail

SESSION="delish"
ROOT="/opt/delishafrica/compose"

API_DIR="$ROOT/services/api"
COURIER_DIR="$ROOT/apps/courier"
CLIENT_DIR="$ROOT/apps/client"
MERCHANT_DIR="$ROOT/apps/merchant"

# fallback monorepo si besoin
[ -d "$API_DIR" ] || API_DIR="/opt/delishafrica/monorepo/services/api"
[ -d "$COURIER_DIR" ] || COURIER_DIR="/opt/delishafrica/monorepo/apps/courier"
[ -d "$CLIENT_DIR" ] || CLIENT_DIR="/opt/delishafrica/monorepo/apps/client"
[ -d "$MERCHANT_DIR" ] || MERCHANT_DIR="/opt/delishafrica/monorepo/apps/merchant"

say(){ echo -e "\n\033[1;36m==> $*\033[0m"; }
ok(){ echo -e "\033[1;32m✔\033[0m $*"; }
warn(){ echo -e "\033[1;33m⚠\033[0m $*"; }

need_dir(){ [ -d "$1" ] || { echo "❌ Dossier introuvable: $1"; exit 1; }; }

say "0) Sanity paths"
need_dir "$API_DIR"
need_dir "$COURIER_DIR"
need_dir "$CLIENT_DIR"
need_dir "$MERCHANT_DIR"
ok "Paths OK"

say "1) Kill tmux + purge sockets"
tmux kill-server 2>/dev/null || true
rm -rf /tmp/tmux-* 2>/dev/null || true
ok "tmux purgé"

say "2) Kill processes (expo/metro/node) + free ports"
pkill -f "expo start" 2>/dev/null || true
pkill -f "MetroBundler" 2>/dev/null || true
pkill -f "react-native" 2>/dev/null || true
pkill -f "node .*expo" 2>/dev/null || true
# on évite pkill -f node en mode bourrin ici; on libère par ports plutôt
for p in 3010 8081 8082 8083 8084; do fuser -k ${p}/tcp 2>/dev/null || true; done
ok "Ports nettoyés (3010/8081-8084)"

say "3) Ensure tmux works (TMPDIR propre)"
export TMUX_TMPDIR="/tmp/tmux-$(id -u)"
mkdir -p "$TMUX_TMPDIR"
chmod 700 "$TMUX_TMPDIR"
rm -rf "$TMUX_TMPDIR"/* 2>/dev/null || true
ok "TMUX_TMPDIR=$TMUX_TMPDIR"

say "4) Create tmux session + windows"
tmux new-session -d -s "$SESSION" -n api
tmux set-option -t "$SESSION" mouse on >/dev/null

# Window 0: API (port 3010)
tmux send-keys -t "$SESSION:api" "cd '$API_DIR' && (pnpm dev || npm run dev || yarn dev)" C-m

# Window 1: courier (8081)
tmux new-window -t "$SESSION" -n courier
tmux send-keys -t "$SESSION:courier" "cd '$COURIER_DIR' && (pnpm exec expo start --dev-client --tunnel -c --port 8081 || npx expo start --dev-client --tunnel -c --port 8081)" C-m

# Window 2: client (8082)
tmux new-window -t "$SESSION" -n client
tmux send-keys -t "$SESSION:client" "cd '$CLIENT_DIR' && (pnpm exec expo start --dev-client --tunnel -c --port 8082 || npx expo start --dev-client --tunnel -c --port 8082)" C-m

# Window 3: merchant (8083)
tmux new-window -t "$SESSION" -n merchant
tmux send-keys -t "$SESSION:merchant" "cd '$MERCHANT_DIR' && (pnpm exec expo start --dev-client --tunnel -c --port 8083 || npx expo start --dev-client --tunnel -c --port 8083)" C-m

say "5) Quick checks (attend 3s)"
sleep 3
echo "--- LISTENING:"
ss -lntp | egrep ':3010|:8081|:8082|:8083' || true

echo "--- API health local (3010):"
curl -sS --max-time 2 http://127.0.0.1:3010/api/v1/health || true

ok "DONE. Live: tmux attach -t $SESSION"
