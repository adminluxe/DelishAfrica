#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
SESSION="delish"

API_DIR="$ROOT/services/api"
API_PORT="${API_PORT:-3010}"

# Expo ports (ajoute 8084 car tu l’as vu EADDRINUSE)
P_CLIENT=8081
P_COURIER=8082
P_MERCHANT=8083
P_EXTRA=8084

log() { echo -e "🩺 [guardian] $*"; }

need_cmd() { command -v "$1" >/dev/null 2>&1; }

kill_port() {
  local p="$1"
  if need_cmd lsof; then
    lsof -tiTCP:"$p" -sTCP:LISTEN | xargs -r kill -9 || true
  else
    # fallback (si lsof absent) : tente fuser
    if need_cmd fuser; then fuser -k "${p}/tcp" || true; fi
  fi
}

hard_reset() {
  log "HARD RESET: tmux + processes + ports + caches"
  tmux kill-session -t "$SESSION" 2>/dev/null || true

  pkill -f "expo start" || true
  pkill -f "metro" || true
  pkill -f "runServer" || true
  pkill -f "node.*(8081|8082|8083|8084|$API_PORT)" || true

  kill_port "$API_PORT"
  kill_port "$P_CLIENT"
  kill_port "$P_COURIER"
  kill_port "$P_MERCHANT"
  kill_port "$P_EXTRA"

  # caches expo (optionnel mais efficace quand Metro fait des caprices)
  rm -rf "$ROOT/apps/"*/.expo "$ROOT/apps/"*/.expo-shared "$ROOT/apps/"*/.cache "$ROOT/apps/"*/node_modules/.cache 2>/dev/null || true

  log "Reset terminé ✅"
}

api_ok() {
  # auto-detect endpoint (on teste plusieurs chemins courants)
  local base="http://127.0.0.1:${API_PORT}"
  local paths=("/health" "/api/health" "/v1/health" "/")
  for path in "${paths[@]}"; do
    if curl -fsS --max-time 2 "${base}${path}" >/dev/null 2>&1; then
      return 0
    fi
  done
  return 1
}

ports_free() {
  # si un port est encore occupé => KO
  if need_cmd lsof; then
    for p in "$API_PORT" "$P_CLIENT" "$P_COURIER" "$P_MERCHANT" "$P_EXTRA"; do
      if lsof -tiTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then return 1; fi
    done
  fi
  return 0
}

tmux_start_5_windows() {
  local api_cmd="cd \"$API_DIR\" && pnpm -s dev"
  local client_cmd="cd \"$ROOT/apps/client\" && pnpm exec expo start --dev-client -c --tunnel --port $P_CLIENT"
  local courier_cmd="cd \"$ROOT/apps/courier\" && pnpm exec expo start --dev-client -c --tunnel --port $P_COURIER"
  local merchant_cmd="cd \"$ROOT/apps/merchant\" && pnpm exec expo start --dev-client -c --tunnel --port $P_MERCHANT"

  log "Création session tmux: $SESSION (5 fenêtres)"
  tmux new-session -d -s "$SESSION" -n "Shell"
  tmux new-window  -t "$SESSION":1 -n "API"     "bash -lc '$api_cmd'"
  tmux new-window  -t "$SESSION":2 -n "Client"  "bash -lc '$client_cmd'"
  tmux new-window  -t "$SESSION":3 -n "Courier" "bash -lc '$courier_cmd'"
  tmux new-window  -t "$SESSION":4 -n "Merchant""bash -lc '$merchant_cmd'"

  tmux select-window -t "$SESSION":0
}

status() {
  log "STATUS"
  echo "ROOT=$ROOT"
  echo "API_DIR=$API_DIR"
  echo "API_PORT=$API_PORT"
  echo "Expo ports: client=$P_CLIENT courier=$P_COURIER merchant=$P_MERCHANT extra=$P_EXTRA"
  echo

  if tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "tmux: ✅ session '$SESSION' OK"
  else
    echo "tmux: ❌ session '$SESSION' absente"
  fi

  if api_ok; then
    echo "api:  ✅ OK (répond)"
  else
    echo "api:  ❌ KO (ne répond pas)"
  fi
}

bringup() {
  log "BRINGUP (clean + start)"
  hard_reset
  (cd "$ROOT" && pnpm -s install) || true
  tmux_start_5_windows
  log "Tout est relancé ✅"
  log "Attach: tmux attach -t $SESSION"
}

watch() {
  local interval="${1:-10}"
  log "WATCH mode (toutes les ${interval}s). Si KO => reset+relance."
  while true; do
    if ! tmux has-session -t "$SESSION" 2>/dev/null; then
      log "tmux absent => bringup"
      bringup
    elif ! api_ok; then
      log "API KO => bringup"
      bringup
    else
      log "OK ✅ (tmux + api)"
    fi
    sleep "$interval"
  done
}

case "${1:-}" in
  status)  status ;;
  reset)   hard_reset ;;
  up)      bringup ;;
  watch)   watch "${2:-10}" ;;
  *)
    echo "Usage:"
    echo "  ./da_guardian.sh status"
    echo "  ./da_guardian.sh reset"
    echo "  ./da_guardian.sh up"
    echo "  ./da_guardian.sh watch [seconds]"
    exit 1
    ;;
esac
