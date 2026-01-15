#!/usr/bin/env bash
set -euo pipefail

SESSION="delish"
API_PUBLIC="https://api.delishafrica.me"
API_PORT="3010"

say(){ echo -e "\n\033[1;36m==> $*\033[0m"; }
ok(){  echo -e "\033[1;32m✔\033[0m $*"; }
warn(){ echo -e "\033[1;33m⚠\033[0m $*"; }

ROOT="/opt/delishafrica/monorepo"

# Heuristiques dossiers (monorepo “officiel” côté roadbooks) :contentReference[oaicite:1]{index=1}
APPS_ROOT="$ROOT/apps"
API_DIR="$ROOT/services/api"

# fallback si le backend est dans l’ancien nom delishafrica-monorepo
if [ ! -d "$API_DIR" ] && [ -d "/opt/delishafrica/delishafrica-monorepo/services/api" ]; then
  API_DIR="/opt/delishafrica/delishafrica-monorepo/services/api"
fi

CLIENT_DIR="$APPS_ROOT/client"
COURIER_DIR="$APPS_ROOT/courier"
MERCHANT_DIR="$APPS_ROOT/merchant"

need_dir(){ [ -d "$1" ] || { echo "❌ Dossier introuvable: $1"; exit 1; }; }

choose_api_cmd() {
  local pj="$API_DIR/package.json"
  [ -f "$pj" ] || { echo "pnpm dev"; return; }
  if grep -q '"start:dev"' "$pj"; then echo "pnpm start:dev"; return; fi
  if grep -q '"dev"'       "$pj"; then echo "pnpm dev"; return; fi
  if grep -q '"start"'     "$pj"; then echo "pnpm start"; return; fi
  echo "pnpm dev"
}

expo_cmd() {
  local port="$1"
  # --dev-client + --tunnel + -c + port fixe = stable
  echo "rm -rf .expo .expo-shared 2>/dev/null || true; pnpm exec expo start --dev-client --tunnel -c --port $port"
}

patch_cloudflared() {
  local cfg="/root/.cloudflared/config.yml"
  [ -f "$cfg" ] || return 0
  say "Patch cloudflared config (safe) -> 127.0.0.1:${API_PORT}"
  cp -a "$cfg" "${cfg}.bak.$(date +%Y%m%d_%H%M%S)"
  # Remplace uniquement les ports classiques qu’on a vus dériver (4001/4010/3000/3011 etc.)
  sed -i -E "s@(127\.0\.0\.1:)(4001|4010|3000|3011|4011)@\1${API_PORT}@g" "$cfg"
  ok "cloudflared config patché: $cfg"
}

ensure_app_env() {
  local dir="$1"
  local envfile="$dir/.env"
  say "Force env API dans $(basename "$dir")"
  touch "$envfile"

  # Nettoie les vieilles valeurs (4010 + trycloudflare) puis impose la bonne
  sed -i -E "s@https://[a-zA-Z0-9-]+\.trycloudflare\.com@${API_PUBLIC}@g" "$envfile"
  sed -i -E "s@http://194\.164\.72\.250:4010@${API_PUBLIC}@g" "$envfile"

  # Ajoute/replace (idempotent)
  grep -q '^EXPO_PUBLIC_API_URL=' "$envfile" \
    && sed -i -E "s@^EXPO_PUBLIC_API_URL=.*@EXPO_PUBLIC_API_URL=${API_PUBLIC}@g" "$envfile" \
    || echo "EXPO_PUBLIC_API_URL=${API_PUBLIC}" >> "$envfile"

  grep -q '^EXPO_PUBLIC_API_BASE_URL=' "$envfile" \
    && sed -i -E "s@^EXPO_PUBLIC_API_BASE_URL=.*@EXPO_PUBLIC_API_BASE_URL=${API_PUBLIC}@g" "$envfile" \
    || echo "EXPO_PUBLIC_API_BASE_URL=${API_PUBLIC}" >> "$envfile"

  grep -q '^API_BASE_URL=' "$envfile" \
    && sed -i -E "s@^API_BASE_URL=.*@API_BASE_URL=${API_PUBLIC}@g" "$envfile" \
    || echo "API_BASE_URL=${API_PUBLIC}" >> "$envfile"

  grep -q '^API_URL=' "$envfile" \
    && sed -i -E "s@^API_URL=.*@API_URL=${API_PUBLIC}@g" "$envfile" \
    || echo "API_URL=${API_PUBLIC}" >> "$envfile"

  # Patch aussi les fichiers de config courants si jamais une URL “trycloudflare/4010” traîne
  find "$dir" -maxdepth 3 -type f \( -name "app.config.ts" -o -name "app.config.js" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) \
    -print0 2>/dev/null | xargs -0 -r sed -i -E \
      "s@https://[a-zA-Z0-9-]+\.trycloudflare\.com@${API_PUBLIC}@g; s@http://194\.164\.72\.250:4010@${API_PUBLIC}@g" || true

  ok "Env OK: $envfile"
}

health_probe() {
  local base="$1"
  shift
  local paths=("$@")
  for p in "${paths[@]}"; do
    if curl -fsS --max-time 2 "${base}${p}" >/dev/null 2>&1; then
      echo "${base}${p}"
      return 0
    fi
  done
  return 1
}

say "0) Sanity paths"
need_dir "$ROOT"
need_dir "$API_DIR"
need_dir "$CLIENT_DIR"
need_dir "$COURIER_DIR"
need_dir "$MERCHANT_DIR"
ok "Paths OK (ROOT=$ROOT | API_DIR=$API_DIR)"

say "1) Kill tmux + purge sockets"
tmux kill-server 2>/dev/null || true
export TMUX_TMPDIR="/tmp/tmux-$(id -u)"
mkdir -p "$TMUX_TMPDIR"
chmod 700 "$TMUX_TMPDIR"
rm -rf "$TMUX_TMPDIR"/* 2>/dev/null || true
ok "tmux purgé"

say "2) Kill processes (Expo/Metro) + free ports"
for p in 3010 8081 8082 8083 8084 19000 19001 19002 19006; do
  fuser -k "${p}/tcp" 2>/dev/null || true
done
pkill -f "expo start" 2>/dev/null || true
pkill -f "MetroBundler" 2>/dev/null || true
pkill -f "react-native" 2>/dev/null || true
ok "Ports nettoyés"

say "3) Patch cloudflared (si présent) + restart service si possible"
patch_cloudflared
if command -v systemctl >/dev/null 2>&1; then
  systemctl restart cloudflared 2>/dev/null || systemctl restart cloudflared.service 2>/dev/null || true
fi
ok "cloudflared restart tenté"

say "4) Force env API dans les 3 apps -> ${API_PUBLIC}"
ensure_app_env "$CLIENT_DIR"
ensure_app_env "$COURIER_DIR"
ensure_app_env "$MERCHANT_DIR"

say "5) Create tmux session + windows"
tmux new-session -d -s "$SESSION" -n shell
tmux set-option -t "$SESSION" mouse on >/dev/null

API_CMD="$(choose_api_cmd)"

# API
tmux new-window -t "$SESSION" -n api
tmux send-keys -t "$SESSION:api" "cd '$API_DIR' && export PORT=${API_PORT} API_PORT=${API_PORT} && $API_CMD" C-m

# Courier (8081)
tmux new-window -t "$SESSION" -n courier
tmux send-keys -t "$SESSION:courier" "cd '$COURIER_DIR' && export EXPO_PUBLIC_API_URL='${API_PUBLIC}' EXPO_PUBLIC_API_BASE_URL='${API_PUBLIC}' API_BASE_URL='${API_PUBLIC}' API_URL='${API_PUBLIC}' && $(expo_cmd 8081)" C-m

# Client (8082)
tmux new-window -t "$SESSION" -n client
tmux send-keys -t "$SESSION:client" "cd '$CLIENT_DIR' && export EXPO_PUBLIC_API_URL='${API_PUBLIC}' EXPO_PUBLIC_API_BASE_URL='${API_PUBLIC}' API_BASE_URL='${API_PUBLIC}' API_URL='${API_PUBLIC}' && $(expo_cmd 8082)" C-m

# Merchant (8083)
tmux new-window -t "$SESSION" -n merchant
tmux send-keys -t "$SESSION:merchant" "cd '$MERCHANT_DIR' && export EXPO_PUBLIC_API_URL='${API_PUBLIC}' EXPO_PUBLIC_API_BASE_URL='${API_PUBLIC}' API_BASE_URL='${API_PUBLIC}' API_URL='${API_PUBLIC}' && $(expo_cmd 8083)" C-m

say "6) Wait API local (max 35s) then check"
for i in {1..35}; do
  if u="$(health_probe "http://127.0.0.1:${API_PORT}" "/api/v1/health" "/api/health" "/health")"; then
    ok "Local health OK: $u"
    break
  fi
  sleep 1
done

say "7) External check (Cloudflare) (best-effort)"
health_probe "${API_PUBLIC}" "/api/v1/health" "/api/health" "/health" >/dev/null 2>&1 \
  && ok "External health OK via ${API_PUBLIC}" \
  || warn "External health not OK yet (check cloudflared + API window)"

echo
ok "DONE"
echo "Attach: tmux attach -t ${SESSION}"
echo "Windows: tmux list-windows -t ${SESSION}"
