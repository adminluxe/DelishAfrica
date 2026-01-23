#!/usr/bin/env bash
# tonton_align_package_manager.sh - unify the packageManager field in package.json files across the monorepo.
# Usage: bash tonton_align_package_manager.sh [packageManager]
# If no packageManager is provided, defaults to npm.
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
EXPECTED=${1:-"npm"}
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP="${ROOT}/.tonton_backups/align_pkg_manager_${TIMESTAMP}"
mkdir -p "$BACKUP"

# Function to back up and patch a package.json file
patch_package_manager() {
  local file="$1"
  local expected="$2"
  local backup_dir="$3"
  # Only operate if the file exists and is a regular file
  if [[ -f "$file" ]]; then
    # Create corresponding backup directory and copy the file
    local rel="${file#$ROOT/}"
    mkdir -p "$backup_dir/$(dirname "$rel")"
    cp -a "$file" "$backup_dir/$rel"
    # Use node to update or insert the packageManager field
    node - <<NODE
const fs = require('fs');
const file = '$file';
const expected = '$expected';
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
if (pkg.packageManager !== expected) {
  pkg.packageManager = expected;
  fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
  console.log('Updated packageManager in', file);
} else {
  console.log('No change needed in', file);
}
NODE
  fi
}

# Patch root package.json
patch_package_manager "$ROOT/package.json" "$EXPECTED" "$BACKUP"

# Patch each app's package.json
for app in client merchant courier; do
  pkg_file="$ROOT/apps/$app/package.json"
  patch_package_manager "$pkg_file" "$EXPECTED" "$BACKUP"
  # Optionally regenerate the lockfile for the app (not executed here; instruct the user)
done

echo "Backup saved at: $BACKUP"
echo "packageManager has been set to '$EXPECTED' in all package.json files (root and apps)."
echo "After this, run 'npm install --legacy-peer-deps' in each app directory to regenerate node_modules and lockfile."
