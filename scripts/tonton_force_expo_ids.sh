#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
NOW="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/force_expo_ids_$NOW"
REPORT="$BK/report.log"

# ✅ Valeurs confirmées (depuis ta capture)
OWNER="purpleorchidgroup"

CLIENT_SLUG="delishafrica-client"
CLIENT_PID="394e7d6f-559b-4536-81a9-fbc0cdb0c68f"

MERCHANT_SLUG="delishafrica-merchant"
MERCHANT_PID="ac87e7fa-1e43-4baa-813e-6174797314a1"

COURIER_SLUG="delishafrica-courier"
COURIER_PID="b6ed6df5-cd75-48ff-99f9-fc5adcaec479"

log(){ echo -e "\n[$(date '+%H:%M:%S')] $*" | tee -a "$REPORT"; }
die(){ echo -e "\n❌ $*" | tee -a "$REPORT"; exit 1; }

backup(){
  local f="$1"
  [[ -f "$f" ]] || return 0
  local rel="${f#$ROOT/}"
  mkdir -p "$BK/$(dirname "$rel")"
  cp -a "$f" "$BK/$rel"
}

cfg_file(){
  local app="$1"
  if [[ -f "$ROOT/apps/$app/app.config.ts" ]]; then echo "$ROOT/apps/$app/app.config.ts"; return; fi
  if [[ -f "$ROOT/apps/$app/app.config.js" ]]; then echo "$ROOT/apps/$app/app.config.js"; return; fi
  if [[ -f "$ROOT/apps/$app/app.json" ]]; then echo "$ROOT/apps/$app/app.json"; return; fi
  echo ""
}

patch_app_config(){
  local file="$1" slug="$2" pid="$3" owner="$4"
  backup "$file"

  node - "$file" "$slug" "$pid" "$owner" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
const SLUG = process.argv[3];
const PID  = process.argv[4];
const OWNER= process.argv[5];

let s = fs.readFileSync(file, "utf8");

// 1) Force constants (SLUG / EAS_PROJECT_ID / OWNER) if they exist
function forceConst(name, value){
  const re = new RegExp(`(^\\s*(?:export\\s+)?(?:const|let|var)\\s+${name}\\s*=)[^;]*;`, "m");
  if (re.test(s)) {
    s = s.replace(re, `$1 "${value}";`);
    return true;
  }
  return false;
}

forceConst("SLUG", SLUG);
forceConst("EAS_PROJECT_ID", PID);
forceConst("OWNER", OWNER);

// 2) Also force inline object props if present
s = s.replace(/(\bslug\s*:\s*)(["'`])[^"'`]*\2/g, `$1"${SLUG}"`);
s = s.replace(/(\bowner\s*:\s*)(["'`])[^"'`]*\2/g, `$1"${OWNER}"`);
s = s.replace(/(\bprojectId\s*:\s*)(["'`])[^"'`]*\2/g, `$1"${PID}"`);

// 3) If projectId is written as eas: { projectId: SOMEVAR } we keep it;
// constants above now point to correct values.

fs.writeFileSync(file, s);
NODE
}

patch_app_json(){
  local file="$1" slug="$2" pid="$3" owner="$4"
  backup "$file"
  node - "$file" "$slug" "$pid" "$owner" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
const SLUG = process.argv[3];
const PID  = process.argv[4];
const OWNER= process.argv[5];

const j = JSON.parse(fs.readFileSync(file,"utf8"));
j.expo = j.expo || {};
j.expo.slug = SLUG;
j.expo.owner = OWNER;
j.expo.extra = j.expo.extra || {};
j.expo.extra.eas = j.expo.extra.eas || {};
j.expo.extra.eas.projectId = PID;

fs.writeFileSync(file, JSON.stringify(j,null,2)+"\n");
NODE
}

main(){
  mkdir -p "$BK"; touch "$REPORT"
  [[ -d "$ROOT/apps" ]] || die "Dossier apps introuvable: $ROOT/apps"

  for app in client merchant courier; do
    local f
    f="$(cfg_file "$app")"
    [[ -n "$f" ]] || die "Config introuvable pour $app (app.config.ts/js ou app.json)"

    case "$app" in
      client)
        log "Patch client => $CLIENT_SLUG / $CLIENT_PID"
        ;;
      merchant)
        log "Patch merchant => $MERCHANT_SLUG / $MERCHANT_PID"
        ;;
      courier)
        log "Patch courier => $COURIER_SLUG / $COURIER_PID"
        ;;
    esac

    if [[ "$f" == *.json ]]; then
      case "$app" in
        client)   patch_app_json "$f" "$CLIENT_SLUG" "$CLIENT_PID" "$OWNER" ;;
        merchant) patch_app_json "$f" "$MERCHANT_SLUG" "$MERCHANT_PID" "$OWNER" ;;
        courier)  patch_app_json "$f" "$COURIER_SLUG" "$COURIER_PID" "$OWNER" ;;
      esac
    else
      case "$app" in
        client)   patch_app_config "$f" "$CLIENT_SLUG" "$CLIENT_PID" "$OWNER" ;;
        merchant) patch_app_config "$f" "$MERCHANT_SLUG" "$MERCHANT_PID" "$OWNER" ;;
        courier)  patch_app_config "$f" "$COURIER_SLUG" "$COURIER_PID" "$OWNER" ;;
      esac
    fi
  done

  log "SUMMARY:"
  for app in client merchant courier; do
    local f
    f="$(cfg_file "$app")"
    echo -e "\n--- $app ($f) ---" | tee -a "$REPORT"
    grep -nE 'SLUG|EAS_PROJECT_ID|OWNER|slug\s*:|projectId\s*:|owner\s*:' "$f" | head -n 80 | tee -a "$REPORT" || true
  done

  log "OK ✅ Backups: $BK"
  log "Report: $REPORT"
}

main "$@"
