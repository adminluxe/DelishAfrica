#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <API_URL>"
  echo "Example: $0 https://xxxx.trycloudflare.com"
  exit 1
fi

API="$1"
ROOT="/opt/delishafrica/compose"
apps=("$ROOT/apps/client" "$ROOT/apps/courier" "$ROOT/apps/merchant")
ts="$(date +%Y%m%d-%H%M%S)"

for dir in "${apps[@]}"; do
  [[ -d "$dir" ]] || { echo "❌ Missing dir: $dir"; exit 1; }
  f="$dir/.env"
  [[ -f "$f" ]] && cp -a "$f" "$f.bak.$ts"

  cat > "$f" <<EOF
# DelishAfrica - DEMO (API override)
EXPO_PUBLIC_API_URL=https://api.delishafrica.me
API_URL=$API
API_BASE_URL=https://api.delishafrica.me
EOF

  echo "✅ $f -> $API"
done

echo "🎯 Done. API override = $API"
