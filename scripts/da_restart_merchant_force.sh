#!/usr/bin/env bash
set -euo pipefail
ROOT="/opt/delishafrica/monorepo"
APP="$ROOT/apps/merchant"
PORT="${1:-8083}"

unset CI
unset EXPO_NO_INTERACTIVE

echo "=== Hard restart Merchant ==="

pkill -f "expo start.*merchant" || true
pkill -f "metro.*merchant" || true

PIDS="$(lsof -tiTCP:$PORT -sTCP:LISTEN||true)"
if [ "$PIDS" ]; then
  kill -9 $PIDS || true
fi

rm -rf "$APP/.expo" "$APP/.expo-shared" "$ROOT/node_modules/.cache"

cd "$APP"
pnpm dev -- --tunnel --port $PORT --clear
