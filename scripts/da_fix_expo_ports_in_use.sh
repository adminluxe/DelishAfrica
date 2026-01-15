#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"

is_safe_cmd() {
  local pid="$1"
  local cmd
  cmd="$(ps -p "$pid" -o cmd= 2>/dev/null || true)"
  echo "$cmd" | grep -Eqi "(expo|metro|ngrok|@expo|react-native|webpack|node )" && return 0
  return 1
}

kill_listeners_on_port() {
  local port="$1"
  local pids
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN -n -P 2>/dev/null || true)"
  [ -z "${pids:-}" ] && return 0

  for pid in $pids; do
    if is_safe_cmd "$pid"; then
      echo "🧯 Kill PID $pid on port $port :: $(ps -p "$pid" -o cmd= | head -c 160)"
      kill -9 "$pid" 2>/dev/null || true
    else
      echo "⚠️  Skip PID $pid on port $port (cmd not expo/metro/ngrok-like) :: $(ps -p "$pid" -o cmd= | head -c 160)"
    fi
  done
}

echo "== 1) Stop Expo/Metro listeners (safe ports sweep) =="

# Ports des apps Expo
for p in 8081 8082 8083; do kill_listeners_on_port "$p"; done

# Ports Metro/Dev (Expo utilise souvent 19000+)
for p in $(seq 19000 19100); do kill_listeners_on_port "$p"; done

# Ports de tunnel / outils (ton erreur montre 40490/40493)
for p in $(seq 4040 40600); do kill_listeners_on_port "$p"; done

echo
echo "== 2) Soft-kill extra Expo/Metro processes (path restricted) =="

# On tue seulement les process expo/metro liés aux apps (safe : path /opt/delishafrica/monorepo/apps)
mapfile -t PIDS < <(pgrep -af "(/opt/delishafrica/monorepo/apps/).*(expo|metro|react-native|@expo)" | awk '{print $1}' | sort -u || true)
for pid in "${PIDS[@]:-}"; do
  echo "🧹 Kill PID $pid :: $(ps -p "$pid" -o cmd= | head -c 160)"
  kill -9 "$pid" 2>/dev/null || true
done

echo
echo "== 3) Clear Expo/Metro caches (safe) =="

rm -rf "$ROOT/apps/client/.expo" "$ROOT/apps/courier/.expo" "$ROOT/apps/merchant/.expo" 2>/dev/null || true
rm -rf "$ROOT/apps/client/node_modules/.cache" "$ROOT/apps/courier/node_modules/.cache" "$ROOT/apps/merchant/node_modules/.cache" 2>/dev/null || true

echo "✅ Ports + caches cleaned."
echo "👉 Maintenant relance tes apps (dans tes fenêtres tmux) :"
echo "   client  : cd $ROOT/apps/client  && npx expo start --tunnel --clear --port 8081"
echo "   courier : cd $ROOT/apps/courier && npx expo start --tunnel --clear --port 8082"
echo "   merchant: cd $ROOT/apps/merchant && npx expo start --tunnel --clear --port 8083"
