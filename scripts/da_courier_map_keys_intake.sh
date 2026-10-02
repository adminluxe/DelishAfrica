#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/apps/courier"
SERVER_SECRET="/opt/delishafrica/secrets/da_google_routes_v1.key"
TMP_SECRET=""

cleanup() {
  if [[ -n "$TMP_SECRET" && -f "$TMP_SECRET" ]]; then
    chmod 600 "$TMP_SECRET" 2>/dev/null || true
    if command -v shred >/dev/null 2>&1; then
      shred -u "$TMP_SECRET" 2>/dev/null || rm -f "$TMP_SECRET"
    else
      rm -f "$TMP_SECRET"
    fi
  fi
  unset ROUTES_KEY ANDROID_KEY
}
trap cleanup EXIT

fail() { printf "FAIL  %s\n" "$1" >&2; exit 70; }
pass() { printf "PASS  %s\n" "$1"; }

[[ -d "$APP" ]] || fail "courier_app_missing"
sudo -n true >/dev/null 2>&1 || fail "passwordless_sudo_required_for_secret_install"

printf "DelishAfrica Courier Map secure key intake\n"
printf "No secret value will be printed or written to Git.\n\n"

read -rsp "Google Routes backend API key: " ROUTES_KEY
printf "\n"
read -rsp "Google Maps Android SDK key: " ANDROID_KEY
printf "\n"

[[ ${#ROUTES_KEY} -ge 20 ]] || fail "routes_key_too_short"
[[ ${#ANDROID_KEY} -ge 20 ]] || fail "android_maps_key_too_short"
[[ "$ROUTES_KEY" != *$'\n'* && "$ANDROID_KEY" != *$'\n'* ]] || fail "newline_in_key"

umask 077
TMP_SECRET="$(mktemp "${TMPDIR:-/tmp}/da-google-routes.XXXXXX")"
printf "%s\n" "$ROUTES_KEY" > "$TMP_SECRET"
sudo install -o root -g root -m 600 "$TMP_SECRET" "$SERVER_SECRET"
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

printf "\nDA_COURIER_MAP_KEYS_INTAKE=READY\n"
printf "Backend secret file installed and EAS production variable created.\n"
printf "Security reminder: restrict the Android key in Google Cloud to package com.delishafrica.courier + the expected signing certificate, and restrict the Routes key to the Routes API and VPS egress before promotion.\n"
printf "After the secure-plumbing branch is promoted and the API is recreated, run:\n"
printf "  %s/scripts/da_courier_map_release_preflight.sh\n" "$ROOT"
