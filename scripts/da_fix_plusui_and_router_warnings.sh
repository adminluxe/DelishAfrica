#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=(client courier merchant)
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/backups/ui_plusui_router_fix_$TS"
mkdir -p "$BK"

log(){ echo "[$(date +%H:%M:%S)] $*"; }

for a in "${APPS[@]}"; do
  APPDIR="$ROOT/apps/$a"
  ROUTES="$APPDIR/app"

  if [ ! -d "$ROUTES" ]; then
    log "ERROR: $a: dossier app introuvable: $ROUTES"
    exit 1
  fi

  log "== $a: backup =="
  mkdir -p "$BK/$a"
  cp -a "$ROUTES" "$BK/$a/app"

  # Canon: on veut _ui comme source
  if [ -d "$ROUTES/_ui" ]; then
    SRC="$ROUTES/_ui"
  elif [ -d "$ROUTES/ui" ]; then
    log "$a: app/ui existe -> renommage en app/_ui"
    mv "$ROUTES/ui" "$ROUTES/_ui"
    SRC="$ROUTES/_ui"
  else
    # si +ui existe déjà mais pas _ui, on le prend et on le met en _ui
    if [ -d "$ROUTES/+ui" ]; then
      log "$a: app/+ui existe sans app/_ui -> copie vers app/_ui"
      mkdir -p "$ROUTES/_ui"
      rsync -a "$ROUTES/+ui/" "$ROUTES/_ui/"
      SRC="$ROUTES/_ui"
    else
      log "ERROR: $a: aucun dossier UI trouvé (attendu app/_ui ou app/ui ou app/+ui)"
      exit 1
    fi
  fi

  log "== $a: ajouter export default (noop) dans _ui pour calmer Expo Router =="
  find "$SRC" -maxdepth 1 -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -print0 \
    | while IFS= read -r -d '' f; do
        if ! rg -q "export default" "$f"; then
          cat >> "$f" <<'NOOP'

export default function _ui_noop_route() { return null; }
NOOP
        fi
      done

  log "== $a: créer bridge app/+ui/* -> app/_ui/* =="
  mkdir -p "$ROUTES/+ui"

  find "$SRC" -maxdepth 1 -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -print0 \
    | while IFS= read -r -d '' f; do
        base="$(basename "$f")"
        name="${base%.*}"
        ext="${base##*.}"
        out="$ROUTES/+ui/$base"

        cat > "$out" <<BRIDGE
import * as mod from "../_ui/$name";
export * from "../_ui/$name";
export default (mod as any).default ?? function _ui_noop_bridge(){ return null; };
BRIDGE
      done

  log "== $a: sanity check (doit trouver les fichiers) =="
  ls -la "$ROUTES/+ui" >/dev/null
done

log "OK. Prochaine étape: restart Expo (Ctrl+C puis pnpm dev ... --clear) dans les 3 apps."
