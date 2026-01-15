#!/usr/bin/env bash
set -euo pipefail

echo ">>> PM2 describe delish-api"
pm2 describe delish-api || { echo "❌ Process delish-api introuvable dans PM2"; exit 1; }

echo
echo ">>> Récap rapide du script et du cwd :"
pm2 describe delish-api | grep -E "script path|script|cwd|args" || true

echo
echo ">>> Recherche du endpoint health dans le code source (hors node_modules/dist) :"
ROOT="/opt/delishafrica"

grep -RIn "@Get('health')" "$ROOT" \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=.turbo \
  | head -n 20 || echo "⚠️ aucun @Get('health') trouvé dans les sources (hors dist)"

echo
echo ">>> Fin du diagnostic."
