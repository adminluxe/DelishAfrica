#!/usr/bin/env bash
set -euo pipefail

FILE="/opt/delishafrica/monorepo/apps/client/app/partner/[slug].tsx"
BACKUP_DIR="/opt/delishafrica/monorepo/.backups/slug-pointerevents-hammer-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [ ! -f "$FILE" ]; then
  echo "❌ Fichier introuvable: $FILE"
  exit 1
fi

echo "==> Backup: $BACKUP_DIR"
cp -a "$FILE" "$BACKUP_DIR/"

echo "==> Patching broken JSX sequences in [slug].tsx ..."

# Fix the exact broken pattern: "} pointerEvents="none"" -> "}} pointerEvents="none""
perl -pi -e 's/\}\s*pointerEvents="none"/}} pointerEvents="none"/g' "$FILE"
perl -pi -e "s/\}\s*pointerEvents='none'/}} pointerEvents='none'/g" "$FILE"

# Also fix self-closing tags where pointerEvents got injected before "/>"
# e.g. "... }} pointerEvents="none" />" is fine; we just ensure style block is closed.
# If some lines became "}}} pointerEvents", normalize triple braces to double.
perl -pi -e 's/\}\}\}\s*pointerEvents/}} pointerEvents/g' "$FILE"

echo "✅ Done. Showing remaining suspicious occurrences (if any):"
grep -n 'pointerEvents=' "$FILE" | head -n 30 || true

echo
echo "➡️ Clear cache for client now:"
echo "   cd /opt/delishafrica/monorepo/apps/client"
echo "   rm -rf .expo .turbo node_modules/.cache 2>/dev/null || true"
echo "   rm -rf /tmp/metro-* /tmp/haste-map-* 2>/dev/null || true"
echo "   pnpm dev -- --tunnel --port 8081 --clear"
