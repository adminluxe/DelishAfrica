#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=("client" "courier")

ts() { date +"%Y%m%d_%H%M%S"; }
log() { echo "[$(date +%H:%M:%S)] $*"; }
die() { echo "❌ $*" >&2; exit 1; }

CLIENT_ID="${1:-}"
COURIER_ID="${2:-}"

[ -d "$ROOT/apps/client" ] || die "Dossier introuvable: $ROOT/apps/client"
[ -d "$ROOT/apps/courier" ] || die "Dossier introuvable: $ROOT/apps/courier"

if [[ -z "${CLIENT_ID}" || -z "${COURIER_ID}" ]]; then
  echo
  echo "Usage:"
  echo "  bash $ROOT/scripts/tonton_fix_eas_projectids_client_courier.sh <CLIENT_PROJECT_ID> <COURIER_PROJECT_ID>"
  echo
  echo "Exemple:"
  echo "  bash $ROOT/scripts/tonton_fix_eas_projectids_client_courier.sh 11111111-2222-3333-4444-555555555555 aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
  echo
  exit 2
fi

UUID_RE='^[0-9a-fA-F-]{36}$'
[[ "$CLIENT_ID" =~ $UUID_RE ]] || die "CLIENT_PROJECT_ID invalide: $CLIENT_ID"
[[ "$COURIER_ID" =~ $UUID_RE ]] || die "COURIER_PROJECT_ID invalide: $COURIER_ID"

BK="$ROOT/.tonton_backups/eas_projectids_fix_$(ts)"
mkdir -p "$BK"

patch_config_file() {
  local app="$1"
  local id="$2"
  local dir="$ROOT/apps/$app"
  local cfg=""

  # Trouve app.config.*
  for f in "$dir"/app.config.{ts,tsx,js,cjs,mjs}; do
    if [ -f "$f" ]; then cfg="$f"; break; fi
  done

  mkdir -p "$BK/$app"

  log "---- [$app] scan des projectId (avant)"
  (grep -RInE --exclude-dir=node_modules --exclude-dir=.git \
    'extra\s*\.\s*eas\s*\.\s*projectId|projectId\s*:\s*["'\'']?[0-9a-fA-F-]{36}["'\'']?|delishafrica-merchant' \
    "$dir" || true) | sed -n '1,120p'

  # Backup fichiers config
  if [ -f "$dir/app.json" ]; then cp -a "$dir/app.json" "$BK/$app/app.json.bak"; fi
  if [ -n "$cfg" ]; then cp -a "$cfg" "$BK/$app/$(basename "$cfg").bak"; fi

  # 1) Purge projectId dans app.json (au cas où)
  if [ -f "$dir/app.json" ]; then
    node - <<NODE
const fs=require('fs');
const p="${dir}/app.json";
const j=JSON.parse(fs.readFileSync(p,'utf8'));
const expo=j.expo||j;
if(expo?.extra?.eas?.projectId) delete expo.extra.eas.projectId;
if(expo?.extra?.eas && Object.keys(expo.extra.eas).length===0) delete expo.extra.eas;
if(expo?.extra && Object.keys(expo.extra).length===0) delete expo.extra;
if(j.expo && Object.keys(j.expo).length===0) delete j.expo;
fs.writeFileSync(p, JSON.stringify(j,null,2)+"\n");
NODE
  fi

  # 2) Purge TOUT projectId UUID dans app.config.* (c'est LA source chez vous)
  if [ -n "$cfg" ]; then
    # remplace un projectId UUID existant par le bon ID
    APPID="$id" perl -pi -e 's/(projectId\s*:\s*["'\''])[0-9a-fA-F-]{36}(["'\''])/${1}$ENV{APPID}$2/g' "$cfg"

    # si aucun remplacement n’a eu lieu, on tente d’injecter dans extra.eas
    if ! grep -qE "projectId\\s*:\\s*[\"']${id}[\"']" "$cfg"; then
      # Cas 1: il existe déjà "eas: { ... }" mais sans projectId
      if grep -qE "eas\\s*:\\s*\\{" "$cfg" && ! grep -qE "projectId\\s*:" "$cfg"; then
        APPID="$id" perl -0777 -pi -e 's/(eas\s*:\s*\{\s*)/${1}\n      projectId: "'$ENV{APPID}'",\n      /s' "$cfg" || true
      fi

      # Cas 2: il existe "extra: { ... }" mais pas de "eas:"
      if grep -qE "extra\\s*:\\s*\\{" "$cfg" && ! grep -qE "eas\\s*:\\s*\\{" "$cfg"; then
        APPID="$id" perl -0777 -pi -e 's/(extra\s*:\s*\{\s*)/${1}\n    eas: { projectId: "'$ENV{APPID}'" },\n    /s' "$cfg" || true
      fi

      # Cas 3: pas de extra du tout => on injecte juste après "...config," ou après "return {"/"=> ({"
      if ! grep -qE "extra\\s*:\\s*\\{" "$cfg"; then
        APPID="$id" perl -0777 -pi -e '
          if (s/(\.\.\.config\s*,)/$1\n  extra: { eas: { projectId: "'$ENV{APPID}'" } },/s) { }
          elsif (s/(return\s*\{\s*)/$1\n  extra: { eas: { projectId: "'$ENV{APPID}'" } },\n/s) { }
          elsif (s/(=>\s*\(\s*\{\s*)/$1\n  extra: { eas: { projectId: "'$ENV{APPID}'" } },\n/s) { }
        ' "$cfg" || true
      fi
    fi

    # mini cleanup virgules
    perl -0777 -pi -e 's/\{\s*,/\{/g; s/,\s*\}/\}/g; s/,\s*,/,/g' "$cfg"
  else
    die "Aucun app.config.* trouvé pour $app (on ne peut pas corriger le dynamic config)."
  fi

  log "---- [$app] verification expo config (apres)"
  (cd "$dir" && npx -y expo config --type public --json > "/tmp/expo_config_${app}.json" 2>/dev/null || true)
  node - <<NODE
const fs=require('fs');
const p="/tmp/expo_config_${app}.json";
if(!fs.existsSync(p)){ console.log("KO: expo config non généré (mais le patch est appliqué)."); process.exit(0); }
const j=JSON.parse(fs.readFileSync(p,'utf8'));
const e=j.expo||{};
console.log("slug:", e.slug);
console.log("ios.bundleIdentifier:", e.ios?.bundleIdentifier);
console.log("extra.eas.projectId:", e.extra?.eas?.projectId);
NODE

  log "✅ [$app] OK. Backup: $BK/$app"
  log "Rollback rapide: rsync -a \"$BK/$app/\" \"$dir/\""
  echo
}

patch_config_file "client" "$CLIENT_ID"
patch_config_file "courier" "$COURIER_ID"

log "DONE ✅  Maintenant relance tes builds dev iOS:"
echo "  cd $ROOT/apps/client  && eas build -p ios --profile development --clear-cache"
echo "  cd $ROOT/apps/courier && eas build -p ios --profile development --clear-cache"
