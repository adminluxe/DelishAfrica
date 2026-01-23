#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
cd "$ROOT"

ts="$(date +%Y%m%d_%H%M%S)"

# owner préféré (si vide ou pas trouvé, le script auto-prend l'owner du projet matché)
PREFERRED_OWNER="${1:-delishafrica}"

backup() {
  local f="$1"
  [ -f "$f" ] || return 0
  cp -a "$f" "${f}.bak.${ts}"
  echo "   backup: ${f}.bak.${ts}"
}

echo "== Fetch Expo projects list (owner hint: $PREFERRED_OWNER) =="
RAW="$( (npx -y expo projects list --json 2>&1) || (expo projects list --json 2>&1) )"

# Parse + select mapping
MAP="$(node - "$PREFERRED_OWNER" <<'NODE'
const ownerHint = process.argv[2] || "";
const input = require("fs").readFileSync(0, "utf8");

function tryParse(txt) {
  try { return JSON.parse(txt); } catch {}
  // extract JSON from noisy output
  const first = Math.min(...["[","{"].map(ch => {
    const i = txt.indexOf(ch); return i === -1 ? 1e9 : i;
  }));
  if (!isFinite(first) || first === 1e9) return null;
  const lastArr = txt.lastIndexOf("]");
  const lastObj = txt.lastIndexOf("}");
  const last = Math.max(lastArr, lastObj);
  if (last <= first) return null;
  const slice = txt.slice(first, last + 1);
  try { return JSON.parse(slice); } catch { return null; }
}

const j = tryParse(input);
if (!j) {
  console.error("ERROR: Unable to parse JSON from expo projects list output.");
  process.exit(2);
}

const items =
  Array.isArray(j) ? j :
  Array.isArray(j.data) ? j.data :
  Array.isArray(j.projects) ? j.projects :
  Array.isArray(j.result) ? j.result :
  [];

const get = (o, p) => p.split(".").reduce((a,k)=> (a && a[k] !== undefined) ? a[k] : undefined, o);

const ownerName = (p) =>
  get(p,"account.name") ||
  get(p,"ownerAccount.name") ||
  get(p,"accountName") ||
  get(p,"account") ||
  get(p,"owner") ||
  get(p,"ownerAccount") ||
  null;

const slug = (p) =>
  get(p,"project.slug") ||
  get(p,"slug") ||
  get(p,"projectSlug") ||
  null;

const id = (p) =>
  get(p,"project.id") ||
  get(p,"id") ||
  get(p,"projectId") ||
  get(p,"projectID") ||
  null;

const normalized = items
  .map(p => ({ owner: ownerName(p), slug: slug(p), id: id(p) }))
  .filter(x => x.owner && x.slug && x.id);

const byOwner = new Map();
for (const p of normalized) {
  if (!byOwner.has(p.owner)) byOwner.set(p.owner, []);
  byOwner.get(p.owner).push(p);
}

function pickProject(candidates) {
  // 1) try ownerHint
  if (ownerHint && byOwner.has(ownerHint)) {
    const arr = byOwner.get(ownerHint);
    for (const s of candidates) {
      const hit = arr.find(x => x.slug === s);
      if (hit) return hit;
    }
  }
  // 2) try any owner
  for (const arr of byOwner.values()) {
    for (const s of candidates) {
      const hit = arr.find(x => x.slug === s);
      if (hit) return hit;
    }
  }
  return null;
}

const candidates = {
  client:  ["delishafrica-client","client"],
  merchant:["delishafrica-merchant","merchant"],
  courier: ["delishafrica-courier","courier"],
};

const out = [];
for (const app of Object.keys(candidates)) {
  const hit = pickProject(candidates[app]);
  if (!hit) {
    out.push(`${app}| | | `);
  } else {
    out.push(`${app}|${hit.owner}|${hit.slug}|${hit.id}`);
  }
}

process.stdout.write(out.join("\n"));
NODE
)"

echo ""
echo "== Selected mapping =="
echo "$MAP" | sed 's/^/ - /'

patch_app_json() {
  local app="$1" owner="$2" slug="$3" pid="$4"
  local f="$ROOT/apps/$app/app.json"
  [ -f "$f" ] || { echo "   (skip) no app.json for $app"; return 0; }
  backup "$f"
  node - "$f" "$owner" "$slug" "$pid" <<'NODE'
const fs = require("fs");
const [,, file, owner, slug, pid] = process.argv;
const j = JSON.parse(fs.readFileSync(file, "utf8"));
j.expo = j.expo || {};
j.expo.owner = owner;
j.expo.slug = slug;
j.expo.extra = j.expo.extra || {};
j.expo.extra.eas = j.expo.extra.eas || {};
j.expo.extra.eas.projectId = pid;
fs.writeFileSync(file, JSON.stringify(j, null, 2) + "\n");
NODE
  echo "   patched: $f"
}

# Client: on force un app.config.ts JS-compatible (pas d'annotations TS)
write_client_app_config_ts() {
  local owner="$1" slug="$2" pid="$3"
  local f="$ROOT/apps/client/app.config.ts"
  backup "$f"
  cat > "$f" <<TS
// JS-compatible config (kept as .ts but WITHOUT TS annotations) to satisfy EAS/Expo loaders.
const appJson = require("./app.json");

module.exports = ({ config }) => {
  const base = (appJson && appJson.expo) ? appJson.expo : (appJson || {});
  const merged = { ...(base || {}), ...(config || {}) };

  const extra = { ...(merged.extra || {}) };
  extra.eas = { ...(extra.eas || {}), projectId: "${pid}" };

  return {
    ...merged,
    owner: "${owner}",
    slug: "${slug}",
    extra,
  };
};
TS
  echo "   wrote: $f"
}

# Merchant/Courier: patch léger dans app.config.* si présent (sans casser le reste)
patch_app_config_keys() {
  local app="$1" owner="$2" slug="$3" pid="$4"
  local dir="$ROOT/apps/$app"
  local cfg=""
  for f in app.config.ts app.config.js app.config.mjs; do
    if [ -f "$dir/$f" ]; then cfg="$dir/$f"; break; fi
  done
  [ -n "$cfg" ] || { echo "   (skip) no app.config.* for $app"; return 0; }

  # si ancien wrapper/base traîne
  rm -f "$dir/app.config.base."* 2>/dev/null || true

  backup "$cfg"
  perl -pi -e "s/(\\bowner\\s*:\\s*['\\\"]).*?(['\\\"])/\\1$owner\\2/g" "$cfg" || true
  perl -pi -e "s/(\\bslug\\s*:\\s*['\\\"]).*?(['\\\"])/\\1$slug\\2/g" "$cfg" || true
  perl -pi -e "s/(\\bprojectId\\s*:\\s*['\\\"])[0-9a-fA-F-]{36}(['\\\"])/\\1$pid\\2/g" "$cfg" || true
  echo "   patched keys: $cfg"
}

echo ""
echo "== Apply patches =="

ok=1
while IFS='|' read -r app owner slug pid; do
  owner="$(echo "$owner" | xargs)"
  slug="$(echo "$slug" | xargs)"
  pid="$(echo "$pid" | xargs)"

  if [ -z "$owner" ] || [ -z "$slug" ] || [ -z "$pid" ]; then
    echo "!! ERROR: No Expo project match for app=$app (check expo projects list)."
    ok=0
    continue
  fi

  echo ""
  echo "-- $app => owner=$owner slug=$slug projectId=$pid --"

  patch_app_json "$app" "$owner" "$slug" "$pid"

  if [ "$app" = "client" ]; then
    write_client_app_config_ts "$owner" "$slug" "$pid"
  else
    patch_app_config_keys "$app" "$owner" "$slug" "$pid"
  fi
done <<< "$MAP"

[ "$ok" -eq 1 ] || { echo ""; echo "Stopping due to missing mapping."; exit 3; }

echo ""
echo "== Verify EAS project:info =="
for app in client merchant courier; do
  echo ""
  echo "-- eas project:info ($app) --"
  (cd "$ROOT/apps/$app" && npx -y eas project:info) || true
done

echo ""
echo "Done. Backups: *.bak.${ts}"
