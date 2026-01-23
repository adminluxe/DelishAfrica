#!/usr/bin/env bash
set -euo pipefail
ROOT="/opt/delishafrica/monorepo"
APPS=(client courier merchant)

echo "=== EAS DOCTOR ==="
echo "Root: $ROOT"
echo

command -v eas >/dev/null 2>&1 || { echo "eas CLI absent -> npm i -g eas-cli"; exit 1; }

for a in "${APPS[@]}"; do
  APPDIR="$ROOT/apps/$a"
  echo "---- $a ----"
  cd "$APPDIR"

  echo "[expo config]"
  npx expo config --type public --json | node - <<'NODE'
const fs=require('fs');
const cfg=JSON.parse(fs.readFileSync(0,'utf8'));
const e=cfg.expo||{};
const pid=e?.extra?.eas?.projectId;
console.log("slug:", e.slug);
console.log("owner:", e.owner);
console.log("scheme:", e.scheme);
console.log("ios.bundleIdentifier:", e?.ios?.bundleIdentifier);
console.log("extra.eas.projectId:", pid);
NODE

  echo
  echo "[eas project:info]"
  if eas project:info >/dev/null 2>&1; then
    eas project:info | sed -n '1,80p'
    echo "OK: projet EAS linké"
  else
    echo "KO: projet EAS PAS linké (ou projectId invalide)."
    echo "=> Fais:  cd $APPDIR && eas project:init"
  fi
  echo
done
