#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=(client courier)
TS="$(date +%Y%m%d_%H%M%S)"
BKP="$ROOT/.tonton_backups/fix_eas_projectid_$TS"

mkdir -p "$BKP"
echo "[backup] -> $BKP"

backup_one(){
  local app="$1"
  local dir="$ROOT/apps/$app"
  mkdir -p "$BKP/$app"
  [ -f "$dir/app.json" ] && cp -a "$dir/app.json" "$BKP/$app/app.json" || true
  [ -f "$dir/app.config.js" ] && cp -a "$dir/app.config.js" "$BKP/$app/app.config.js" || true
  [ -f "$dir/app.config.ts" ] && cp -a "$dir/app.config.ts" "$BKP/$app/app.config.ts" || true
  [ -f "$dir/app.config.mjs" ] && cp -a "$dir/app.config.mjs" "$BKP/$app/app.config.mjs" || true
}

purge_from_appjson(){
  local app="$1"
  local dir="$ROOT/apps/$app"
  local f="$dir/app.json"
  [ -f "$f" ] || { echo "[$app] app.json absent -> skip"; return 0; }

  node - <<NODE
const fs=require('fs');
const p="$f";
const j=JSON.parse(fs.readFileSync(p,'utf8'));
const expo=j.expo||j;
const before=expo?.extra?.eas?.projectId;

if (expo?.extra?.eas && typeof expo.extra.eas === 'object') {
  delete expo.extra.eas.projectId;
  // nettoie objets vides
  if (Object.keys(expo.extra.eas).length===0) delete expo.extra.eas;
  if (Object.keys(expo.extra||{}).length===0) delete expo.extra;
}
fs.writeFileSync(p, JSON.stringify(j,null,2) + "\n");
const after=(j.expo||j)?.extra?.eas?.projectId;
console.log(\`[$app] app.json projectId: \${before} -> \${after}\`);
NODE
}

echo "[1/4] backup configs"
for a in "${APPS[@]}"; do backup_one "$a"; done

echo "[2/4] purge projectId (app.json)"
for a in "${APPS[@]}"; do purge_from_appjson "$a"; done

echo "[3/4] grep residual projectId in config files (si app.config.* gère extra.eas.projectId)"
for a in "${APPS[@]}"; do
  dir="$ROOT/apps/$a"
  echo "---- $a ----"
  grep -RIn --exclude-dir=node_modules --exclude=app.json "eas.*projectId|projectId" "$dir/app.config."* 2>/dev/null || echo "(no app.config.* projectId found)"
done

echo
echo "[4/4] relink EAS (INTERACTIF) :"
echo "=> Choisis le compte: delishafrica"
echo "=> Crée/lie les projets: delishafrica/client et delishafrica/courier"
echo
for a in "${APPS[@]}"; do
  cd "$ROOT/apps/$a"
  echo "=== $a : eas project:init ==="
  eas project:init
  echo
  echo "=== $a : eas project:info ==="
  eas project:info || true
  echo
done

echo "✅ Done. Backup: $BKP"
echo "Rollback: restore les fichiers depuis $BKP/<app>/ vers apps/<app>/"
