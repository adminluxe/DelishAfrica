#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
APPS=("merchant" "courier")

log(){ echo -e "\n[$(date '+%H:%M:%S')] $*"; }
die(){ log "❌ $*"; exit 1; }

backup(){
  local f="$1"
  [[ -f "$f" ]] || return 0
  cp -a "$f" "$f.bak.$(date +%Y%m%d_%H%M%S)"
  log "🧷 backup: $f"
}

strip_projectId_from_appjson(){
  local dir="$1"
  local f="$dir/app.json"
  [[ -f "$f" ]] || return 0
  backup "$f"
  node -e "const fs=require('fs'); const p='$f'; const j=JSON.parse(fs.readFileSync(p,'utf8')); if(j.expo?.extra?.eas?.projectId){ delete j.expo.extra.eas.projectId; } fs.writeFileSync(p, JSON.stringify(j,null,2)+'\n'); console.log('OK: removed projectId from', p);"
}

strip_projectId_from_appconfig(){
  local dir="$1"
  local f=""
  for cand in app.config.ts app.config.js app.config.mjs; do
    [[ -f "$dir/$cand" ]] && f="$dir/$cand" && break
  done
  [[ -n "$f" ]] || return 0
  backup "$f"
  # supprime projectId: <anything> (même si env), gère inline et multi-lignes simples
  perl -pi -e 's/\bprojectId\s*:\s*[^,\n}]+,?\s*//g' "$f"
  log "OK: removed projectId from $f"
}

clear_eas_cache(){
  local dir="$1"
  local f="$dir/.eas/project.json"
  [[ -f "$f" ]] || return 0
  backup "$f"
  rm -f "$f"
  log "OK: removed $f"
}

show_expo_config(){
  local dir="$1"
  ( cd "$dir"
    npx expo config --json | node -e "const c=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log({owner:c.owner, slug:c.slug, projectId:c.extra?.eas?.projectId});"
  )
}

ensure_unlinked(){
  local dir="$1"
  local out
  out="$(show_expo_config "$dir")"
  echo "$out"
  if echo "$out" | rg -q "projectId.*[0-9a-fA-F-]{8,}"; then
    log "🔎 Il reste un projectId quelque part, on te dump les occurrences:"
    rg -n "extra\.eas\.projectId|projectId|EAS_PROJECT_ID|EXPO_PUBLIC_EAS_PROJECT_ID" "$dir" || true
    die "projectId toujours présent dans la config effective"
  fi
}

whoami_check(){
  log "🔎 EAS whoami"
  local w
  w="$(npx -y eas-cli@latest whoami --non-interactive 2>/dev/null || true)"
  [[ "$w" == "delishafrica" ]] || die "EAS pas loggé sur delishafrica (whoami=$w). Fais: npx -y eas-cli@latest login"
  log "✅ whoami=$w"
}

main(){
  whoami_check

  for app in "${APPS[@]}"; do
    local dir="$ROOT/apps/$app"
    log "==================== $app ===================="
    [[ -d "$dir" ]] || die "Dossier introuvable: $dir"

    log "1) Strip projectId (app.json + app.config.*) + clear .eas cache"
    strip_projectId_from_appjson "$dir"
    strip_projectId_from_appconfig "$dir"
    clear_eas_cache "$dir"

    log "2) Vérif config effective (projectId doit être undefined)"
    ensure_unlinked "$dir"

    log "3) project:init (INTERACTIF) — garde org=delishafrica + slug proposé"
    ( cd "$dir" && npx -y eas-cli@latest project:init )

    log "4) Vérif remote"
    ( cd "$dir" && npx -y eas-cli@latest project:info )
    log "Config après init:"
    show_expo_config "$dir"
  done

  log "✅ OK: merchant + courier relinked/created."
  log "Ensuite tu peux relancer:"
  log "  cd $ROOT/apps/merchant && npx -y eas-cli@latest build -p ios --profile development --clear-cache"
  log "  cd $ROOT/apps/courier  && npx -y eas-cli@latest build -p ios --profile development --clear-cache"
}

main "$@"
