#!/usr/bin/env bash
set -euo pipefail

APPJSON="/opt/delishafrica/monorepo/apps/courier/app.json"
API_URL="${1:-https://api.delishafrica.me}"
GMAPS_KEY="${2:-}"

[ -f "$APPJSON" ] || { echo "[ERR] app.json introuvable: $APPJSON"; exit 1; }
jq --arg api "$API_URL" '.expo.extra.API_BASE_URL=$api' "$APPJSON" > "$APPJSON.tmp" && mv "$APPJSON.tmp" "$APPJSON"

if [ -n "$GMAPS_KEY" ]; then
  jq --arg k "$GMAPS_KEY" '.expo.extra.GMAPS_API_KEY=$k' "$APPJSON" > "$APPJSON.tmp" && mv "$APPJSON.tmp" "$APPJSON"
fi

echo "[OK] API_BASE_URL=$(jq -r '.expo.extra.API_BASE_URL' $APPJSON)"
echo "[OK] GMAPS_API_KEY=$(jq -r '.expo.extra.GMAPS_API_KEY' $APPJSON)"
