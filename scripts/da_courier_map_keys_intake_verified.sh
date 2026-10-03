#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/apps/courier"
SERVER_SECRET="/opt/delishafrica/secrets/da_google_routes_v1.key"
TMP_A=""
TMP_B=""

cleanup() {
  for f in "$TMP_A" "$TMP_B"; do
    [[ -n "$f" && -f "$f" ]] || continue
    chmod 600 "$f" 2>/dev/null || true
    if command -v shred >/dev/null 2>&1; then
      shred -u "$f" 2>/dev/null || rm -f "$f"
    else
      rm -f "$f"
    fi
  done
  unset KEY_A KEY_B ROUTES_KEY ANDROID_KEY
}
trap cleanup EXIT

fail() { printf "FAIL  %s\n" "$1" >&2; exit 70; }
pass() { printf "PASS  %s\n" "$1"; }

[[ -d "$APP" ]] || fail "courier_app_missing"
sudo -n true >/dev/null 2>&1 || fail "passwordless_sudo_required_for_secret_install"
command -v node >/dev/null 2>&1 || fail "node_required_for_provider_probe"

printf "DelishAfrica Courier verified Map/Routes key intake\n"
printf "Paste both Google keys in any order. Values stay masked and are never printed.\n"
printf "The script promotes only after a real server-side Routes probe identifies the backend key.\n\n"

read -rsp "Google API key 1: " KEY_A
printf "\n"
read -rsp "Google API key 2: " KEY_B
printf "\n"

[[ ${#KEY_A} -ge 20 ]] || fail "key_1_too_short"
[[ ${#KEY_B} -ge 20 ]] || fail "key_2_too_short"
[[ "$KEY_A" != *$n* && "$KEY_B" != *$n* ]] || fail "newline_in_key"
[[ "$KEY_A" != "$KEY_B" ]] || fail "keys_must_be_distinct"

umask 077
TMP_A="$(mktemp "${TMPDIR:-/tmp}/da-google-key-a.XXXXXX")"
TMP_B="$(mktemp "${TMPDIR:-/tmp}/da-google-key-b.XXXXXX")"
printf "%s\n" "$KEY_A" > "$TMP_A"
printf "%s\n" "$KEY_B" > "$TMP_B"
unset KEY_A KEY_B

probe_routes() {
  local key_file="$1"
  node - "$key_file" <<NODE
const fs = require(fs);
const keyFile = process.argv[2];
const key = fs.readFileSync(keyFile, utf8).trim();
const body = {
  origin: { location: { latLng: { latitude: 50.8466, longitude: 4.3528 } } },
  destination: { location: { latLng: { latitude: 50.8359, longitude: 4.3717 } } },
  travelMode: DRIVE,
  routingPreference: TRAFFIC_AWARE,
};
(async () => {
  try {
    const response = await fetch(https://routes.googleapis.com/directions/v2:computeRoutes, {
      method: POST,
      headers: {
        content-type: application/json,
        X-Goog-Api-Key: key,
        X-Goog-FieldMask: routes.distanceMeters,routes.duration,
      },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    if (response.ok) {
      let payload = {};
      try { payload = JSON.parse(text); } catch {}
      if (Array.isArray(payload.routes) && payload.routes.length > 0) {
        console.log(OK);
        return;
      }
      console.log(ERR:provider_empty_response);
      return;
    }
    let payload = {};
    try { payload = JSON.parse(text); } catch {}
    const status = payload?.error?.status || HTTP_ + response.status;
    const message = String(payload?.error?.message || provider_rejected).replace(/[\r\n]+/g,  ).slice(0, 240);
    console.log(`ERR:${status}:${message}`);
  } catch (error) {
    console.log(ERR:NETWORK: + String(error?.message || error).replace(/[\r\n]+/g,  ).slice(0, 160));
  }
})();
NODE
}

RESULT_A="$(probe_routes "$TMP_A")"
RESULT_B="$(probe_routes "$TMP_B")"

A_OK=0
B_OK=0
[[ "$RESULT_A" == "OK" ]] && A_OK=1
[[ "$RESULT_B" == "OK" ]] && B_OK=1

if [[ $A_OK -eq 1 && $B_OK -eq 0 ]]; then
  ROUTES_FILE="$TMP_A"
  ANDROID_FILE="$TMP_B"
elif [[ $A_OK -eq 0 && $B_OK -eq 1 ]]; then
  ROUTES_FILE="$TMP_B"
  ANDROID_FILE="$TMP_A"
elif [[ $A_OK -eq 1 && $B_OK -eq 1 ]]; then
  fail "both_keys_can_call_routes_restrictions_too_broad"
else
  printf "Routes probe key 1: %s\n" "$RESULT_A" >&2
  printf "Routes probe key 2: %s\n" "$RESULT_B" >&2
  fail "no_key_passed_live_routes_probe_enable_routes_api_and_verify_key_restrictions"
fi

pass "routes_backend_key_identified_by_live_provider_probe"
pass "android_maps_key_separated_from_backend_key"

ROUTES_KEY="$(cat "$ROUTES_FILE")"
ANDROID_KEY="$(cat "$ANDROID_FILE")"

sudo install -o root -g root -m 600 "$ROUTES_FILE" "$SERVER_SECRET"
pass "backend_routes_secret_installed_root_600"

(
  cd "$APP"
  npx eas-cli whoami >/dev/null
  npx eas-cli env:create production \
    --name DA_COURIER_ANDROID_GOOGLE_MAPS_API_KEY \
    --value "$ANDROID_KEY" \
    --visibility secret \
    --force \
    --non-interactive >/tmp/da_courier_eas_maps_key_set.log 2>&1
)
pass "android_maps_key_set_in_eas_production"

unset ROUTES_KEY ANDROID_KEY
sudo -n test -s "$SERVER_SECRET" || fail "backend_routes_secret_verify"
pass "backend_routes_secret_verified"

if (
  cd "$APP"
  npx eas-cli env:list production --format short 2>/dev/null |
    grep -Fq "DA_COURIER_ANDROID_GOOGLE_MAPS_API_KEY"
); then
  pass "android_maps_eas_name_verified"
else
  fail "android_maps_eas_name_not_visible"
fi

printf "\nDA_COURIER_MAP_KEYS_INTAKE_VERIFIED=READY\n"
printf "The backend key passed a real Google Routes request before promotion.\n"
printf "No secret value was printed. Run the release preflight next:\n"
printf "  %s/scripts/da_courier_map_release_preflight.sh\n" "$ROOT"
