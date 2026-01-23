#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
cd "$ROOT"

ts="$(date +%Y%m%d_%H%M%S)"

OWNER="delishafrica"

# Mapping (d'après tes IDs)
declare -A SLUG PROJECTID NAME

SLUG[client]="delishafrica-client"
PROJECTID[client]="394e7d6f-559b-4536-81a9-fbc0cdb0c68f"
NAME[client]="DelishAfrica Client"

SLUG[merchant]="delishafrica-merchant"
PROJECTID[merchant]="292e5d9e-9dbe-4dfb-baf7-ed80cf2e2bbc"
NAME[merchant]="DelishAfrica Merchant"

SLUG[courier]="delishafrica-courier"
PROJECTID[courier]="dae37d7c-369e-43c6-a4d1-ba62bf8c0bc6"
NAME[courier]="DelishAfrica Courier"

backup_file() {
  local f="$1"
  [ -f "$f" ] || return 0
  cp -a "$f" "${f}.bak.${ts}"
  echo "   backup: ${f}.bak.${ts}"
}

patch_app_json() {
  local app="$1"
  local f="$ROOT/apps/$app/app.json"
  [ -f "$f" ] || { echo "   (skip) no app.json"; return 0; }

  backup_file "$f"

  node - "$f" "$OWNER" "${SLUG[$app]}" "${NAME[$app]}" "${PROJECTID[$app]}" <<'NODE'
const fs = require("fs");

const [,, file, owner, slug, name, projectId] = process.argv;
if (!file || !owner || !slug || !projectId) {
  throw new Error("Missing args. Usage: node - <file> <owner> <slug> <name> <projectId>");
}

const raw = fs.readFileSync(file, "utf8");
const j = JSON.parse(raw);

j.expo = j.expo || {};
j.expo.owner = owner;
j.expo.slug = slug;
if (name) j.expo.name = name;

j.expo.extra = j.expo.extra || {};
j.expo.extra.eas = j.expo.extra.eas || {};
j.expo.extra.eas.projectId = projectId;

fs.writeFileSync(file, JSON.stringify(j, null, 2) + "\n");
NODE

  echo "   patched: $f"
}

ensure_app_config_wrapper() {
  local app="$1"
  local dir="$ROOT/apps/$app"

  local cfg=""
  local ext=""
  if [ -f "$dir/app.config.ts" ]; then cfg="$dir/app.config.ts"; ext="ts"; fi
  if [ -z "$cfg" ] && [ -f "$dir/app.config.js" ]; then cfg="$dir/app.config.js"; ext="js"; fi
  if [ -z "$cfg" ] && [ -f "$dir/app.config.mjs" ]; then cfg="$dir/app.config.mjs"; ext="mjs"; fi

  [ -n "$cfg" ] || { echo "   (skip) no app.config.*"; return 0; }

  local base="$dir/app.config.base.$ext"

  # si déjà wrapper, on patch juste les constantes
  if grep -q "TONTON_EAS_WRAPPER" "$cfg"; then
    echo "   wrapper already present: $cfg"
    perl -pi -e "s/(const OWNER = ')[^']*(';)/\$1$OWNER\$2/;" "$cfg" || true
    perl -pi -e "s/(const SLUG = ')[^']*(';)/\$1${SLUG[$app]}\$2/;" "$cfg" || true
    perl -pi -e "s/(const NAME = ')[^']*(';)/\$1${NAME[$app]}\$2/;" "$cfg" || true
    perl -pi -e "s/(const PROJECT_ID = ')[^']*(';)/\$1${PROJECTID[$app]}\$2/;" "$cfg" || true
    return 0
  fi

  # création base + wrapper
  [ -f "$base" ] || {
    backup_file "$cfg"
    cp -a "$cfg" "$base"
    echo "   base created: $base"
  }

  backup_file "$cfg"

  if [ "$ext" = "ts" ]; then
    cat > "$cfg" <<TS
// TONTON_EAS_WRAPPER v1
import type { ExpoConfig, ConfigContext } from "expo/config";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const baseMod = require("./app.config.base");
const baseExport = (baseMod && (baseMod.default || baseMod)) || remember;

const OWNER = '$OWNER';
const SLUG = '${SLUG[$app]}';
const NAME = '${NAME[$app]}';
const PROJECT_ID = '${PROJECTID[$app]}';

export default (ctx: ConfigContext): ExpoConfig => {
  const baseAny: any = baseExport;
  const baseCfg: any = typeof baseAny === "function" ? baseAny(ctx) : baseAny;

  // normalise: certains exports peuvent être { expo: {...} } vs config direct
  const cfg: any = baseCfg && baseCfg.expo ? baseCfg.expo : (baseCfg || {});
  const extra: any = { ...(cfg.extra || {}) };
  extra.eas = { ...(extra.eas || {}), projectId: PROJECT_ID };

  return {
    ...(cfg || {}),
    owner: OWNER,
    slug: SLUG,
    name: NAME,
    extra,
  };
};
TS
  elif [ "$ext" = "js" ]; then
    cat > "$cfg" <<JS
/* TONTON_EAS_WRAPPER v1 */
const baseMod = require("./app.config.base");
const baseExport = (baseMod && (baseMod.default || baseMod)) || {};

const OWNER = '$OWNER';
const SLUG = '${SLUG[$app]}';
const NAME = '${NAME[$app]}';
const PROJECT_ID = '${PROJECTID[$app]}';

module.exports = (ctx) => {
  const baseAny = baseExport;
  const baseCfg = (typeof baseAny === "function") ? baseAny(ctx) : baseAny;

  const cfg = (baseCfg && baseCfg.expo) ? baseCfg.expo : (baseCfg || {});
  const extra = { ...(cfg.extra || {}) };
  extra.eas = { ...(extra.eas || {}), projectId: PROJECT_ID };

  return {
    ...(cfg || {}),
    owner: OWNER,
    slug: SLUG,
    name: NAME,
    extra,
  };
};
JS
  else
    # mjs
    cat > "$cfg" <<MJS
// TONTON_EAS_WRAPPER v1
import baseMod from "./app.config.base.mjs";

const baseExport = (baseMod && (baseMod.default || baseMod)) || {};

const OWNER = '$OWNER';
const SLUG = '${SLUG[$app]}';
const NAME = '${NAME[$app]}';
const PROJECT_ID = '${PROJECTID[$app]}';

export default (ctx) => {
  const baseAny = baseExport;
  const baseCfg = (typeof baseAny === "function") ? baseAny(ctx) : baseAny;

  const cfg = (baseCfg && baseCfg.expo) ? baseCfg.expo : (baseCfg || {});
  const extra = { ...(cfg.extra || {}) };
  extra.eas = { ...(extra.eas || {}), projectId: PROJECT_ID };

  return {
    ...(cfg || {}),
    owner: OWNER,
    slug: SLUG,
    name: NAME,
    extra,
  };
};
MJS
  fi

  echo "   wrapper written: $cfg"
}

show_effective_config() {
  local app="$1"
  local dir="$ROOT/apps/$app"
  local tmp
  tmp="$(mktemp)"

  (cd "$dir" && npx -y expo config --type public --json >"$tmp") 2>/dev/null || \
  (cd "$dir" && npx -y expo config --json >"$tmp")

  node - "$tmp" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
const cfg = JSON.parse(fs.readFileSync(file,"utf8"));

const owner = cfg.owner || "(null)";
const slug  = cfg.slug  || "(null)";
const pid   = (cfg.extra && cfg.extra.eas && cfg.extra.eas.projectId) ? cfg.extra.eas.projectId : "(null)";

console.log(`   effective: owner=${owner} slug=${slug} projectId=${pid}`);
NODE

  rm -f "$tmp"
}

try_eas_project_info() {
  local app="$1"
  local dir="$ROOT/apps/$app"
  echo "   eas project:info ($app)"
  if (cd "$dir" && npx -y eas whoami >/dev/null 2>&1); then
    (cd "$dir" && npx -y eas project:info) || true
  else
    echo "   (skip) not logged in EAS here. If needed: cd $dir && npx -y eas login"
  fi
}

echo "== Fix EAS projectId/slug/owner (ROOT=$ROOT) =="

for app in client merchant courier; do
  echo ""
  echo "-- $app --"
  ensure_app_config_wrapper "$app"
  patch_app_json "$app"
  show_effective_config "$app"
done

echo ""
echo "== EAS check (optional) =="
for app in client merchant courier; do
  try_eas_project_info "$app"
done

echo ""
echo "Done."
echo "Backups: *.bak.$ts + app.config.base.* if wrapper created"
