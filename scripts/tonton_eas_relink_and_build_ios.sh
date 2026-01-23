#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
APPS=("merchant" "courier")

log(){ echo -e "\n[$(date '+%H:%M:%S')] $*"; }
die(){ log "❌ $*"; exit 1; }

backup_file(){
  local f="$1"
  [[ -f "$f" ]] || return 0
  cp -a "$f" "$f.bak.$(date +%Y%m%d_%H%M%S)"
  log "🧷 backup: $f -> $f.bak.*"
}

# Supprime uniquement la propriété projectId dans extra.eas (TS/JS) sans casser le reste
strip_projectId_ts(){
  local f="$1"
  [[ -f "$f" ]] || return 0
  backup_file "$f"
  perl -0777 -i -pe 's/\n?[ \t]*projectId[ \t]*:[ \t]*([\"\x27])[^\"\x27]+\1[ \t]*,?[ \t]*\n/\n/gm' "$f"
}

# Supprime extra.eas.projectId dans un JSON
strip_projectId_json(){
  local f="$1"
  [[ -f "$f" ]] || return 0
  backup_file "$f"
  node - <<'NODE'
const fs=require("fs");
const p=process.env.JSON_PATH;
const j=JSON.parse(fs.readFileSync(p,"utf8"));
if (j.expo?.extra?.eas?.projectId) delete j.expo.extra.eas.projectId;
fs.writeFileSync(p, JSON.stringify(j,null,2)+"\n");
NODE
}

whoami_check(){
  log "🔎 EAS whoami"
  local w
  w="$(npx -y eas-cli@latest whoami --non-interactive 2>/dev/null || true)"
  [[ "$w" == "delishafrica" ]] || die "EAS pas loggé sur delishafrica (whoami=$w). Fais: npx -y eas-cli@latest login"
  log "✅ whoami=$w"
}

expo_show(){
  local dir="$1"
  ( cd "$dir"
    npx expo config --json \
      | node -e 'const c=JSON.parse(require("fs").readFileSync(0,"utf8")); console.log({owner:c.owner, slug:c.slug, projectId:c.extra?.eas?.projectId});'
  )
}

remote_info_ok(){
  local dir="$1"
  ( cd "$dir"
    npx -y eas-cli@latest project:info --non-interactive >/dev/null 2>&1
  )
}

relink_one(){
  local app="$1"
  local dir="$ROOT/apps/$app"
  [[ -d "$dir" ]] || die "Dossier introuvable: $dir"

  log "===================="
  log "APP: $app"
  log "DIR: $dir"
  log "Config actuelle:"
  expo_show "$dir" || true

  if remote_info_ok "$dir"; then
    log "✅ Remote OK: eas project:info fonctionne déjà pour $app"
    return 0
  fi

  log "⚠️ Remote KO pour $app (project:info échoue). On relink/recrée le projet EAS."
  log "1) On retire projectId de la config (pour forcer project:init à relier un projet existant ou en créer un nouveau)"

  # fichiers possibles
  local cfg_ts=""
  for f in app.config.ts app.config.js app.config.mjs; do
    [[ -f "$dir/$f" ]] && cfg_ts="$dir/$f" && break
  done

  if [[ -n "$cfg_ts" ]]; then
    log "→ patch TS/JS: $cfg_ts"
    strip_projectId_ts "$cfg_ts"
  fi

  if [[ -f "$dir/app.json" ]]; then
    log "→ patch JSON: $dir/app.json"
    JSON_PATH="$dir/app.json" strip_projectId_json "$dir/app.json"
  fi

  log "2) Lance project:init (INTERACTIF) : accepte les valeurs par défaut."
  log "   - Organisation: delishafrica"
  log "   - Slug: garde celui proposé (doit être delishafrica-$app)"
  log "   - Si on te propose de créer: YES"
  ( cd "$dir" && npx -y eas-cli@latest project:init )

  log "3) Vérif remote + config après init"
  ( cd "$dir" && npx -y eas-cli@latest project:info )
  log "Config après init:"
  expo_show "$dir"
}

build_ios_dev(){
  local app="$1"
  local dir="$ROOT/apps/$app"
  log "🚀 EAS BUILD iOS dev: $app"
  ( cd "$dir" && npx -y eas-cli@latest build -p ios --profile development --clear-cache --non-interactive )
}

main(){
  whoami_check

  for app in "${APPS[@]}"; do
    relink_one "$app"
  done

  log "✅ Relink terminé. On rebuild iOS dev (merchant + courier)."
  for app in "${APPS[@]}"; do
    build_ios_dev "$app"
  done

  log "✅ DONE. Pour récupérer les liens:"
  log "   cd $ROOT/apps/merchant && npx -y eas-cli@latest build:list -p ios --limit 3"
  log "   cd $ROOT/apps/courier  && npx -y eas-cli@latest build:list -p ios --limit 3"
}

main "$@"
