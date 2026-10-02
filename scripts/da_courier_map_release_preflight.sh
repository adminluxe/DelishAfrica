#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/apps/courier"
API_HEALTH="${DA_API_BASE_URL:-https://api.delishafrica.me/api/v1}/routes/health"
TMP="${TMPDIR:-/tmp}/da_courier_map_release_preflight"
STRICT="${DA_MAP_PREFLIGHT_STRICT:-1}"

mkdir -p "$TMP"

failures=0
pass() { printf "PASS     %s\n" "$1"; }
blocked() { printf "BLOCKED  %s\n" "$1"; failures=$((failures + 1)); }

(cd "$APP" && EXPO_NO_TELEMETRY=1 npx expo config --json) >"$TMP/config.json" 2>"$TMP/config.err" || {
  cat "$TMP/config.err" >&2
  blocked "expo_config_unreadable"
}

node - "$TMP/config.json" "$TMP/android-key-local.txt" <<'NODE' || failures=$((failures + 1))
const fs = require("fs");
const path = process.argv[2];
const keyStatusPath = process.argv[3];
const cfg = JSON.parse(fs.readFileSync(path, "utf8"));
const androidKey = cfg?.android?.config?.googleMaps?.apiKey;
const pkg = cfg?.android?.package;
const ios = cfg?.ios?.bundleIdentifier;
let idsOk = true;
if (pkg === "com.delishafrica.courier") console.log("PASS     android_package");
else { console.log(`BLOCKED  android_package=${pkg || "missing"}`); idsOk = false; }
if (ios === "com.delishafrica.courier") console.log("PASS     ios_bundle");
else { console.log(`BLOCKED  ios_bundle=${ios || "missing"}`); idsOk = false; }
fs.writeFileSync(keyStatusPath, androidKey ? "1\n" : "0\n");
if (!idsOk) process.exitCode = 2;
NODE

android_key_ready=0
if [[ "$(cat "$TMP/android-key-local.txt" 2>/dev/null || echo 0)" == "1" ]]; then
  pass "android_google_maps_key_injected_locally"
  android_key_ready=1
else
  if (cd "$APP" && npx eas-cli env:list production --format short >"$TMP/eas-env-list.txt" 2>"$TMP/eas-env-list.err"); then
    if grep -Fq "DA_COURIER_ANDROID_GOOGLE_MAPS_API_KEY" "$TMP/eas-env-list.txt"; then
      pass "android_google_maps_key_present_in_eas_production"
      android_key_ready=1
    fi
  fi
fi
if [[ "$android_key_ready" -ne 1 ]]; then
  blocked "android_google_maps_key_missing_local_and_eas_production"
fi

if sudo -n test -s /opt/delishafrica/secrets/da_google_routes_v1.key 2>/dev/null; then
  pass "backend_routes_secret_file_present"
else
  blocked "backend_routes_secret_file_missing"
fi

if curl -fsS --max-time 6 "$API_HEALTH" >"$TMP/routes-health.json"; then
  if node - "$TMP/routes-health.json" <<'NODE'
const fs = require("fs");
const h = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (h?.providerReady === true && h?.keyExposedToClient === false) {
  console.log("PASS     backend_routes_provider_ready_private");
  process.exit(0);
}
console.log("BLOCKED  backend_routes_provider_not_ready");
process.exit(2);
NODE
  then
    :
  else
    failures=$((failures + 1))
  fi
else
  blocked "routes_health_unreachable"
fi

if [[ "$failures" -eq 0 ]]; then
  printf "\nDA_COURIER_MAP_RELEASE_PREFLIGHT=GREEN\n"
  exit 0
fi

printf "\nDA_COURIER_MAP_RELEASE_PREFLIGHT=BLOCKED failures=%s\n" "$failures"
printf "No secret value was printed. Android Maps may be supplied locally or through EAS production; backend Routes must use /opt/delishafrica/secrets/da_google_routes_v1.key and report providerReady:true.\n"

if [[ "$STRICT" == "0" ]]; then
  exit 0
fi
exit 78
