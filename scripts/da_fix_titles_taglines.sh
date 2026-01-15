#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
cd "$ROOT"

APP_CLIENT="apps/client"
if [[ -d "apps/courier" ]]; then APP_COURIER="apps/courier"
else APP_COURIER="apps/coursier"; fi
if [[ -d "apps/merchant" ]]; then APP_MERCHANT="apps/merchant"
else APP_MERCHANT="apps/marchand"; fi

find_home() {
  local A="$1"
  for f in \
    "$A/app/index.tsx" \
    "$A/app/(tabs)/index.tsx" \
    "$A/app/(home)/index.tsx" \
    "$A/app/(app)/index.tsx"; do
    [[ -f "$f" ]] && { echo "$f"; return 0; }
  done
  echo "$A/app/index.tsx"
}

patch_file() {
  local file="$1"
  local title="$2"
  local tagline="$3"

  [[ -f "$file" ]] || { echo "❌ Missing $file"; return 0; }

  cp -a "$file" "$file.bak_titles_$(date +%Y%m%d_%H%M%S)"

  # Replace both __TITLE__/__TAGLINE__ and _TITLE_/_TAGLINE_
  perl -0777 -i -pe "s/__TITLE__|_TITLE_/$title/g; s/__TAGLINE__|_TAGLINE_/$tagline/g" "$file"

  echo "✅ Patched: $file"
}

F1="$(find_home "$APP_CLIENT")"
F2="$(find_home "$APP_COURIER")"
F3="$(find_home "$APP_MERCHANT")"

patch_file "$F1" "DelishAfrica • Client"  "Découvrir. Commander. Suivre."
patch_file "$F2" "DelishAfrica • Courier" "Rapide. Clair. Mission."
patch_file "$F3" "DelishAfrica • Merchant" "Cuisine. Commandes. Production."
