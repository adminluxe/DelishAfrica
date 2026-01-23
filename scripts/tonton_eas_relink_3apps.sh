#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OWNER="${1:-delishafrica}"

APPS=(client merchant courier)

die(){ echo "X $*" >&2; exit 1; }
ok(){ echo "OK: $*" >&2; }

need(){ command -v "$1" >/dev/null 2>&1 || die "Missing command: $1"; }

need node
need npx

TMP="/tmp/tonton_eas_projects.json"

ok "Fetching Expo projects list for owner=$OWNER"
set +e
npx --yes eas-cli@latest whoami >/dev/null 2>&1
WHOAMI_RC=$?
set -e
if [[ $WHOAMI_RC -ne 0 ]]; then
  die "EAS not logged in (npx eas-cli@latest whoami failed). Run: npx --yes eas-cli@latest login"
fi

# Get JSON list of projects
set +e
OUT="$(npx --yes eas-cli@latest project:list --json 2>/dev/null)"
RC=$?
set -e
if [[ $RC -ne 0 || -z "${OUT:-}" ]]; then
  die "Cannot run: npx --yes eas-cli@latest project:list --json"
fi

printf "%s" "$OUT" > "$TMP"

# Resolve desired slugs and ids
node - "$OWNER" "$TMP" <<'NODE'
const fs = require("fs");

const owner = process.argv[2];
const file = process.argv[3];

const raw = fs.readFileSync(file, "utf8");
let projects;
try { projects = JSON.parse(raw); }
catch { console.error("Failed to parse JSON from project:list"); process.exit(2); }

function get(obj, path) {
  return path.split(".").reduce((a,k)=>a && a[k], obj);
}

function ownerName(p) {
  return (
    get(p,"account.name") ||
    get(p,"ownerAccount.name") ||
    get(p,"accountName") ||
    get(p,"owner") ||
    null
  );
}

function slug(p) {
  return get(p,"slug") || get(p,"project.slug") || null;
}

function id(p) {
  return get(p,"id") || get(p,"projectId") || get(p,"project.id") || null;
}

const wanted = [
  { app:"client",  prefer:`${owner}-client`,  fallback:"client"  },
  { app:"merchant",prefer:`${owner}-merchant`,fallback:"merchant"},
  { app:"courier", prefer:`${owner}-courier`, fallback:"courier" },
];

const rows = projects
  .map(p => ({ id:id(p), slug:slug(p), owner:ownerName(p), raw:p }))
  .filter(r => r.id && r.slug);

function findBySlug(s) {
  // prefer matching owner if present
  const exactOwner = rows.find(r => r.slug === s && (r.owner === owner));
  if (exactOwner) return exactOwner;
  const any = rows.find(r => r.slug === s);
  return any || null;
}

const result = {};
for (const w of wanted) {
  const pref = findBySlug(w.prefer);
  const fb   = findBySlug(w.fallback);
  const chosen = pref || fb;
  if (!chosen) {
    console.error(`No project found for app=${w.app}. Tried slug=${w.prefer} then ${w.fallback}`);
    process.exit(3);
  }
  result[w.app] = { slug: chosen.slug, id: chosen.id, owner: chosen.owner || owner };
}

process.stdout.write(JSON.stringify(result, null, 2));
NODE
RESOLVED="$(node - "$OWNER" "$TMP" <<'NODE'
const fs = require("fs");
const owner = process.argv[2];
const file = process.argv[3];
const raw = fs.readFileSync(file,"utf8");
const projects = JSON.parse(raw);

function get(obj, path){ return path.split(".").reduce((a,k)=>a && a[k], obj); }
function ownerName(p){ return get(p,"account.name") || get(p,"ownerAccount.name") || get(p,"accountName") || get(p,"owner") || null; }
function slug(p){ return get(p,"slug") || get(p,"project.slug") || null; }
function id(p){ return get(p,"id") || get(p,"projectId") || get(p,"project.id") || null; }

const rows = projects.map(p=>({id:id(p),slug:slug(p),owner:ownerName(p)})).filter(r=>r.id && r.slug);
function findBySlug(s){
  const exactOwner = rows.find(r=>r.slug===s && r.owner===owner);
  if (exactOwner) return exactOwner;
  return rows.find(r=>r.slug===s) || null;
}
const wanted = [
  { app:"client",  prefer:`${owner}-client`,  fallback:"client"  },
  { app:"merchant",prefer:`${owner}-merchant`,fallback:"merchant"},
  { app:"courier", prefer:`${owner}-courier`, fallback:"courier" },
];
const result = {};
for(const w of wanted){
  const pref = findBySlug(w.prefer);
  const fb = findBySlug(w.fallback);
  const chosen = pref || fb;
  if(!chosen){ console.error("Missing slug", w); process.exit(3); }
  result[w.app] = { slug: chosen.slug, id: chosen.id, owner: chosen.owner || owner };
}
process.stdout.write(JSON.stringify(result));
NODE
)"

ok "Resolved target projects:"
echo "$RESOLVED" | node -e 'const x=require("fs").readFileSync(0,"utf8"); console.log(JSON.stringify(JSON.parse(x),null,2));'

patch_appjson(){
  local app="$1"
  local appdir="$ROOT/apps/$app"
  local f="$appdir/app.json"
  [[ -f "$f" ]] || die "Missing $f"

  local ts
  ts="$(date +%Y%m%d_%H%M%S)"
  cp -a "$f" "$f.bak.$ts"

  node - "$f" "$RESOLVED" "$app" "$OWNER" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
const resolved = JSON.parse(process.argv[3]);
const app = process.argv[4];
const owner = process.argv[5];

const raw = fs.readFileSync(file,"utf8");
let j = JSON.parse(raw);
if (!j.expo) j = { expo: j }; // tolerate non-wrapped format

const target = resolved[app];
if (!target) { console.error("No resolved target for", app); process.exit(2); }

j.expo.owner = owner;
j.expo.slug = target.slug;

j.expo.extra = j.expo.extra || {};
j.expo.extra.eas = j.expo.extra.eas || {};
j.expo.extra.eas.projectId = target.id;

// tolerate typo key
if (j.expo.extra.eas.projectID) delete j.expo.extra.eas.projectID;

fs.writeFileSync(file, JSON.stringify(j, null, 2) + "\n");
console.log(`patched ${file}: slug=${target.slug} projectId=${target.id}`);
NODE
}

for app in "${APPS[@]}"; do
  patch_appjson "$app"
done

echo
ok "Verify (expo config + eas project:info):"
for app in "${APPS[@]}"; do
  echo "== $app =="
  ( cd "$ROOT/apps/$app" && npx --yes expo config --json 2>/dev/null | node -e '
    const fs=require("fs"); const j=JSON.parse(fs.readFileSync(0,"utf8"));
    const expo=j.exp || j.expo || j;
    const out={
      owner: expo.owner || null,
      slug: expo.slug || null,
      iosBundleIdentifier: expo.ios?.bundleIdentifier || null,
      androidPackage: expo.android?.package || null,
      projectId: expo.extra?.eas?.projectId || null,
    };
    console.log(JSON.stringify(out,null,2));
  ' ) || true

  ( cd "$ROOT/apps/$app" && npx --yes eas-cli@latest project:info ) || true
  echo
done

ok "Done."
