#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=(client courier)
TS="$(date +%Y%m%d_%H%M%S)"
BKP="$ROOT/.tonton_backups/eas_relink_$TS"
mkdir -p "$BKP"

echo "[1/5] Backup .eas + configs -> $BKP"
for a in "${APPS[@]}"; do
  APPDIR="$ROOT/apps/$a"
  mkdir -p "$BKP/$a"
  [ -d "$APPDIR" ] || { echo "Missing $APPDIR"; exit 1; }
  [ -d "$APPDIR/.eas" ] && cp -a "$APPDIR/.eas" "$BKP/$a/.eas" || true
  [ -f "$APPDIR/eas.json" ] && cp -a "$APPDIR/eas.json" "$BKP/$a/eas.json" || true
  [ -f "$APPDIR/app.json" ] && cp -a "$APPDIR/app.json" "$BKP/$a/app.json" || true
  [ -f "$APPDIR/app.config.js" ] && cp -a "$APPDIR/app.config.js" "$BKP/$a/app.config.js" || true
  [ -f "$APPDIR/app.config.ts" ] && cp -a "$APPDIR/app.config.ts" "$BKP/$a/app.config.ts" || true
done

echo "[2/5] S'assure que eas.json existe dans chaque app (copie depuis merchant si besoin)"
for a in "${APPS[@]}"; do
  APPDIR="$ROOT/apps/$a"
  if [ ! -f "$APPDIR/eas.json" ] && [ -f "$ROOT/apps/merchant/eas.json" ]; then
    cp -a "$ROOT/apps/merchant/eas.json" "$APPDIR/eas.json"
    echo "  -> Copied eas.json to $a"
  fi
done

echo "[3/5] Purge ancien lien EAS (supprime .eas) pour forcer un relink propre"
for a in "${APPS[@]}"; do
  APPDIR="$ROOT/apps/$a"
  rm -rf "$APPDIR/.eas" || true
done

echo "[4/5] Relink EAS (INTERACTIF) :"
echo "👉 Pour chaque app, choisis le compte: delishafrica"
echo "👉 Crée/lie le projet: delishafrica/$APP (ex: delishafrica/client, delishafrica/courier)"
echo

for a in "${APPS[@]}"; do
  APPDIR="$ROOT/apps/$a"
  echo "=== eas project:init ($a) ==="
  cd "$APPDIR"
  eas project:init
  echo
  echo "=== eas project:info ($a) ==="
  eas project:info || true
  echo
done

echo "[5/5] Vérif projectId (extra.eas.projectId) si présent dans config:"
for a in "${APPS[@]}"; do
  APPDIR="$ROOT/apps/$a"
  echo "---- $a ----"
  grep -RIn --exclude-dir=node_modules "extra\\.eas\\.projectId" "$APPDIR" || echo "(not found in files - peut être géré via .eas link)"
done

echo
echo "✅ Done. Backup: $BKP"
echo "Rollback rapide: restore $BKP/<app>/* vers apps/<app>/"
