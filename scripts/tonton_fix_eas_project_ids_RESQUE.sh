#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
cd "$ROOT"
ts="$(date +%Y%m%d_%H%M%S)"

OWNER="delishafrica"

declare -A SLUG PID NAME
SLUG[client]="delishafrica-client"
PID[client]="394e7d6f-559b-4536-81a9-fbc0cdb0c68f"
NAME[client]="DelishAfrica Client"

SLUG[merchant]="delishafrica-merchant"
PID[merchant]="292e5d9e-9dbe-4dfb-baf7-ed80cf2e2bbc"
NAME[merchant]="DelishAfrica Merchant"

SLUG[courier]="delishafrica-courier"
PID[courier]="dae37d7c-369e-43c6-a4d1-ba62bf8c0bc6"
NAME[courier]="DelishAfrica Courier"

backup() {
  local f="$1"
  [ -f "$f" ] || return 0
  cp -a "$f" "${f}.bak.${ts}"
  echo "   backup: ${f}.bak.${ts}"
}

restore_if_wrapper() {
  local cfg="$1"
  if [ -f "$cfg" ] && grep -q "TONTON_EAS_WRAPPER" "$cfg"; then
    local bak
    bak="$(ls -1t "${cfg}.bak."* 2>/dev/null | head -n1 || true)"
    if [ -n "$bak" ]; then
      cp -a "$bak" "$cfg"
      echo "   restored from: $bak"
    else
      echo "   ⚠️ wrapper detected but no backup found: $cfg"
    fi
    rm -f "$(dirname "$cfg")/app.config.base."* 2>/dev/null || true
  fi
}

patch_app_config() {
  local app="$1"
  local dir="$ROOT/apps/$app"
  local cfg=""

  for f in app.config.ts app.config.js app.config.mjs; do
    if [ -f "$dir/$f" ]; then cfg="$dir/$f"; break; fi
  done

  if [ -z "$cfg" ]; then
    echo "   (skip) no app.config.*"
    return 0
  fi

  restore_if_wrapper "$cfg"
  backup "$cfg"

  # Patch owner/slug/name si présents + projectId UUID (le cas qui nous bloque)
  perl -pi -e "s/(\\bowner\\s*:\\s*['\\\"]).*?(['\\\"])/\\1$OWNER\\2/g" "$cfg" || true
  perl -pi -e "s/(\\bslug\\s*:\\s*['\\\"]).*?(['\\\"])/\\1$ {\"SLUG\"} \\2/g" "$cfg" >/dev/null 2>&1 || true

  # (le perl au-dessus avec expansion bash est fragile selon shell; on fait propre juste après)
  perl -pi -e "s/(\\bslug\\s*:\\s*['\\\"]).*?(['\\\"])/\\1$SLUG_APP\\2/g" "$cfg" || true
  perl -pi -e "s/(\\bname\\s*:\\s*['\\\"]).*?(['\\\"])/\\1$NAME_APP\\2/g" "$cfg" || true
  perl -pi -e "s/(\\bprojectId\\s*:\\s*['\\\"])[0-9a-fA-F-]{36}(['\\\"])/\\1$PID_APP\\2/g" "$cfg" || true

  echo "   patched config: $cfg"
}

patch_app_json() {
  local app="$1"
  local file="$ROOT/apps/$app/app.json"
  [ -f "$file" ] || { echo "   (skip) no app.json"; return 0; }

  backup "$file"

  node - "$file" "$OWNER" "${SLUG[$app]}" "${NAME[$app]}" "${PID[$app]}" <<'NODE'
const fs = require("fs");
const [,, file, owner, slug, name, projectId] = process.argv;
const j = JSON.parse(fs.readFileSync(file, "utf8"));

j.expo = j.expo || {};
j.expo.owner = owner;
j.expo.slug = slug;
if (name) j.expo.name = name;

j.expo.extra = j.expo.extra || {};
j.expo.extra.eas = j.expo.extra.eas || {};
j.expo.extra.eas.projectId = projectId;

fs.writeFileSync(file, JSON.stringify(j, null, 2) + "\n");
NODE

  echo "   patched json: $file"
}

show_effective() {
  local app="$1"
  local dir="$ROOT/apps/$app"
  echo "   effective via expo config:"
  (cd "$dir" && npx -y expo config --type public --json 2>/dev/null | node -e '
    const fs=require("fs");
    const raw=fs.readFileSync(0,"utf8");
    const cfg=JSON.parse(raw);
    const owner=cfg.owner ?? "(null)";
    const slug=cfg.slug ?? "(null)";
    const pid=cfg?.extra?.eas?.projectId ?? "(null)";
    console.log(`     owner=${owner}`);
    console.log(`     slug=${slug}`);
    console.log(`     projectId=${pid}`);
  ') || echo "     ⚠️ expo config failed (check app.config syntax)"
}

echo "== RESCUE EAS projectId/slug/owner (ROOT=$ROOT) =="

for app in client merchant courier; do
  echo ""
  echo "-- $app --"
  export SLUG_APP="${SLUG[$app]}"
  export PID_APP="${PID[$app]}"
  export NAME_APP="${NAME[$app]}"

  patch_app_config "$app"
  patch_app_json "$app"
  show_effective "$app"
done

echo ""
echo "Done. Backups created: *.bak.$ts"
echo "Next: run eas project:info per app."
