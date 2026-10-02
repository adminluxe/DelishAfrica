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

node - "$TMP/config.json" <<'NODE' || failures=$((failures + 1))
const fs = require("fs");
const path = process.argv[2];
const cfg = JSON.parse(fs.readFileSync(path, "utf8"));
const androidKey = cfg?.android?.config?.googleMaps?.apiKey;
const pkg = cfg?.android?.package;
const ios = cfg?.ios?.bundleIdentifier;
console.log(pkg === "com.delishafrica.courier" ? "PASS     android_package" : `BLOCKED  android_package=${pkg || "missing"}`);
console.log(ios === "com.delishafrica.courier" ? "PASS     ios_bundle" : `BLOCKED  ios_bundle=${ios || "missing"}`);
if (!androidKey) {
  console.log("BLOCKED  android_google_maps_key_missing");
  process.exitCode = 2;
} else {
  console.log("PASS     android_google_maps_key_injected");
}
NODE

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
printf "No secret value was printed. Configure a package/SHA-restricted Android Maps SDK key for the app and a server/IP-restricted Routes API key for the backend.\n"

if [[ "$STRICT" == "0" ]]; then
  exit 0
fi
exit 78
