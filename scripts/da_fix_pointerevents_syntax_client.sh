#!/usr/bin/env bash
set -euo pipefail

FILE="/opt/delishafrica/monorepo/apps/client/app/partner/[slug].tsx"
BACKUP="/opt/delishafrica/monorepo/.backups/pointerevents-fix-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"

if [ ! -f "$FILE" ]; then
  echo "❌ Fichier introuvable: $FILE"
  echo "➡️ Vérifie le path exact affiché dans l’erreur Metro et remplace FILE dans ce script."
  exit 1
fi

echo "==> Backup: $BACKUP"
cp -a "$FILE" "$BACKUP/"

# Fix 1: cas exact visible sur ta capture: "... opacity: 0.35 } pointerEvents="none""
perl -0777 -i -pe '
  s/style=\{\{([\s\S]*?)\}\s*pointerEvents=/style={{$1}} pointerEvents=/g;
' "$FILE"

# Fix 2: rattrape un autre pattern possible: "... } pointerEvents="none"" (sans le "style={{" détecté)
perl -0777 -i -pe '
  s/\}\s*pointerEvents="/}} pointerEvents="/g;
' "$FILE"

echo "✅ Patch appliqué sur: $FILE"
echo "➡️ Relance ensuite Metro avec clear cache:"
echo "   cd /opt/delishafrica/monorepo/apps/client && pnpm dev -- --tunnel --port 8081 --clear"
