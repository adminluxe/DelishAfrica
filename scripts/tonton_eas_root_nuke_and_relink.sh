#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=(client courier)
TS="$(date +%Y%m%d_%H%M%S)"
BKP="$ROOT/.tonton_backups/eas_root_nuke_and_relink_$TS"
mkdir -p "$BKP"

log(){ printf "\n[%s] %s\n" "$(date +%H:%M:%S)" "$*"; }

backup_path(){
  local p="$1"
  if [ -e "$p" ]; then
    local base
    base="$(echo "$p" | sed 's#^/opt/delishafrica/monorepo/##')"
    mkdir -p "$BKP/$(dirname "$base")"
    cp -a "$p" "$BKP/$base" 2>/dev/null || true
  fi
}

log "0) Snapshot des .eas/project.json existants (AVANT)"
find "$ROOT" -maxdepth 4 -type f -path "*/.eas/project.json" -print -exec sed -n '1,120p' {} \; || true

log "1) Backup (root .eas + app configs + app .eas)"
backup_path "$ROOT/.eas"
for a in "${APPS[@]}"; do
  backup_path "$ROOT/apps/$a/.eas"
  backup_path "$ROOT/apps/$a/app.json"
  for f in "$ROOT/apps/$a"/app.config.*; do [ -f "$f" ] && backup_path "$f"; done
done

log "2) DEBRANCHE le lien EAS du MONOREPO ROOT (s'il existe)"
if [ -d "$ROOT/.eas" ]; then
  mv "$ROOT/.eas" "$BKP/root_.eas_MOVED"
  log "OK: $ROOT/.eas deplace vers $BKP/root_.eas_MOVED"
else
  log "OK: pas de $ROOT/.eas"
fi

log "3) Purge .eas des apps (client/courier)"
for a in "${APPS[@]}"; do
  rm -rf "$ROOT/apps/$a/.eas" || true
done

log "4) Relink EAS en forçant le project root (EAS_PROJECT_ROOT) + no-vcs"
echo "IMPORTANT pendant eas project:init :"
echo " - Compte: delishafrica"
echo " - CLIENT: creer/choisir le projet delishafrica/client (slug attendu: delishafrica-client)"
echo " - COURIER: creer/choisir le projet delishafrica/courier (slug attendu: delishafrica-courier)"
echo

for a in "${APPS[@]}"; do
  APPDIR="$ROOT/apps/$a"
  cd "$APPDIR"

  log "=== $a : eas project:init (root force) ==="
  EAS_NO_VCS=1 EAS_PROJECT_ROOT="$APPDIR" eas project:init

  log "=== $a : eas project:info (root force) ==="
  EAS_NO_VCS=1 EAS_PROJECT_ROOT="$APPDIR" eas project:info || true

  log "=== $a : cat .eas/project.json ==="
  cat "$APPDIR/.eas/project.json" || true
done

log "5) Snapshot des .eas/project.json existants (APRES)"
find "$ROOT" -maxdepth 4 -type f -path "*/.eas/project.json" -print -exec sed -n '1,120p' {} \; || true

log "DONE. Backup: $BKP"
echo "Rollback: restore depuis $BKP vers $ROOT"
