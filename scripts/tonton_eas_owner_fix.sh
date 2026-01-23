#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
NOW="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/eas_owner_fix_$NOW"
APPS=(client merchant courier)

OWNER="delishafrica"

mkdir -p "$BK"

log(){ echo -e "\n[$(date '+%H:%M:%S')] $*"; }

backup(){
  local f="$1"
  [[ -f "$f" ]] || return 0
  mkdir -p "$BK/$(dirname "${f#$ROOT/}")"
  cp -a "$f" "$BK/${f#$ROOT/}"
}

patch_owner_and_ids(){
  local app="$1"
  local dir="$ROOT/apps/$app"
  local target=""

  if [[ -f "$dir/app.config.ts" ]]; then target="$dir/app.config.ts"; fi
  if [[ -z "$target" && -f "$dir/app.config.js" ]]; then target="$dir/app.config.js"; fi
  if [[ -z "$target" && -f "$dir/app.json" ]]; then target="$dir/app.json"; fi

  if [[ -z "$target" ]]; then
    log "⚠️  $app: aucun app.config.(ts|js) ni app.json trouvé -> skip"
    return 0
  fi

  backup "$target"
  log "🔧 $app: patch owner dans $(realpath --relative-to="$ROOT" "$target")"

  # owner: '...' / owner: "..."
  perl -0777 -pi -e "s/(\\bowner\\s*:\\s*)['\"][^'\"]*['\"]/\\1'$OWNER'/g" "$target"
  # \"owner\": \"...\"
  perl -0777 -pi -e "s/(\"owner\"\\s*:\\s*)\"[^\"]*\"/\\1\"$OWNER\"/g" "$target"

  # Pour merchant/courier : on retire projectId (car morts) pour forcer un nouveau project:init propre
  if [[ "$app" != "client" ]]; then
    log "🧹 $app: retrait projectId (IDs EAS morts) pour recréation propre"
    perl -0777 -pi -e "s/\\bprojectId\\s*:\\s*['\"][^'\"]+['\"]\\s*,?//g" "$target"
    perl -0777 -pi -e "s/\"projectId\"\\s*:\\s*\"[^\"]+\"\\s*,?//g" "$target"
  fi
}

fix_ci_in_env(){
  local app="$1"
  local dir="$ROOT/apps/$app"
  for f in "$dir/.env" "$dir/.env.local" "$dir/.env.development"; do
    [[ -f "$f" ]] || continue
    backup "$f"
    # supprime toute ligne CI=... (le GetEnv.NoBoolean vient souvent de CI vide / non bool)
    perl -pi -e 's/^\s*CI\s*=.*\n//mg' "$f"
  done
}

log "=== TONTON EAS OWNER FIX ==="
log "Backup: $BK"

for a in "${APPS[@]}"; do
  fix_ci_in_env "$a"
  patch_owner_and_ids "$a"
done

log "✅ owner forcé à '$OWNER' (3 apps)"
log "✅ projectId retiré pour merchant/courier (on va recréer des projets EAS propres)"
log ""
log "NEXT:"
log "  1) cd $ROOT/apps/merchant && npx -y eas-cli@latest project:init"
log "  2) cd $ROOT/apps/courier  && npx -y eas-cli@latest project:init"
log "  3) Tu récupères les 2 nouveaux projectId, et je te donne le script set-ids final."
