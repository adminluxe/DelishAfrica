#!/usr/bin/env bash
# tonton_clean_eas_project_id.sh - Remove EAS_PROJECT_ID definitions from .npmrc files and npm config.
# This script backs up every `.npmrc` file in the monorepo, deletes any line defining EAS_PROJECT_ID,
# and deletes the global npm configuration for EAS_PROJECT_ID. This should help avoid slug mismatch
# errors during EAS builds that arise when EAS_PROJECT_ID overrides the per-app configuration.

set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP="${ROOT}/.tonton_backups/clean_eas_project_id_${TIMESTAMP}"
mkdir -p "$BACKUP"

cleanup_npmrc() {
  local file="$1"
  if [[ -f "$file" ]]; then
    local rel="${file#$ROOT/}"
    mkdir -p "$BACKUP/$(dirname "$rel")"
    cp -a "$file" "$BACKUP/$rel"
    # Delete lines defining EAS_PROJECT_ID
    sed -i '/^EAS_PROJECT_ID/d' "$file"
    echo "Removed EAS_PROJECT_ID from $file"
  fi
}

# Find and clean all .npmrc files in the monorepo (root and subdirectories)
while IFS= read -r npmrc; do
  cleanup_npmrc "$npmrc"
done < <(find "$ROOT" -type f -name ".npmrc")

# Remove the EAS_PROJECT_ID config globally if present
if npm config get EAS_PROJECT_ID &>/dev/null; then
  npm config delete EAS_PROJECT_ID || true
  echo "Deleted global npm config EAS_PROJECT_ID"
else
  echo "No global npm config EAS_PROJECT_ID set"
fi

echo "Backup saved at: $BACKUP"
echo "EAS_PROJECT_ID definitions have been removed from all .npmrc files and npm config."
