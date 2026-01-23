#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
NOW="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/eas_autosync_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/eas_autosync_$NOW.log"

mkdir -p "$BK" "$REPORT_DIR"
log(){ echo -e "\n[$(date '+%H:%M:%S')] $*" | tee -a "$REPORT"; }
need(){ command -v "$1" >/dev/null 2>&1 || { log "❌ Missing: $1"; exit 1; }; }

need node

EAS="npx -y eas-cli@latest"

log "== TONTON EAS AUTOSYNC projectId =="
log "Backup: $BK"
log "Report: $REPORT"

cd "$ROOT"

# Check login
if ! $EAS whoami >/dev/null 2>&1; then
  log "❌ Pas loggé EAS. Fais: npx -y eas-cli@latest login"
  exit 2
fi

log "✅ EAS logged in as: $($EAS whoami | tr -d '\n')"

# Try to list projects as JSON (multiple fallbacks)
JSON=""
if $EAS project:list --json >/tmp/eas_projects.json 2>/dev/null; then
  JSON="/tmp/eas_projects.json"
elif $EAS projects:list --json >/tmp/eas_projects.json 2>/dev/null; then
  JSON="/tmp/eas_projects.json"
else
  log "❌ Impossible de lister les projects en JSON. Essaie manuellement: npx -y eas-cli@latest project:list"
  exit 3
fi

log "✅ Projects JSON saved: $JSON"

# Extract IDs by slug
node - <<'NODE'
const fs = require("fs");

const jsonPath = "/tmp/eas_projects.json";
const data = JSON.parse(fs.readFileSync(jsonPath,"utf8"));

const want = new Set(["delishafrica-client","delishafrica-merchant","delishafrica-courier"]);

function flatten(x){
  if (Array.isArray(x)) return x.flatMap(flatten);
  if (x && typeof x === "object"){
    // common shapes: {data:[...]}, {projects:[...]}, [...]
    for (const k of ["data","projects","items"]) if (Array.isArray(x[k])) return flatten(x[k]);
  }
  return Array.isArray(x) ? x : (Array.isArray(data) ? data : []);
}

const arr = Array.isArray(data) ? data : (data.data || data.projects || data.items || []);
const projects = Array.isArray(arr) ? arr : [];

const picked = {};
for (const p of projects) {
  const slug = p.slug || p.projectSlug || (p.fullName ? String(p.fullName).split("/").pop() : null);
  const id = p.id || p.projectId || p._id;
  const owner = (p.ownerAccount && (p.ownerAccount.name || p.ownerAccount.slug)) || p.owner || null;
  if (slug && want.has(slug) && id) picked[slug] = { id, owner };
}

if (Object.keys(picked).length === 0) {
  console.error("No matching projects found in JSON. Known slugs present:");
  console.error(projects.slice(0,30).map(p => p.slug || p.projectSlug || p.fullName).filter(Boolean));
  process.exit(4);
}

fs.writeFileSync("/tmp/eas_picked.json", JSON.stringify(picked, null, 2));
console.log("Picked:", JSON.stringify(picked, null, 2));
NODE

if [[ ! -f /tmp/eas_picked.json ]]; then
  log "❌ Extraction failed (voir logs au-dessus)."
  exit 4
fi

log "== Patch app.json with extracted projectId =="
patch_one(){
  local app="$1" slug="$2"
  local f="$ROOT/apps/$app/app.json"
  [[ -f "$f" ]] || { log "⚠️ missing $f"; return 0; }
  cp -a "$f" "$BK/$(echo "$f" | sed 's#/#__#g')" || true

  node - <<NODE
const fs = require("fs");
const picked = JSON.parse(fs.readFileSync("/tmp/eas_picked.json","utf8"));
const slug = "$slug";
const f = "$f";
let j = JSON.parse(fs.readFileSync(f,"utf8"));
j.expo = j.expo || {};
j.expo.extra = j.expo.extra || {};
j.expo.extra.eas = j.expo.extra.eas || {};
j.expo.slug = slug;

// set owner if available
const owner = picked[slug]?.owner;
if (owner) j.expo.owner = owner;

j.expo.extra.eas.projectId = picked[slug].id;
fs.writeFileSync(f, JSON.stringify(j,null,2)+"\n");
NODE

  log "✅ patched $app -> $slug"
}

patch_one client  "delishafrica-client"
patch_one merchant "delishafrica-merchant"
patch_one courier  "delishafrica-courier"

log "✅ Done. Maintenant retente: npx -y eas-cli@latest build -p ios --profile development --clear-cache"
