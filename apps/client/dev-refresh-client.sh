#!/usr/bin/env bash
set -euo pipefail
APP_DIR="/opt/delishafrica/monorepo/apps/client"
cd "$APP_DIR"
# kill anciens processus
pkill -f "expo start" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true
# caches propres
rm -rf .expo .expo-shared .cache node_modules/.cache || true
# deps (rapide si déjà installées)
if command -v pnpm >/dev/null 2>&1; then pnpm i --silent; pnpm exec expo start --dev-client --tunnel --port 8091 -c
else npm i -s; npx expo start --dev-client --tunnel --port 8091 -c
fi
