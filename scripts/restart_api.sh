#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then exec /bin/bash "$0" "$@"; fi
set -Eeuo pipefail

APP="delish-api"
PORT="${PORT:-4001}"
HEALTH_URL="${HEALTH_URL:-http://localhost:${PORT}/api/health}"
TIMEOUT="${TIMEOUT:-40}"

# Aller à la racine du repo, même si le script est appelé depuis ailleurs
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

echo "🔨 Build services/api…"
pnpm -s -C services/api build

echo "🚀 PM2 (re)start…"
pm2 startOrReload ecosystem.config.js --update-env >/dev/null

echo "⏳ Attente de l'API sur ${HEALTH_URL} (timeout ${TIMEOUT}s)…"
if ! timeout "${TIMEOUT}" bash -c 'until curl -sf "'"${HEALTH_URL}"'" >/dev/null 2>&1; do sleep 0.5; done'; then
  echo "❌ L'API n'est pas healthy sous ${TIMEOUT}s."
  echo "— Derniers logs PM2 —"
  pm2 logs "${APP}" --lines 120 --nostream || true
  exit 1
fi

echo "✅ API OK :${PORT}"
# Affiche une ligne d'état utile
pm2 ls | awk -v app="${APP}" 'NR==1 || $2==app {print}'
# (optionnel) renvoyer le JSON de health
curl -sf "${HEALTH_URL}" || true
echo
