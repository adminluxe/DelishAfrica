#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/compose"
API="https://api.delishafrica.me"

apps=(
  "$ROOT/apps/client"
  "$ROOT/apps/courier"
  "$ROOT/apps/merchant"
)

ts="$(date +%Y%m%d-%H%M%S)"

for dir in "${apps[@]}"; do
  if [[ ! -d "$dir" ]]; then
    echo "❌ Dossier introuvable: $dir"
    exit 1
  fi

  f="$dir/.env"
  if [[ -f "$f" ]]; then
    cp -a "$f" "$f.bak.$ts"
  fi

  cat > "$f" <<EOF
# DelishAfrica - DEMO (HTTPS)
EXPO_PUBLIC_API_URL=https://api.delishafrica.me
API_URL=$API
API_BASE_URL=https://api.delishafrica.me
EOF

  echo "✅ OK: $f (backup: ${f}.bak.${ts} si existait)"
done

echo "🎯 Terminé. API DEMO = $API"

