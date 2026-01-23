#!/usr/bin/env bash
# tonton_cleanup_unexpected_dirs.sh
# This script scans each app directory (client, merchant, courier) in the DelishAfrica monorepo
# and moves any nested directories that look like separate Expo projects (contain app.json or package.json)
# but whose folder name does not match the expected slug. These are likely remnants of previous
# misalignments (e.g. apps/client/delishafrica-merchant). Each moved directory is backed up under
# .tonton_backups/unexpected_dirs_<timestamp> for safety.

set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="${ROOT}/.tonton_backups/unexpected_dirs_${TS}"
mkdir -p "$BACKUP"

for app in client merchant courier; do
  app_dir="$ROOT/apps/$app"
  expected_slug="$app"
  [ -d "$app_dir" ] || continue
  for dir in "$app_dir"/*; do
    [ -d "$dir" ] || continue
    base="$(basename "$dir")"
    # Skip node_modules and .eas directories
    if [[ "$base" == "node_modules" || "$base" == ".eas" ]]; then
      continue
    fi
    # If directory name matches expected slug, keep it
    if [[ "$base" == "$expected_slug" ]]; then
      continue
    fi
    # If directory contains app.json or package.json, it's likely a nested project
    if [[ -f "$dir/app.json" || -f "$dir/package.json" ]]; then
      echo "Found unexpected project directory $dir (expected slug $expected_slug). Backing up."
      mkdir -p "$BACKUP/apps/$app"
      mv "$dir" "$BACKUP/apps/$app/"  # move the whole directory to backup
    fi
  done
done

echo "Backup of unexpected directories created at: $BACKUP"
echo "Cleanup complete."
