#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/compose"
SESSION="delish"
API_BASE="https://api.delishafrica.me"

API_DIR="$ROOT/services/api"
COURIER_DIR="$ROOT/apps/courier"
CLIENT_DIR="$ROOT/apps/client"
MERCHANT_DIR="$ROOT/apps/merchant"

[ -d "$API_DIR" ] || API_DIR="/opt/delishafrica/monorepo/services/api"
[ -d "$COURIER_DIR" ] || COURIER_DIR="/opt/delishafrica/monorepo/apps/courier"
[ -d "$CLIENT_DIR" ] || CLIENT_DIR="/opt/delishafrica/monorepo/apps/client"
[ -d "$MERCHANT_DIR" ] || MERCHANT_DIR="/opt/delishafrica/monorepo/apps/merchant"

LOGO_SRC="$ROOT/assets/LogoDelishAfricaApps.jpg"

say(){ echo -e "\n\033[1;36m==> $*\033[0m"; }
need_dir(){ [ -d "$1" ] || { echo "❌ Dossier introuvable: $1"; exit 1; }; }
need_file(){ [ -f "$1" ] || { echo "❌ Fichier introuvable: $1"; exit 1; }; }

write_env() {
  local appdir="$1"
  cat > "$appdir/.env.local" <<EOF
EXPO_PUBLIC_API_BASE_URL=https://api.delishafrica.me
EOF
}

copy_logo() {
  local appdir="$1"
  mkdir -p "$appdir/assets"
  cp -f "$LOGO_SRC" "$appdir/assets/logo.jpg"
}

kill_ports() {
  say "Kill ports Expo (8081/8082/8083/8084) + API(4010) si occupés"
  for p in 8081 8082 8083 8084 4010; do fuser -k ${p}/tcp >/dev/null 2>&1 || true; done
  pkill -f "expo start" >/dev/null 2>&1 || true
  pkill -f "metro" >/dev/null 2>&1 || true
}

ensure_tmux() {
  if ! command -v tmux >/dev/null 2>&1; then
    say "tmux absent -> install"
    apt-get update && apt-get install -y tmux
  fi
  mkdir -p /tmp/tmux-$(id -u)
  chmod 700 /tmp/tmux-$(id -u)
  export TMUX_TMPDIR="/tmp"
  tmux kill-server >/dev/null 2>&1 || true
  # test tmux
  if ! tmux new -d -s __tmux_test "echo OK && sleep 1" >/dev/null 2>&1; then
    echo "❌ tmux ne démarre pas (crash). On bascule en mode fallback (nohup logs)."
    return 1
  fi
  tmux kill-session -t __tmux_test >/dev/null 2>&1 || true
  return 0
}

start_tmux() {
  tmux kill-session -t "$SESSION" >/dev/null 2>&1 || true
  tmux new-session -d -s "$SESSION" -n api
  tmux set-option -t "$SESSION" mouse on

  tmux send-keys -t "$SESSION:api" "cd '$API_DIR' && corepack enable >/dev/null 2>&1 || true && (pnpm dev || npm run dev || yarn dev)" C-m

  tmux new-window -t "$SESSION" -n courier
  tmux send-keys -t "$SESSION:courier" "cd '$COURIER_DIR' && export EXPO_PUBLIC_API_BASE_URL='$API_BASE' && pnpm exec expo start --dev-client --tunnel -c --port 8081" C-m

  tmux new-window -t "$SESSION" -n client
  tmux send-keys -t "$SESSION:client" "cd '$CLIENT_DIR' && export EXPO_PUBLIC_API_BASE_URL='$API_BASE' && pnpm exec expo start --dev-client --tunnel -c --port 8082" C-m

  tmux new-window -t "$SESSION" -n merchant
  tmux send-keys -t "$SESSION:merchant" "cd '$MERCHANT_DIR' && export EXPO_PUBLIC_API_BASE_URL='$API_BASE' && pnpm exec expo start --dev-client --tunnel -c --port 8083" C-m

  say "TMUX OK: tmux attach -t $SESSION"
}

start_fallback_no_tmux() {
  say "Fallback: lancement sans tmux (nohup + logs)"
  mkdir -p /var/log/delish
  (cd "$API_DIR" && corepack enable >/dev/null 2>&1 || true && nohup bash -lc "(pnpm dev || npm run dev || yarn dev)" > /var/log/delish/api.log 2>&1 &)
  (cd "$COURIER_DIR" && nohup bash -lc "export EXPO_PUBLIC_API_BASE_URL='$API_BASE'; pnpm exec expo start --dev-client --tunnel -c --port 8081" > /var/log/delish/courier.log 2>&1 &)
  (cd "$CLIENT_DIR" && nohup bash -lc "export EXPO_PUBLIC_API_BASE_URL='$API_BASE'; pnpm exec expo start --dev-client --tunnel -c --port 8082" > /var/log/delish/client.log 2>&1 &)
  (cd "$MERCHANT_DIR" && nohup bash -lc "export EXPO_PUBLIC_API_BASE_URL='$API_BASE'; pnpm exec expo start --dev-client --tunnel -c --port 8083" > /var/log/delish/merchant.log 2>&1 &)

  echo "✅ Logs:"
  echo "  tail -n 80 /var/log/delish/api.log"
  echo "  tail -n 40 /var/log/delish/courier.log"
  echo "  tail -n 40 /var/log/delish/client.log"
  echo "  tail -n 40 /var/log/delish/merchant.log"
}

health_check() {
  say "Check local API (4010)"
  if curl -sS --max-time 3 http://127.0.0.1:3010/health >/dev/null 2>&1 || \
     curl -sS --max-time 3 http://127.0.0.1:3010/api/health >/dev/null 2>&1; then
    echo "✅ API OK en local."
  else
    echo "❌ API toujours KO en local (4010)."
    echo "➡️  Donne-moi les logs api: (tmux ou /var/log/delish/api.log)"
  fi
}

main(){
  need_dir "$API_DIR"; need_dir "$COURIER_DIR"; need_dir "$CLIENT_DIR"; need_dir "$MERCHANT_DIR"; need_file "$LOGO_SRC"

  say "1) ENV apps -> $API_BASE"
  write_env "$COURIER_DIR"; write_env "$CLIENT_DIR"; write_env "$MERCHANT_DIR"

  say "2) Logo -> assets/logo.jpg"
  copy_logo "$COURIER_DIR"; copy_logo "$CLIENT_DIR"; copy_logo "$MERCHANT_DIR"

  kill_ports

  if ensure_tmux; then
    start_tmux
  else
    start_fallback_no_tmux
  fi

  sleep 2
  health_check
}
main
