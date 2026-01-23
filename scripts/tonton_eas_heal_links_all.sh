#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/eas_heal_links_$TS"
mkdir -p "$BK"

# Canonical projectIds (VALIDES d'apres tes outputs)
CLIENT_ID="394e7d6f-559b-4536-81a9-fbc0cdb0c68f"
MERCHANT_ID="292e5d9e-9dbe-4dfb-ba4f-ed80cf2e2bbc"
COURIER_ID="5d1b6b85-9e64-4cc2-9cbe-7d698feccc84"

# Known bad IDs we want to eradicate if found in live config files
BAD_IDS=(
  "dae37d7c-369e-436c-a4d1-ba62bf8cbc6f"
)

need_cmd(){ command -v "$1" >/dev/null 2>&1; }

backup_path(){
  local p="$1"
  [ -e "$p" ] || return 0
  local rel="${p#$ROOT/}"
  mkdir -p "$BK/$(dirname "$rel")"
  cp -a "$p" "$BK/$rel"
}

print_hdr(){ printf "\n==== %s ====\n" "$*"; }

# 1) Root .eas poisoning: backup + remove (EAS doit etre par-app dans ce monorepo)
print_hdr "1) ROOT .eas cleanup (anti-pollution)"
if [ -d "$ROOT/.eas" ]; then
  backup_path "$ROOT/.eas"
  mv "$ROOT/.eas" "$BK/root_.eas_moved"
  echo "Moved $ROOT/.eas -> $BK/root_.eas_moved"
else
  echo "No root .eas found (OK)"
fi

# 2) Patch live config files only (NO backups)
patch_app(){
  local app="$1"
  local expected_id="$2"
  local dir="$ROOT/apps/$app"
  [ -d "$dir" ] || { echo "SKIP missing $dir"; return 0; }

  print_hdr "2) APP=$app expected_id=$expected_id"
  cd "$dir"

  # live files only
  local files=()
  for f in app.config.ts app.config.base.ts app.json eas.json; do
    [ -f "$f" ] && files+=("$f")
  done

  # backup live files
  for f in "${files[@]}"; do backup_path "$dir/$f"; done

  # Replace any other known projectIds with the expected one (only in live files)
  local ids_all=("$CLIENT_ID" "$MERCHANT_ID" "$COURIER_ID" "${BAD_IDS[@]}")
  for f in "${files[@]}"; do
    for id in "${ids_all[@]}"; do
      if [ "$id" != "$expected_id" ]; then
        sed -i "s/$id/$expected_id/g" "$f" || true
      fi
    done
  done

  # Rewrite per-app .eas/project.json as source-of-truth for EAS linking
  mkdir -p ".eas"
  backup_path "$dir/.eas/project.json"
  cat > ".eas/project.json" <<JSON
{
  "accountName": "delishafrica",
  "projectName": "$app",
  "projectId": "$expected_id"
}
JSON

  # Patch eas.json env (tolerant install deps) for development profile (safe)
  if [ -f "eas.json" ] && need_cmd node; then
    PROFILE="development" FILE="eas.json" node - <<'NODE'
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
  EXPO_DOCTOR_SKIP_DEPENDENCY_VERSION_CHECK: "1"
});
fs.writeFileSync(file, JSON.stringify(j,null,2) + "\n");
NODE
  fi

  # Show resolved config
  print_hdr "RESOLVED expo config ($app)"
  npx expo config --type public --json | node -e '
    const fs=require("fs");const j=JSON.parse(fs.readFileSync(0,"utf8"));
    console.log({app:"'"$app"'", slug:j.slug, projectId:j.extra?.eas?.projectId, bundle:j.ios?.bundleIdentifier, scheme:j.scheme});
  '
}

patch_app client  "$CLIENT_ID"
patch_app merchant "$MERCHANT_ID"
patch_app courier  "$COURIER_ID"

print_hdr "DONE"
echo "Backup saved at: $BK"
echo "IMPORTANT: Ne lance plus eas project:init depuis le root."
echo "Lance EAS depuis /opt/delishafrica/monorepo/apps/<app>."
