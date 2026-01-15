#!/usr/bin/env bash
set -euo pipefail

echo "== DelishAfrica :: Fix ports Expo/Metro (keep API) =="

# Ports Expo/Metro les plus courants + celui qui te bloque
PORTS=(8081 8082 8083 8084 8085 8086 19000 19001 19002 19003 19004 19005 19006 14049)

kill_pids() {
  local pids="$1"
  [[ -z "$pids" ]] && return 0
  echo " -> Killing PIDs: $pids"
  kill -TERM $pids 2>/dev/null || true
  sleep 0.6
  kill -KILL $pids 2>/dev/null || true
}

free_port() {
  local port="$1"
  local pids=""
  pids="$(lsof -nP -t -iTCP:$port -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "== Freeing port $port (LISTEN) =="
    lsof -nP -iTCP:$port -sTCP:LISTEN || true
    kill_pids "$pids"
  fi
}

echo "== 1) Stop known Expo/Metro/Turbo processes (patterns) =="
# On vise Expo/Metro/Turbo uniquement (évite de tuer l'API node)
for pat in \
  "expo start" \
  "@expo/cli" \
  "metro" \
  "react-native" \
  "turbo run dev" \
  "pnpm dev" \
  "dev-client"; do
  pids="$(pgrep -af "$pat" 2>/dev/null | awk '{print $1}' | tr '\n' ' ' || true)"
  if [[ -n "${pids// }" ]]; then
    echo "Pattern: $pat"
    pgrep -af "$pat" || true
    kill_pids "$pids"
  fi
done

echo "== 2) Free ports =="
for p in "${PORTS[@]}"; do
  free_port "$p"
done

echo "== 3) Quick sanity check for 8081-8086 =="
for p in 8081 8082 8083 8084 8085 8086; do
  if lsof -nP -iTCP:$p -sTCP:LISTEN >/dev/null 2>&1; then
    echo "❌ Port still busy: $p"
    lsof -nP -iTCP:$p -sTCP:LISTEN || true
  else
    echo "✅ Port free: $p"
  fi
done

echo "== Done =="
