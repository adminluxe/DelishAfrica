#!/usr/bin/env bash
set -euo pipefail

echo "🧨 RESET API 3010 — DelishAfrica"

# 1) stop tmux
tmux kill-server 2>/dev/null || true

# 2) stop process
pkill -f "expo start" 2>/dev/null || true
pkill -f "MetroBundler" 2>/dev/null || true
pkill -f "react-native" 2>/dev/null || true
pkill -f "nest" 2>/dev/null || true
pkill -f "ts-node" 2>/dev/null || true
pkill -f "services/api" 2>/dev/null || true

# 3) free ports
for p in 3010 8081 8082 8083 19000 19001 19002 4010 4001; do
  fuser -k ${p}/tcp 2>/dev/null || true
done

# 4) caches
rm -rf /tmp/metro-* /tmp/haste-map-* /tmp/react-* 2>/dev/null || true
rm -rf ~/.expo ~/.cache/expo ~/.npm/_cacache 2>/dev/null || true

echo "✅ CLEAN OK"

ROOT="/opt/delishafrica/monorepo"
API_DIR="$ROOT/services/api"

# fallback si vous êtes sur compose
if [ ! -d "$API_DIR" ] && [ -d "/opt/delishafrica/compose/services/api" ]; then
  ROOT="/opt/delishafrica/compose"
  API_DIR="$ROOT/services/api"
fi

echo "📍 ROOT=$ROOT"
echo "📍 API_DIR=$API_DIR"

cd "$API_DIR"
pnpm install
PORT=3010 pnpm start:dev
