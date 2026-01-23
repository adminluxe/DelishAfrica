#!/usr/bin/env bash
set -euo pipefail

APPDIR="/opt/delishafrica/monorepo/apps/merchant"
PROFILE="${1:-development}"
FILE="$APPDIR/eas.json"
[ -f "$FILE" ] || { echo "ERROR: missing $FILE"; exit 1; }

TS="$(date +%Y%m%d_%H%M%S)"
BK="/opt/delishafrica/monorepo/.tonton_backups/patch_merchant_install_deps_$TS"
mkdir -p "$BK"
cp -a "$FILE" "$BK/eas.json"

PROFILE="$PROFILE" FILE="$FILE" node - <<'NODE'
const fs = require('fs');

const file = process.env.FILE;
const profile = process.env.PROFILE;

const j = JSON.parse(fs.readFileSync(file,'utf8'));
j.build = j.build || {};
j.build[profile] = j.build[profile] || {};
j.build[profile].env = Object.assign({}, j.build[profile].env || {}, {
  NPM_CONFIG_LEGACY_PEER_DEPS: "true",
  NPM_CONFIG_FUND: "false",
  NPM_CONFIG_AUDIT: "false",
  EXPO_DOCTOR_SKIP_DEPENDENCY_VERSION_CHECK: "1",
});
fs.writeFileSync(file, JSON.stringify(j, null, 2) + "\n");
console.log("Patched env for profile:", profile);
NODE

echo "Backup: $BK"
