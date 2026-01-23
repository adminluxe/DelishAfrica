#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
APPS_DIR="$ROOT/apps"
NOW="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/eas_ids_slugs_$NOW"
REPORT="$BK/report.log"

# Known-good (depuis nos docs iOS)
COURIER_SLUG="delishafrica-courier"
COURIER_PID="b6ed6df5-cd75-48ff-99f9-fc5adcaec479"
MERCHANT_SLUG="delishafrica-merchant"
MERCHANT_PID="ac87e7fa-1e43-4baa-813e-6174797314a1"
CLIENT_SLUG="delishafrica-client"
OWNER_DEFAULT="purpleorchidgroup"

log(){ echo -e "\n[$(date '+%H:%M:%S')] $*" | tee -a "$REPORT"; }
die(){ echo -e "\n❌ $*" | tee -a "$REPORT"; exit 1; }

need(){ command -v "$1" >/dev/null 2>&1 || die "Commande manquante: $1"; }

backup_file(){
  local f="$1"
  [[ -f "$f" ]] || return 0
  local rel="${f#$ROOT/}"
  mkdir -p "$BK/$(dirname "$rel")"
  cp -a "$f" "$BK/$rel"
}

is_uuid(){
  [[ "${1:-}" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]
}

# Patch dynamic config (app.config.ts / app.config.js)
patch_dynamic_config(){
  local file="$1" slug="$2" pid="$3" owner="${4:-$OWNER_DEFAULT}"
  backup_file "$file"

  node - "$file" "$slug" "$pid" "$owner" <<'NODE'
const fs = require("fs");
const path = require("path");

const file = process.argv[2];
const wantSlug = process.argv[3];
const wantPid  = process.argv[4];
const wantOwner= process.argv[5];

let s = fs.readFileSync(file, "utf8");

function replaceProp(prop, value) {
  const re = new RegExp(`(${prop}\\s*:\\s*)(["'\`])[^"'\`]*\\2`, "m");
  if (re.test(s)) {
    s = s.replace(re, `$1"${value}"`);
    return true;
  }
  return false;
}

function replaceProjectId(value) {
  const re = /(projectId\s*:\s*)(["'`])[^"'`]*\2/m;
  if (re.test(s)) {
    s = s.replace(re, `$1"${value}"`);
    return true;
  }
  return false;
}

function ensureProjectId(value) {
  if (replaceProjectId(value)) return;

  // Try to inject inside extra: { ... }
  const extraRe = /(extra\s*:\s*{\s*)/m;
  if (extraRe.test(s)) {
    s = s.replace(extraRe, `$1\n    eas: { projectId: "${value}" },\n`);
    return;
  }

  // If no extra block, add one near top-level return object
  const returnObjRe = /(\(\s*{\s*config\s*}\s*:\s*ConfigContext\s*\)\s*:\s*ExpoConfig\s*=>\s*\(\s*{)/m;
  if (returnObjRe.test(s)) {
    s = s.replace(returnObjRe, `$1\n  extra: { eas: { projectId: "${value}" } },\n`);
    return;
  }

  // Fallback: append at end (rare)
  s += `\n// injected by tonton_fix_eas_ids_slugs\nexport const __EAS_PROJECT_ID__ = "${value}";\n`;
}

replaceProp("slug", wantSlug);
replaceProp("owner", wantOwner);
ensureProjectId(wantPid);

fs.writeFileSync(file, s);
NODE
}

# Patch static config (app.json)
patch_app_json(){
  local file="$1" slug="$2" pid="$3" owner="${4:-$OWNER_DEFAULT}"
  backup_file "$file"

  node - "$file" "$slug" "$pid" "$owner" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
const wantSlug = process.argv[3];
const wantPid  = process.argv[4];
const wantOwner= process.argv[5];

const j = JSON.parse(fs.readFileSync(file, "utf8"));
j.expo = j.expo || {};
j.expo.slug = wantSlug;
j.expo.owner = j.expo.owner || wantOwner;
j.expo.extra = j.expo.extra || {};
j.expo.extra.eas = j.expo.extra.eas || {};
j.expo.extra.eas.projectId = wantPid;

fs.writeFileSync(file, JSON.stringify(j, null, 2) + "\n");
NODE
}

patch_eas_json(){
  local file="$1"
  [[ -f "$file" ]] || return 0
  backup_file "$file"

  node - "$file" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
const j = JSON.parse(fs.readFileSync(file, "utf8"));
j.cli = j.cli || {};
// On évite que la contrainte te bloque (on utilisera de toute façon eas-cli@latest)
j.cli.version = ">=16.0.0";
// (bonus) supprime le warning "cli.appVersionSource not set"
j.cli.appVersionSource = j.cli.appVersionSource || "remote";
fs.writeFileSync(file, JSON.stringify(j, null, 2) + "\n");
NODE
}

detect_config_file(){
  local app="$1"
  if [[ -f "$APPS_DIR/$app/app.config.ts" ]]; then echo "$APPS_DIR/$app/app.config.ts"; return; fi
  if [[ -f "$APPS_DIR/$app/app.config.js" ]]; then echo "$APPS_DIR/$app/app.config.js"; return; fi
  if [[ -f "$APPS_DIR/$app/app.json" ]]; then echo "$APPS_DIR/$app/app.json"; return; fi
  echo ""
}

extract_uuid_from_file(){
  local f="$1"
  [[ -f "$f" ]] || { echo ""; return; }
  node - "$f" <<'NODE'
const fs = require("fs");
const s = fs.readFileSync(process.argv[2], "utf8");
const m = s.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
console.log(m ? m[0] : "");
NODE
}

main(){
  need node
  need npx

  mkdir -p "$BK"
  touch "$REPORT"

  [[ -d "$APPS_DIR" ]] || die "Apps introuvables: $APPS_DIR (attendu: $ROOT/apps/{client,courier,merchant})"

  log "Backup dir: $BK"

  # ---- Determine Client projectId (auto if possible) ----
  local client_cfg
  client_cfg="$(detect_config_file client)"
  [[ -n "$client_cfg" ]] || die "Config client introuvable (app.config.ts/js ou app.json)"

  local client_pid="${DA_CLIENT_EAS_PROJECT_ID:-}"
  if [[ -z "$client_pid" ]]; then
    client_pid="$(extract_uuid_from_file "$client_cfg")"
  fi

  if ! is_uuid "$client_pid"; then
    log "Client projectId non trouvé dans la config (ou invalide). Tentative auto via EAS project:list…"
    if npx -y eas-cli@latest whoami >/dev/null 2>&1; then
      # Try to find project by slug
      local json
      json="$(npx -y eas-cli@latest project:list --json 2>/dev/null || true)"
      client_pid="$(node - <<'NODE' "$json"
const s = process.argv[1] || "";
try{
  const j = JSON.parse(s);
  const p = (j.projects || j).find(x => x.slug === "delishafrica-client") || null;
  console.log(p && (p.id || p.projectId) ? (p.id || p.projectId) : "");
}catch(e){ console.log(""); }
NODE
)"
    else
      log "Pas connecté à EAS (whoami KO)."
    fi
  fi

  if ! is_uuid "$client_pid"; then
    cat | tee -a "$REPORT" <<EOF

❌ Impossible de déterminer automatiquement le projectId EAS du CLIENT.

✅ Solution propre (1 ligne) :
  DA_CLIENT_EAS_PROJECT_ID="<UUID_CLIENT>" bash $ROOT/scripts/tonton_fix_eas_ids_slugs.sh

Pour récupérer l'UUID côté EAS :
  cd $APPS_DIR/client
  npx -y eas-cli@latest login
  npx -y eas-cli@latest project:list

EOF
    exit 2
  fi

  log "Client projectId: $client_pid"

  # ---- Patch each app ----
  for app in courier merchant client; do
    local cfg easjson
    cfg="$(detect_config_file "$app")"
    [[ -n "$cfg" ]] || die "Config introuvable pour $app"
    easjson="$APPS_DIR/$app/eas.json"

    case "$app" in
      courier)
        log "Patching courier → slug=$COURIER_SLUG projectId=$COURIER_PID"
        if [[ "$cfg" == *.json ]]; then patch_app_json "$cfg" "$COURIER_SLUG" "$COURIER_PID"; else patch_dynamic_config "$cfg" "$COURIER_SLUG" "$COURIER_PID"; fi
        ;;
      merchant)
        log "Patching merchant → slug=$MERCHANT_SLUG projectId=$MERCHANT_PID"
        if [[ "$cfg" == *.json ]]; then patch_app_json "$cfg" "$MERCHANT_SLUG" "$MERCHANT_PID"; else patch_dynamic_config "$cfg" "$MERCHANT_SLUG" "$MERCHANT_PID"; fi
        ;;
      client)
        log "Patching client → slug=$CLIENT_SLUG projectId=$client_pid"
        if [[ "$cfg" == *.json ]]; then patch_app_json "$cfg" "$CLIENT_SLUG" "$client_pid"; else patch_dynamic_config "$cfg" "$CLIENT_SLUG" "$client_pid"; fi
        ;;
    esac

    patch_eas_json "$easjson"
  done

  log "SUMMARY (grep) :"
  for app in client courier merchant; do
    local cfg
    cfg="$(detect_config_file "$app")"
    echo -e "\n--- $app ---" | tee -a "$REPORT"
    echo "CFG=$cfg" | tee -a "$REPORT"
    # show slug + projectId occurrences
    grep -nE 'slug\s*:|projectId\s*:|owner\s*:' "$cfg" | head -n 30 | tee -a "$REPORT" || true
    [[ -f "$APPS_DIR/$app/eas.json" ]] && (echo "EAS=$APPS_DIR/$app/eas.json" | tee -a "$REPORT"; cat "$APPS_DIR/$app/eas.json" | tee -a "$REPORT") || true
  done

  log "OK ✅ Configs patchées + backups. Rapport: $REPORT"
}

main "$@"
