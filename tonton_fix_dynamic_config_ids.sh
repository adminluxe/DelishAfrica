#!/usr/bin/env bash
# tonton_fix_dynamic_config_ids.sh
# This script updates the `extra.eas.projectId` and `projectId` assignments in the dynamic
# configuration files (app.config.ts and app.config.base.ts) for each app in the
# DelishAfrica monorepo. It replaces any existing projectId values with the
# expected IDs for client, merchant, and courier.
# A backup of each modified file is stored under `.tonton_backups` with a timestamp.

set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP="${ROOT}/.tonton_backups/fix_dynamic_config_ids_${TIMESTAMP}"
mkdir -p "$BACKUP"

# Map expected projectId values per app
declare -A ID_MAP
ID_MAP[client]="394e7d6f-559b-4536-81a9-fbc0dbc0c68f"
ID_MAP[merchant]="292e5d9e-9dbe-4dfb-ba4f-ed80cfc72bbc"
ID_MAP[courier]="5d1b6b85-9e64-4cc2-9cbe-7d69f8ccc84"

# Iterate over each app and apply replacements
for app in "${!ID_MAP[@]}"; do
  expected="${ID_MAP[$app]}"
  for config_file in app.config.ts app.config.base.ts; do
    file="$ROOT/apps/$app/$config_file"
    if [[ -f "$file" ]]; then
      # Backup the file
      rel="${file#$ROOT/}"
      mkdir -p "$BACKUP/$(dirname "$rel")"
      cp -a "$file" "$BACKUP/$rel"
      # Replace extra.eas.projectId assignments
      perl -0777 -pi -e "s/(extra\s*\.\s*eas\s*\.\s*projectId\s*[:=]\s*[\"\'])([^\"\']+)([\"\'])/$1${expected}$3/g" "$file"
      # Replace any projectId assignments (outside of extra.eas)
      perl -0777 -pi -e "s/(projectId\s*[:=]\s*[\"\'])([^\"\']+)([\"\'])/$1${expected}$3/g" "$file"
      echo "Updated projectId in $file"
    fi
  done
done

echo "Backup saved at: $BACKUP"
