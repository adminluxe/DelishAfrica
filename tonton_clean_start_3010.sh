#!/usr/bin/env bash
set -euo pipefail

SESSION="delish"

say(){ echo -e "\n\033[1;36m==> $*\033[0m"; }
ok(){  echo -e "\033[1;32m✔\033[0m $*"; }
warn(){ echo -e "\033[1;33m⚠\033[0m $*"; }

ROOT="/opt/delishafrica/compose"
API_DIR="$ROOT/services/api"
APPS_ROOT="$ROOT/apps"

# fallback monorepo si jamais
if [ ! -d "$API_DIR" ] && [ -d "/opt/delishafrica/monorepo/services/api" ]; then
  ROOT="/opt/delishafrica/monorepo"
  API_DIR="$ROOT/services/api"
  APPS_ROOT="$ROOT/apps"
fi

COURIER_DIR="$APPS_ROOT/courier"
CLIENT_DIR="$APPS_ROOT/client"
MERCHANT_DIR="$APPS_ROOT/merchant"

need_dir(){ [ -d "$1" ] || { echo "❌ Dossier introuvable: $1"; exit 1; }; }

choose_api_cmd() {
  local pj="$API_DIR/package.json"
  if [ -f "$pj" ]; then
    if grep -q '"start:dev"' "$pj"; then echo "pnpm start:dev"; return; fi
    if grep -q '"dev"' "$pj"; then echo "pnpm dev"; return; fi
    if grep -q '"start"' "$pj"; then echo "pnpm start"; return; fi
  fi
  # fallback
  echo "pnpm dev || pnpm start:dev || npm run dev || npm run start:dev || yarn dev || yarn start:dev"
}

EXPO_CMD() {
  # expo en dev-client + tunnel, ports fixes (évite EADDRINUSE + prompts)
  local port="$1"
  echo "rm -rf .expo .expo-shared 2>/dev/null || true; pnpm exec expo start --dev-client --tunnel -c --port $port"
}

say "0) Sanity paths"
need_dir "$API_DIR"
need_dir "$COURIER_DIR"
need_dir "$CLIENT_DIR"
need_dir "$MERCHANT_DIR"
ok "Paths OK (ROOT=$ROOT)"

say "1) Kill tmux + purge sockets (fix 'server exited unexpectedly')"
tmux kill-server 2>/dev/null || true
# tmux utilise /tmp/tmux-<uid> ; quand on est root => uid=0
export TMUX_TMPDIR="/tmp/tmux-$(id -u)"
mkdir -p "$TMUX_TMPDIR"
chmod 700 "$TMUX_TMPDIR"
rm -rf "$TMUX_TMPDIR"/* 2>/dev/null || true
ok "tmux purgé (TMUX_TMPDIR=$TMUX_TMPDIR)"

say "2) Kill processes + free ports (API 3010 + Expo 8081-8084 + classiques Metro)"
# tue les ports plutôt que 'pkill node' bourrin
for p in 3010 8081 8082 8083 8084 19000 19001 19002 19006; do
  fuser -k "${p}/tcp" 2>/dev/null || true
done
pkill -f "expo start" 2>/dev/null || true
pkill -f "MetroBundler" 2>/dev/null || true
pkill -f "react-native" 2>/dev/null || true
ok "Ports libérés"

say "3) Clear caches (soft)"
rm -rf /tmp/metro-* /tmp/haste-map-* /tmp/react-* 2>/dev/null || true
rm -rf ~/.expo ~/.cache/expo ~/.npm/_cacache 2>/dev/null || true
ok "Caches nettoyés"

say "4) Create tmux session + windows (api / courier / client / merchant)"
tmux new-session -d -s "$SESSION" -n api
tmux set-option -t "$SESSION" mouse on >/dev/null

API_CMD="$(choose_api_cmd)"

# 0) API
tmux send-keys -t "$SESSION:api" "cd '$API_DIR' && $API_CMD" C-m

# 1) Courier (8081)
tmux new-window -t "$SESSION" -n courier
tmux send-keys -t "$SESSION:courier" "cd '$COURIER_DIR' && $(EXPO_CMD 8081)" C-m

# 2) Client (8082)
tmux new-window -t "$SESSION" -n client
tmux send-keys -t "$SESSION:client" "cd '$CLIENT_DIR' && $(EXPO_CMD 8082)" C-m

# 3) Merchant (8083)
tmux new-window -t "$SESSION" -n merchant
tmux send-keys -t "$SESSION:merchant" "cd '$MERCHANT_DIR' && $(EXPO_CMD 8083)" C-m

say "5) Quick checks (attend 4s)"
sleep 4

echo "— Local API (on teste 2 routes possibles):"
curl -sS --max-time 2 "http://127.0.0.1:3010/api/v1/health" || true
echo
curl -sS --max-time 2 "http://127.0.0.1:3010/health" || true
echo

ok "DONE. Live: tmux attach -t $SESSION"
