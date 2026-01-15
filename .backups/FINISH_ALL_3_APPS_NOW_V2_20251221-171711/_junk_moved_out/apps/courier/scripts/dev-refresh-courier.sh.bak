#!/usr/bin/env bash
set -euo pipefail
cd /opt/delishafrica/monorepo/apps/courier

echo "[1/5] Kill Expo / Metro si présent…"
pkill -f "expo start" 2>/dev/null || true
pkill -f "react-native" 2>/dev/null || true

echo "[2/5] Nettoyage caches Metro/Expo…"
rm -rf .expo .cache node_modules/.cache || true
# reset watchman si installé
command -v watchman >/dev/null && watchman watch-del-all || true

echo "[3/5] Vérif modules…"
pnpm install

echo "[4/5] Variables .env (API)…"
[ -f .env ] || cat > .env <<'EOV'
API_BASE_URL=https://api.delishafrica.me
EOV
echo "→ API_BASE_URL=$(grep API_BASE_URL .env | cut -d= -f2)"

echo "[5/5] Redémarrage Expo (dev-client standard)…"
pnpm dev -- --clear
