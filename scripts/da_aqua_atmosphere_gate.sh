#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-quick}"
TMP_ROOT="${TMPDIR:-/tmp}/da_aqua_atmosphere_gate"

pass() { printf "PASS  %s\n" "$1"; }
fail() { printf "FAIL  %s\n" "$1" >&2; exit 70; }
require_file() { [[ -f "$1" ]] || fail "missing:$1"; }
require_text() { local pattern="$1" file="$2" label="$3"; grep -Fq -- "$pattern" "$file" || fail "$label"; pass "$label"; }

SERVICE="$ROOT/services/api-nest/src/atmosphere/atmosphere.service.ts"
CONTROLLER="$ROOT/services/api-nest/src/atmosphere/atmosphere.controller.ts"
TYPES="$ROOT/services/api-nest/src/atmosphere/atmosphere.types.ts"
APP_MODULE="$ROOT/services/api-nest/src/app.module.ts"
COMMAND="$ROOT/scripts/da_atmosphere_weather.sh"
PROBE="$ROOT/scripts/da_atmosphere_probe.cjs"
CLIENT_HOOK="$ROOT/apps/client/ui/water/useAtmosphereCurrent.ts"
COURIER_HOOK="$ROOT/apps/courier/ui/water/useAtmosphereCurrent.ts"
MERCHANT_HOOK="$ROOT/apps/merchant/ui/water/useAtmosphereCurrent.ts"
CLIENT_WATER="$ROOT/apps/client/ui/water/GlobalWaterAtmosphere.tsx"
COURIER_WATER="$ROOT/apps/courier/ui/water/GlobalWaterAtmosphere.tsx"
MERCHANT_WATER="$ROOT/apps/merchant/ui/water/GlobalWaterAtmosphere.tsx"

for f in "$SERVICE" "$CONTROLLER" "$TYPES" "$APP_MODULE" "$COMMAND" "$PROBE" "$CLIENT_HOOK" "$COURIER_HOOK" "$MERCHANT_HOOK" "$CLIENT_WATER" "$COURIER_WATER" "$MERCHANT_WATER"; do require_file "$f"; done
pass "required_files"

cmp -s "$CLIENT_HOOK" "$COURIER_HOOK" || fail "weather_hook_parity_client_courier"
cmp -s "$CLIENT_HOOK" "$MERCHANT_HOOK" || fail "weather_hook_parity_client_merchant"
pass "weather_hook_byte_parity_3_apps"

require_text "AtmosphereModule" "$APP_MODULE" "atmosphere_module_registered"
require_text "@Controller('atmosphere')" "$CONTROLLER" "atmosphere_controller_present"
require_text "@Get('current')" "$CONTROLLER" "atmosphere_current_endpoint_present"
require_text "api.met.no/weatherapi/locationforecast/2.0/compact" "$SERVICE" "met_norway_provider_present"
require_text "DelishAfrica/1.0 https://delishafrica.me" "$SERVICE" "provider_user_agent_present"
require_text "if-modified-since" "$SERVICE" "provider_revalidation_present"
require_text "CACHE_TTL_MS = 15 * 60 * 1000" "$SERVICE" "provider_cache_ttl_present"
require_text "providerReceivesMarketAnchorOnly: true" "$SERVICE" "market_anchor_privacy_contract"
require_text "marketCoordinatesReturnedToApps: false" "$SERVICE" "market_coordinates_not_returned"
require_text "MET Norway" "$TYPES" "weather_attribution_typed"
require_text "CC BY 4.0" "$TYPES" "weather_license_typed"
require_text "source: 'override'" "$SERVICE" "weather_override_source_present"
require_text "source: 'stale'" "$SERVICE" "weather_stale_continuity_present"

require_text "useAtmosphereCurrent" "$CLIENT_WATER" "client_live_weather_wired"
require_text "useAtmosphereCurrent" "$COURIER_WATER" "courier_live_weather_wired"
require_text "useAtmosphereCurrent" "$MERCHANT_WATER" "merchant_live_weather_wired"
require_text "atmosphere.tuning.rain" "$CLIENT_WATER" "client_rain_reactive"
require_text "atmosphere.tuning.rain" "$COURIER_WATER" "courier_rain_reactive"
require_text "atmosphere.tuning.rain" "$MERCHANT_WATER" "merchant_rain_reactive"
require_text "atmosphere.tuning.mist" "$CLIENT_WATER" "client_mist_reactive"
require_text "atmosphere.tuning.mist" "$COURIER_WATER" "courier_mist_reactive"
require_text "atmosphere.tuning.mist" "$MERCHANT_WATER" "merchant_mist_reactive"
require_text "atmosphere.tuning.condensation" "$COURIER_WATER" "courier_condensation_reactive"
require_text "atmosphere.tuning.condensation" "$MERCHANT_WATER" "merchant_condensation_reactive"
require_text "REFRESH_MS = __DEV__ ? 45_000 : 10 * 60_000" "$CLIENT_HOOK" "weather_refresh_budget_present"

if grep -RqsF "api.met.no/weatherapi" "$ROOT/apps/client" "$ROOT/apps/courier" "$ROOT/apps/merchant"; then fail "weather_provider_must_not_be_called_directly_from_apps"; fi
pass "weather_provider_backend_proxy_only"

if grep -qsE "requestForegroundPermissionsAsync|getCurrentPositionAsync|watchPositionAsync" "$CLIENT_HOOK" "$COURIER_HOOK" "$MERCHANT_HOOK"; then fail "global_weather_must_not_request_new_location_permission"; fi
pass "global_weather_no_new_location_permission"

for weather_mode in auto clear cloud mist rain storm snow heat; do grep -Fq "$weather_mode" "$COMMAND" || fail "weather_command_mode_$weather_mode"; done
pass "weather_command_modes"

if [[ "$MODE" == "--full" || "$MODE" == "full" ]]; then
  rm -rf "$TMP_ROOT"; mkdir -p "$TMP_ROOT"
  (cd "$ROOT/services/api-nest" && npm run build >"$TMP_ROOT/api-build.log" 2>&1) || { tail -160 "$TMP_ROOT/api-build.log" >&2; fail "api_build"; }
  pass "api_build"
  (cd "$ROOT" && node "$PROBE" >"$TMP_ROOT/atmosphere-probe.log" 2>&1) || { cat "$TMP_ROOT/atmosphere-probe.log" >&2; fail "atmosphere_probe"; }
  pass "atmosphere_probe"
  for app in client courier merchant; do
    (cd "$ROOT/apps/$app" && npx tsc --noEmit >"$TMP_ROOT/tsc-$app.log" 2>&1) || { cat "$TMP_ROOT/tsc-$app.log" >&2; fail "tsc_$app"; }
    pass "tsc_$app"
  done
  for app in client courier merchant; do
    for platform in ios android; do
      out="$TMP_ROOT/export-$app-$platform"
      (cd "$ROOT/apps/$app" && npx expo export --platform "$platform" --output-dir "$out" >"$TMP_ROOT/export-$app-$platform.log" 2>&1) || { tail -160 "$TMP_ROOT/export-$app-$platform.log" >&2; fail "export_${app}_${platform}"; }
      pass "export_${app}_${platform}"
    done
  done
fi

printf "\nDA_AQUA_ATMOSPHERE_GATE=GREEN mode=%s\n" "$MODE"
