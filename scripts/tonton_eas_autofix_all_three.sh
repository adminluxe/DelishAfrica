#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/opt/delishafrica/monorepo"
ACCOUNT="delishafrica"

# ✅ IDs (fixés d'après tes captures)
CLIENT_ID="b9aebdae-10b4-4638-a576-a5f61352ea97"
COURIER_ID="5d1b6b85-9e64-4cc2-9cbe-7d698feccc84"
MERCHANT_ID="292e5d9e-9dbe-4dfb-baf7-ed80cf2e2bbc"

# Builds automatiques (on laisse merchant OFF par défaut)
DO_BUILD_CLIENT="${DO_BUILD_CLIENT:-1}"
DO_BUILD_COURIER="${DO_BUILD_COURIER:-1}"
DO_BUILD_MERCHANT="${DO_BUILD_MERCHANT:-0}"
IOS_PROFILE="${IOS_PROFILE:-development}"

ts(){ date +"%Y%m%d_%H%M%S"; }
log(){ echo "[$(date +%H:%M:%S)] $*"; }
die(){ echo "❌ $*" >&2; exit 1; }

[ -d "$ROOT/apps" ] || die "Repo introuvable: $ROOT/apps"
command -v node >/dev/null || die "node manquant"
command -v eas >/dev/null || die "eas-cli manquant (installe-le: npm i -g eas-cli)"

UUID_RE='^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{12}$'
[[ "$CLIENT_ID" =~ $UUID_RE ]] || die "CLIENT_ID invalide: $CLIENT_ID"
[[ "$COURIER_ID" =~ $UUID_RE ]] || die "COURIER_ID invalide: $COURIER_ID"
[[ "$MERCHANT_ID" =~ $UUID_RE ]] || die "MERCHANT_ID invalide: $MERCHANT_ID"

# Sanity: IDs distincts
if [[ "$CLIENT_ID" == "$COURIER_ID" || "$CLIENT_ID" == "$MERCHANT_ID" || "$COURIER_ID" == "$MERCHANT_ID" ]]; then
  die "IDs dupliqués détectés. STOP (CLIENT/COURIER/MERCHANT doivent être différents)."
fi

BK="$ROOT/.tonton_backups/eas_autofix_all_three_$(ts)"
mkdir -p "$BK"

backup_path() {
  local p="$1"
  [ -e "$p" ] || return 0
  local rel="${p#$ROOT/}"
  mkdir -p "$BK/$(dirname "$rel")"
  cp -a "$p" "$BK/$rel"
}

# Patch uniquement les vrais fichiers, pas les *.bak.*
is_real_cfg() {
  local f="$1"
  [[ "$f" == *".bak"* ]] && return 1
  [[ "$f" == *".backup"* ]] && return 1
  [[ "$f" == *".old"* ]] && return 1
  return 0
}

patch_project_id_in_file() {
  local file="$1"
  local newid="$2"

  # remplace tous les UUID sur des lignes contenant projectId:
  perl -0777 -pi -e '
    my $id=$ENV{NEWID};
    s/^([^\n]*\bprojectId\b\s*:\s*["'\''])[0-9a-fA-F-]{36}(["'\''][^\n]*)$/$1$id$2/gm;
  ' NEWID="$newid" "$file"

  # si pas de projectId du tout, on tente d'injecter dans extra.eas si possible
  if ! grep -qE "\bprojectId\b\s*:" "$file"; then
    # cas: il existe "eas: {" -> injecte projectId dedans
    if grep -qE "\beas\b\s*:\s*\{" "$file"; then
      perl -0777 -pi -e '
        my $id=$ENV{NEWID};
        s/(\beas\b\s*:\s*\{\s*)/$1projectId: "'$id'",\n      /s;
      ' NEWID="$newid" "$file" || true
    fi
  fi
}

patch_owner_slug_literals() {
  local file="$1"
  local owner="$2"
  local slug="$3"

  # owner: "..."
  if grep -qE "\bowner\b\s*:\s*['\"]" "$file"; then
    perl -pi -e 's/(\bowner\b\s*:\s*["'\'']).*?(["'\''])/$1'"$owner"'$2/' "$file" || true
  fi

  # slug: "..." (uniquement si literal)
  if grep -qE "\bslug\b\s*:\s*['\"][^'\"]+['\"]" "$file"; then
    perl -pi -e 's/(\bslug\b\s*:\s*["'\''])[^"'\'']+(["'\''])/$1'"$slug"'$2/' "$file" || true
  fi
}

get_slug_from_eas_project_info() {
  local appdir="$1"
  local out
  out="$(cd "$appdir" && eas project:info 2>/dev/null || true)"
  # cherche un pattern @account/slug
  local full
  full="$(echo "$out" | grep -oE "@[a-zA-Z0-9_-]+/[a-zA-Z0-9_.-]+" | head -n1 || true)"
  if [[ -n "$full" ]]; then
    echo "${full#*/}"
  else
    echo ""
  fi
}

verify_expo_config() {
  local app="$1"
  local appdir="$2"

  local tmp="/tmp/expo_config_${app}_$$.json"
  (cd "$appdir" && npx -y expo config --type public --json > "$tmp" 2>/dev/null) || true

  if [ ! -s "$tmp" ]; then
    log "⚠️  [$app] expo config JSON non généré (deps ?). On continue quand même."
    return 0
  fi

  node - <<NODE
const fs=require('fs');
const j=JSON.parse(fs.readFileSync("$tmp",'utf8'));
const e=j.expo||{};
console.log("[$app] slug:", e.slug);
console.log("[$app] owner:", e.owner);
console.log("[$app] extra.eas.projectId:", e.extra?.eas?.projectId);
console.log("[$app] ios.bundleIdentifier:", e.ios?.bundleIdentifier);
NODE
}

fix_one_app() {
  local app="$1"
  local id="$2"

  local appdir="$ROOT/apps/$app"
  [ -d "$appdir" ] || die "App introuvable: $appdir"

  log "==================== [$app] START ===================="

  # Backup importants
  backup_path "$appdir/app.json"
  backup_path "$appdir/eas.json"
  backup_path "$appdir/package.json"
  backup_path "$appdir/app.config.ts"
  backup_path "$appdir/app.config.tsx"
  backup_path "$appdir/app.config.js"
  backup_path "$appdir/app.config.cjs"
  backup_path "$appdir/app.config.mjs"
  backup_path "$appdir/app.config.base.ts"
  backup_path "$appdir/app.config.base.js"
  backup_path "$appdir/.eas/project.json"
  backup_path "$appdir/.eas"

  # Purge app.json extra.eas.projectId si présent
  if [ -f "$appdir/app.json" ]; then
    node - <<NODE
const fs=require('fs');
const p="${appdir}/app.json";
const j=JSON.parse(fs.readFileSync(p,'utf8'));
const expo=j.expo||j;
if(expo?.extra?.eas?.projectId) delete expo.extra.eas.projectId;
if(expo?.extra?.eas && Object.keys(expo.extra.eas).length===0) delete expo.extra.eas;
if(expo?.extra && Object.keys(expo.extra).length===0) delete expo.extra;
fs.writeFileSync(p, JSON.stringify(j,null,2)+"\n");
NODE
  fi

  # Patch tous les app.config* réels
  mapfile -t CFGS < <(find "$appdir" -maxdepth 2 -type f -name "app.config*" | sort)
  local patched=0
  for f in "${CFGS[@]:-}"; do
    is_real_cfg "$f" || continue
    backup_path "$f"
    patch_project_id_in_file "$f" "$id"
    patched=$((patched+1))
  done

  if [ "$patched" -eq 0 ]; then
    die "[$app] Aucun app.config* trouvé. Impossible de fixer dynamic config."
  fi

  # Relink EAS par ID (sans jouer au roulette russe avec les slugs)
  # (Si ça échoue, on continue: le plus important est le projectId dans le config.)
  log "[$app] eas project:init --id $id (force)"
  (cd "$appdir" && EAS_NO_VCS=1 eas project:init --id "$id" --force --non-interactive >/tmp/eas_init_${app}_$$.log 2>&1) || true
  tail -n 20 "/tmp/eas_init_${app}_$$.log" 2>/dev/null || true

  # Tentative auto: déduire slug depuis eas project:info
  local detected_slug=""
  detected_slug="$(get_slug_from_eas_project_info "$appdir" || true)"
  if [[ -n "$detected_slug" ]]; then
    log "[$app] slug détecté via EAS: $detected_slug (patch literals si possible)"
    for f in "${CFGS[@]:-}"; do
      is_real_cfg "$f" || continue
      patch_owner_slug_literals "$f" "$ACCOUNT" "$detected_slug"
    done
  else
    log "[$app] slug non détecté via EAS (OK si votre slug actuel correspond déjà)."
  fi

  # Vérif expo config
  verify_expo_config "$app" "$appdir"

  log "==================== [$app] OK ===================="
  echo
}

log "Backup global: $BK"
log "Compte attendu: $ACCOUNT"
log "IDs: client=$CLIENT_ID courier=$COURIER_ID merchant=$MERCHANT_ID"
echo

# (Optionnel) vérifie login
log "EAS whoami:"
(eas whoami || true) | sed -n '1,5p'
echo

fix_one_app "merchant" "$MERCHANT_ID"
fix_one_app "client" "$CLIENT_ID"
fix_one_app "courier" "$COURIER_ID"

log "---- Résumé rollback ----"
log "Rollback total:"
echo "  rsync -a \"$BK/\" \"$ROOT/\""
echo

# Builds dev iOS (par défaut: client+courier)
run_build() {
  local app="$1"
  local enabled="$2"
  [ "$enabled" = "1" ] || { log "[$app] build iOS SKIP (DO_BUILD_${app^^}=0)"; return 0; }
  local appdir="$ROOT/apps/$app"
  log "[$app] eas build -p ios --profile $IOS_PROFILE --clear-cache"
  (cd "$appdir" && eas build -p ios --profile "$IOS_PROFILE" --clear-cache) || true
}

run_build "client" "$DO_BUILD_CLIENT"
run_build "courier" "$DO_BUILD_COURIER"
run_build "merchant" "$DO_BUILD_MERCHANT"

log "DONE ✅"
log "Si un build refuse encore 'slug mismatch', c'est que le slug dans app.config.* n'est pas literal (variable/env). On le corrigera en 1 patch ciblé."
