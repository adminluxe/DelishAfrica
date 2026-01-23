#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=(client courier)
TS="$(date +%Y%m%d_%H%M%S)"
BKP="$ROOT/.tonton_backups/eas_hard_relink_$TS"
mkdir -p "$BKP"

log(){ printf "\n[%s] %s\n" "$(date +%H:%M:%S)" "$*"; }

backup_app(){
  local a="$1"
  local d="$ROOT/apps/$a"
  mkdir -p "$BKP/$a"
  [ -d "$d/.eas" ] && cp -a "$d/.eas" "$BKP/$a/.eas" || true
  [ -f "$d/app.json" ] && cp -a "$d/app.json" "$BKP/$a/app.json" || true
  ls "$d"/app.config.* >/dev/null 2>&1 && cp -a "$d"/app.config.* "$BKP/$a/" || true
}

purge_appjson_projectid(){
  local a="$1"
  local f="$ROOT/apps/$a/app.json"
  [ -f "$f" ] || return 0
  node - <<NODE
const fs=require('fs');
const p="$f";
const j=JSON.parse(fs.readFileSync(p,'utf8'));
const expo=j.expo||j;
const before=expo?.extra?.eas?.projectId;

if (expo?.extra?.eas && typeof expo.extra.eas === 'object') {
  delete expo.extra.eas.projectId;
  if (Object.keys(expo.extra.eas).length===0) delete expo.extra.eas;
  if (Object.keys(expo.extra||{}).length===0) delete expo.extra;
}
fs.writeFileSync(p, JSON.stringify(j,null,2) + "\n");
const after=(j.expo||j)?.extra?.eas?.projectId;
console.log(\`[\${"$a"}] app.json projectId: \${before} -> \${after}\`);
NODE
}

log "Backup -> $BKP"
for a in "${APPS[@]}"; do backup_app "$a"; done

log "1) Purge extra.eas.projectId in app.json (si present)"
for a in "${APPS[@]}"; do purge_appjson_projectid "$a"; done

log "2) UNLINK FORCE: supprime apps/<app>/.eas (c'est LA cle)"
for a in "${APPS[@]}"; do
  rm -rf "$ROOT/apps/$a/.eas" || true
done

log "3) Relink EAS (INTERACTIF) - IMPORTANT:"
echo "➡️ Compte: delishafrica"
echo "➡️ Pour CLIENT: cree/lie un projet slug: delishafrica-client"
echo "➡️ Pour COURIER: cree/lie un projet slug: delishafrica-courier"
echo "➡️ (surtout PAS delishafrica-merchant)"
echo

for a in "${APPS[@]}"; do
  cd "$ROOT/apps/$a"
  echo "=== $a : eas project:init ==="
  eas project:init
  echo "=== $a : eas project:info ==="
  eas project:info || true
  echo
  echo "=== $a : .eas/project.json ==="
  cat "$ROOT/apps/$a/.eas/project.json" || true
  echo
done

log "Done. Backup: $BKP"
echo "Rollback: rsync -a '$BKP/<app>/' '$ROOT/apps/<app>/'"
