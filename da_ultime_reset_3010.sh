#!/usr/bin/env bash
set -euo pipefail

SESSION="delish"
API_PORT="3010"
API_HOST="api.delishafrica.me"
API_HTTPS="https://${API_HOST}"
MONO="/opt/delishafrica/monorepo"

# fallback (au cas où)
if [ ! -d "$MONO" ] && [ -d "/opt/delishafrica/delishafrica-monorepo" ]; then
  MONO="/opt/delishafrica/delishafrica-monorepo"
fi

API_DIR="$MONO/services/api"
APPS_DIR="$MONO/apps"
CLIENT_DIR="$APPS_DIR/client"
COURIER_DIR="$APPS_DIR/courier"
MERCHANT_DIR="$APPS_DIR/merchant"

say(){ echo -e "\n\033[1;36m==> $*\033[0m"; }
ok(){  echo -e "\033[1;32m✔\033[0m $*"; }
warn(){ echo -e "\033[1;33m⚠\033[0m $*"; }

need_dir(){ [ -d "$1" ] || { echo "❌ Dossier introuvable: $1"; exit 1; }; }

choose_api_cmd() {
  local pj="$API_DIR/package.json"
  if [ -f "$pj" ]; then
    if grep -q '"start:dev"' "$pj"; then echo "pnpm run start:dev"; return; fi
    if grep -q '"dev"' "$pj"; then echo "pnpm run dev"; return; fi
    if grep -q '"start"' "$pj"; then echo "pnpm run start"; return; fi
  fi
  echo "pnpm run dev"
}

expo_cmd() {
  local port="$1"
  # Force l’API côté bundle + purge caches Expo
  echo "rm -rf .expo .expo-shared /tmp/metro-* /tmp/haste-map-* 2>/dev/null || true; EXPO_PUBLIC_API_URL=\"$API_HTTPS\" pnpm exec expo start --dev-client --tunnel -c --port $port"
}

say "0) Sanity paths"
need_dir "$MONO"
need_dir "$API_DIR"
need_dir "$CLIENT_DIR"
need_dir "$COURIER_DIR"
need_dir "$MERCHANT_DIR"
ok "Paths OK (MONO=$MONO)"

say "1) Kill tmux + purge sockets"
tmux kill-server 2>/dev/null || true
export TMUX_TMPDIR="/tmp/tmux-$(id -u)"
mkdir -p "$TMUX_TMPDIR" && chmod 700 "$TMUX_TMPDIR"
rm -rf "$TMUX_TMPDIR"/* 2>/dev/null || true
ok "tmux purgé"

say "2) Kill processes + free ports"
# Ports API + Expo + Metro classiques + vieux ports (4010/4001) pour éviter les fantômes
for p in 3010 4001 4010 8081 8082 8083 8084 19000 19001 19002 19006; do
  fuser -k "${p}/tcp" 2>/dev/null || true
done
pkill -f "expo start" 2>/dev/null || true
pkill -f "MetroBundler" 2>/dev/null || true
pkill -f "react-native" 2>/dev/null || true
ok "ports/process nettoyés"

say "3) Fix cloudflared config (si présent) -> service: 127.0.0.1:${API_PORT}"
CF_CFG="/root/.cloudflared/config.yml"
if [ -f "$CF_CFG" ]; then
  cp -a "$CF_CFG" "${CF_CFG}.bak.$(date +%F_%H%M%S)"
  # remplace les anciens ports courants par 3010
  sed -i \
    -e "s#service: http://127.0.0.1:4001#service: http://127.0.0.1:${API_PORT}#g" \
    -e "s#service: http://127.0.0.1:4010#service: http://127.0.0.1:${API_PORT}#g" \
    -e "s#service: http://localhost:4001#service: http://127.0.0.1:${API_PORT}#g" \
    -e "s#service: http://localhost:4010#service: http://127.0.0.1:${API_PORT}#g" \
    "$CF_CFG" || true
  ok "cloudflared config patchée: $CF_CFG"
else
  warn "Pas de /root/.cloudflared/config.yml (OK si tu utilises uniquement ZeroTrust UI), on ne touche pas."
fi

say "4) Ensure API .env PORT=${API_PORT}"
ENVF="$API_DIR/.env"
if [ -f "$ENVF" ]; then
  if grep -q '^PORT=' "$ENVF"; then
    sed -i "s/^PORT=.*/PORT=${API_PORT}/" "$ENVF"
  else
    echo "PORT=${API_PORT}" >> "$ENVF"
  fi
else
  echo "PORT=${API_PORT}" > "$ENVF"
fi
ok ".env OK"

say "5) Create tmux session (tunnel / api / courier / client / merchant)"
tmux new-session -d -s "$SESSION" -n tunnel
tmux set-option -t "$SESSION" mouse on >/dev/null

# 0) tunnel (systemd si dispo, sinon run)
tmux send-keys -t "$SESSION:tunnel" "if command -v systemctl >/dev/null && systemctl list-unit-files | grep -q '^cloudflared\\.service'; then sudo systemctl restart cloudflared && sudo systemctl --no-pager -l status cloudflared; else cloudflared --config /root/.cloudflared/config.yml tunnel run; fi" C-m

# 1) api
tmux new-window -t "$SESSION" -n api
API_CMD="$(choose_api_cmd)"
tmux send-keys -t "$SESSION:api" "cd '$API_DIR' && ( [ -d node_modules ] || pnpm install ) && $API_CMD" C-m

# wait for api locally
say "6) Wait API local (max ~30s) then quick curls"
for i in $(seq 1 30); do
  if curl -sS --max-time 1 "http://127.0.0.1:${API_PORT}/api/health" >/dev/null 2>&1; then break; fi
  if curl -sS --max-time 1 "http://127.0.0.1:${API_PORT}/api/v1/health" >/dev/null 2>&1; then break; fi
  sleep 1
done

echo "— Local health tries:"
curl -sS --max-time 2 "http://127.0.0.1:${API_PORT}/api/health" || true
echo
curl -sS --max-time 2 "http://127.0.0.1:${API_PORT}/api/v1/health" || true
echo
curl -sS --max-time 2 "http://127.0.0.1:${API_PORT}/health" || true
echo

echo "— External health tries:"
curl -i --max-time 6 "${API_HTTPS}/api/health" || true
echo
curl -i --max-time 6 "${API_HTTPS}/api/v1/health" || true
echo

say "7) Start 3 apps (force EXPO_PUBLIC_API_URL=${API_HTTPS})"
tmux new-window -t "$SESSION" -n courier
tmux send-keys -t "$SESSION:courier" "cd '$COURIER_DIR' && $(expo_cmd 8081)" C-m

tmux new-window -t "$SESSION" -n client
tmux send-keys -t "$SESSION:client" "cd '$CLIENT_DIR' && $(expo_cmd 8082)" C-m

tmux new-window -t "$SESSION" -n merchant
tmux send-keys -t "$SESSION:merchant" "cd '$MERCHANT_DIR' && $(expo_cmd 8083)" C-m

ok "DONE"
echo "Attach: tmux attach -t $SESSION"
