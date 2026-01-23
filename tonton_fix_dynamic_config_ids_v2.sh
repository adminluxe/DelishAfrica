#!/usr/bin/env bash
# tonton_fix_dynamic_config_ids_v2.sh
# This script updates extra.eas.projectId and projectId assignments
# in app.config.ts and app.config.base.ts files for client, merchant,
# and courier apps. It does not rely on associative arrays to avoid
# issues with 'set -u'.
# A backup of each modified file is stored under .tonton_backups.

set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="${ROOT}/.tonton_backups/fix_dynamic_config_ids_${TS}"
mkdir -p "$BACKUP"

# Define expected project IDs for each app
CLIENT_ID="394e7d6f-559b-4536-81a9-fbc0dbc0c68f"
MERCHANT_ID="292e5d9e-9dbe-4dfb-ba4f-ed80cfc72bbc"
COURIER_ID="5d1b6b85-9e64-4cc2-9cbe-7d69f8ccc84"

fix_app() {
  local app="$1"
  local expected_id="$2"
  for cfg in "app.config.ts" "app.config.base.ts"; do
    local file="$ROOT/apps/$app/$cfg"
    if [[ -f "$file" ]]; then
      local rel="${file#$ROOT/}"
      mkdir -p "$BACKUP/$(dirname "$rel")"
      cp -a "$file" "$BACKUP/$rel"
      # Replace extra.eas.projectId assignments with expected ID
      perl -0777 -pi -e "s/(extra\s*\.\s*eas\s*\.\s*projectId\s*[:=]\s*[\"\'])([^\"\']+)([\"\'])/\$1${expected_id}\$3/g" "$file"
      # Replace generic projectId assignments with expected ID
      perl -0777 -pi -e "s/(projectId\s*[:=]\s*[\"\'])([^\"\']+)([\"\'])/\$1${expected_id}\$3/g" "$file"
      echo "Updated projectId in $file"
    fi
  done
}

# Apply fixes per application
fix_app "client" "$CLIENT_ID"
fix_app "merchant" "$MERCHANT_ID"
fix_app "courier" "$COURIER_ID"

echo "Backups stored in: $BACKUP"
