#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then exec /bin/bash "$0" "$@"; fi
set -Eeuo pipefail
ID="${1:-}"; OUT="${2:-./data/exports/menu_after_import.csv}"
[[ -n "$ID" ]] || { echo "Usage: $0 <MERCHANT_ID> [OUT.csv]"; exit 1; }
mkdir -p "$(dirname "$OUT")"
curl -fsS "http://localhost:4001/api/merchants/$ID/menu" | jq -r '
 (["name","price","category","description","spicy_level","imageUrl","available"] | @csv),
 (.[] | [
   .name, (.price|tostring), (.category//""), (.description//""),
   (.spicy_level//""), (.imageUrl//""),
   (if .available==true then "true" else "false" end)
 ] | @csv)
' > "$OUT"
echo "✓ Export : $OUT"
