#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPDIR="$ROOT/apps/courier"
NEW_ID="${1:-5d1b6b85-9e64-4cc2-9cbe-7d698feccc84}"

cd "$APPDIR"

CUR_ID="$(npx expo config --type public --json 2>/dev/null | node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(0,"utf8"));process.stdout.write(j.extra?.eas?.projectId||"")' || true)"
echo "COURIER CURRENT_ID=$CUR_ID"
echo "COURIER NEW_ID=$NEW_ID"

TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/fix_courier_projectid_$TS"
mkdir -p "$BK"

FILES=( "app.config.ts" "app.config.base.ts" "app.json" ".eas/project.json" )
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    mkdir -p "$BK/$(dirname "$f")"
    cp -a "$f" "$BK/$f"
  fi
done

if [ -n "$CUR_ID" ]; then
  for f in "${FILES[@]}"; do
    [ -f "$f" ] || continue
    sed -i "s/$CUR_ID/$NEW_ID/g" "$f" || true
  done
else
  echo "WARN: current id not detected; patch .eas/project.json only if present."
  if [ -f ".eas/project.json" ]; then
    NEW_ID="$NEW_ID" node - <<'NODE'
const fs=require('fs');
const p='.eas/project.json';
const j=JSON.parse(fs.readFileSync(p,'utf8'));
j.projectId=process.env.NEW_ID;
fs.writeFileSync(p, JSON.stringify(j,null,2)+'\n');
NODE
  fi
fi

echo "== RECHECK expo config =="
npx expo config --type public --json | node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(0,"utf8"));console.log({app:"courier",slug:j.slug,projectId:j.extra?.eas?.projectId,bundle:j.ios?.bundleIdentifier,scheme:j.scheme});'
echo "Backup: $BK"
