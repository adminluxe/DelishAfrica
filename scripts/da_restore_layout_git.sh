#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
cd "$ROOT"

TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/backups/layout_restore_$TS"
mkdir -p "$BK"

echo "📦 Backup -> $BK"
for app in client courier merchant; do
  f="apps/$app/app/_layout.tsx"
  if [[ -f "$f" ]]; then
    mkdir -p "$BK/apps/$app/app"
    cp -f "$f" "$BK/apps/$app/app/_layout.tsx"
  fi
done

echo "🧼 git restore des layouts (retour TSX clean)"
git restore --source=HEAD -- \
  apps/client/app/_layout.tsx \
  apps/courier/app/_layout.tsx \
  apps/merchant/app/_layout.tsx

echo "✅ OK. Tu peux relancer expo ensuite."
