#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-quick}"
TMP_ROOT="${TMPDIR:-/tmp}/da_courier_mission_current_gate"

fail() { printf "FAIL  %s\n" "$1" >&2; exit 70; }
pass() { printf "PASS  %s\n" "$1"; }
require_text() {
  local pattern="$1" file="$2" label="$3"
  grep -Fq -- "$pattern" "$file" || fail "$label"
  pass "$label"
}

MAP="$ROOT/apps/courier/app/courier-integrated-map.tsx"
ORDERS="$ROOT/apps/courier/app/orders/index.tsx"
ORACLE="$ROOT/apps/courier/app/route-oracle.tsx"
HOME="$ROOT/apps/courier/app/index.tsx"
TERRAIN="$ROOT/apps/courier/app/terrain-live.tsx"
APP_CONFIG="$ROOT/apps/courier/app.config.ts"
RELEASE_PREFLIGHT="$ROOT/scripts/da_courier_map_release_preflight.sh"
ROUTE_PROBE="$ROOT/scripts/da_courier_mission_route_probe.cjs"
ROUTE_SERVICE="$ROOT/services/api-nest/src/routes-preview/routes-preview.service.ts"
ROUTE_CONTROLLER="$ROOT/services/api-nest/src/routes-preview/routes-preview.controller.ts"
ROUTE_TYPES="$ROOT/services/api-nest/src/routes-preview/routes-preview.types.ts"
COMPOSE="$ROOT/docker-compose.yml"
KEY_INTAKE="$ROOT/scripts/da_courier_map_keys_intake.sh"

for file in "$MAP" "$ORDERS" "$ORACLE" "$HOME" "$TERRAIN" "$APP_CONFIG" "$RELEASE_PREFLIGHT" "$ROUTE_PROBE" "$ROUTE_SERVICE" "$ROUTE_CONTROLLER" "$ROUTE_TYPES" "$COMPOSE" "$KEY_INTAKE"; do
  [[ -f "$file" ]] || fail "missing:$file"
done
pass "required_files"

require_text 'source: "courier-mission-current"' "$MAP" "route_preview_source_present"
require_text 'mode: "DRIVE"' "$MAP" "traffic_aware_drive_baseline_present"
require_text 'routePreview?.etaMinutes' "$MAP" "road_eta_preferred"
require_text 'decodePolyline' "$MAP" "provider_polyline_decoder_present"
require_text 'ROUTE_HARD_MIN_MS = 12_000' "$MAP" "route_hard_throttle_present"
require_text 'ROUTE_REFRESH_MS = 75_000' "$MAP" "route_refresh_budget_present"
require_text 'ROUTE_REFRESH_MOVE_METERS = 180' "$MAP" "route_move_budget_present"
require_text 'animateCamera' "$MAP" "mission_current_follow_camera_present"
require_text 'onPanDrag={() => setFollowMode(false)}' "$MAP" "manual_map_control_breaks_follow"
require_text 'AccessibilityInfo.isReduceMotionEnabled' "$MAP" "follow_camera_reduce_motion_guard"
require_text 'ARRIVÉ AU RESTAURANT' "$MAP" "pickup_arrival_truth_present"
require_text 'ARRIVÉ CHEZ LE CLIENT' "$MAP" "delivery_arrival_truth_present"
require_text 'if (!mission || statusOf(mission) === "delivered") return undefined' "$MAP" "location_requires_active_mission"
require_text 'postMissionStatus' "$MAP" "mission_status_commit_present"
require_text 'for (const waitMs of [0, 320, 850])' "$MAP" "status_write_read_confirmation_present"
require_text 'Commande récupérée' "$MAP" "pickup_single_action_present"
require_text 'Commande remise' "$MAP" "delivery_single_action_present"
require_text 'Une mission · une cible · une action.' "$MAP" "single_mission_contract_present"
require_text 'GPS ROUTIER ↗' "$MAP" "native_guidance_escape_hatch_present"
require_text 'assignmentAccepted' "$MAP" "assignment_guard_present"
require_text 'requestedOrderId' "$MAP" "exact_mission_deeplink_present"
require_text 'PROCHAIN GESTE' "$MAP" "vector_next_maneuver_ui_present"
require_text 'maneuverGlyph' "$MAP" "vector_maneuver_symbolizer_present"
require_text 'routePreview?.maneuvers?.[0]' "$MAP" "vector_provider_maneuver_consumed"
require_text 'styles.missionMarker' "$MAP" "route_aura_custom_mission_markers_present"
require_text 'styles.courierMarkerAura' "$MAP" "route_aura_courier_beacon_present"
require_text 'rotation={courierHeading}' "$MAP" "route_aura_heading_cursor_present"
require_text 'strokeWidth={14}' "$MAP" "route_aura_dual_polyline_halo_present"
require_text 'radius={arrivalRadiusMeters}' "$MAP" "route_aura_arrival_zone_present"
require_text 'maneuverAtProgress' "$MAP" "vector_local_progression_present"
require_text 'routeProgressMeters' "$MAP" "vector_progress_state_present"
require_text 'OFF_ROUTE_THRESHOLD_METERS = 220' "$MAP" "vector_corridor_threshold_present"
require_text 'OFF_ROUTE_REFRESH_COOLDOWN_MS = 30_000' "$MAP" "vector_corridor_refresh_budget_present"
require_text 'nearestRoutePointDistanceMeters' "$MAP" "vector_corridor_distance_present"
require_text 'Écart au corridor détecté' "$MAP" "vector_corridor_truth_copy_present"
require_text 'routes.legs.steps.navigationInstruction.instructions' "$ROUTE_SERVICE" "provider_navigation_field_mask_present"
require_text 'normalizeManeuvers' "$ROUTE_SERVICE" "provider_navigation_normalizer_present"
require_text 'maneuvers: RouteManeuver[]' "$ROUTE_TYPES" "route_maneuvers_typed"
require_text 'GOOGLE_ROUTES_API_KEY_FILE' "$ROUTE_SERVICE" "routes_secret_file_contract_present"
require_text "fs.readFileSync(keyFile, 'utf8')" "$ROUTE_SERVICE" "routes_secret_file_reader_present"
require_text 'providerReady: this.routesPreview.providerReady()' "$ROUTE_CONTROLLER" "routes_health_uses_real_secret_resolution"
require_text 'GOOGLE_ROUTES_API_KEY_FILE: "/run/secrets/da-google-routes-v1"' "$COMPOSE" "routes_secret_file_env_mounted"
require_text '/opt/delishafrica/secrets/da_google_routes_v1.key:/run/secrets/da-google-routes-v1:ro' "$COMPOSE" "routes_secret_bind_mount_present"
require_text 'DA_COURIER_ANDROID_GOOGLE_MAPS_API_KEY' "$KEY_INTAKE" "secure_android_maps_intake_present"
require_text 'backend_routes_secret_file_present' "$RELEASE_PREFLIGHT" "preflight_checks_backend_secret_file"
require_text 'android_google_maps_key_present_in_eas_production' "$RELEASE_PREFLIGHT" "preflight_checks_eas_production_name"

require_text 'pathname: "/courier-integrated-map"' "$ORACLE" "oracle_accept_to_current"
require_text 'launch: "accepted"' "$ORACLE" "oracle_immediate_launch_marker"
require_text 'Partir vers le restaurant' "$ORACLE" "oracle_pickup_copy_present"
require_text 'pathname: "/courier-integrated-map"' "$ORDERS" "orders_to_current"
require_text 'Continuer vers le client' "$ORDERS" "orders_delivery_copy_present"
require_text 'Mission Current' "$HOME" "home_current_entry_present"
require_text 'pathname: "/courier-integrated-map"' "$TERRAIN" "terrain_to_current"
require_text 'DA_COURIER_ANDROID_GOOGLE_MAPS_API_KEY' "$APP_CONFIG" "android_maps_key_env_contract"
require_text 'googleMaps: { apiKey: ANDROID_GOOGLE_MAPS_API_KEY }' "$APP_CONFIG" "android_maps_key_injection_contract"
require_text 'backend_routes_provider_not_ready' "$RELEASE_PREFLIGHT" "strict_route_provider_preflight_present"
require_text 'android_google_maps_key_missing' "$RELEASE_PREFLIGHT" "strict_android_maps_preflight_present"

if grep -n 'setTimeout(() => router.push("/orders"' "$ORACLE" >/dev/null 2>&1; then
  fail "oracle_accept_must_not_detour_to_cockpit"
fi
pass "oracle_accept_no_cockpit_detour"

if grep -n 'pathname: "/courier-real-map"' "$ORDERS" >/dev/null 2>&1; then
  fail "orders_primary_guidance_must_not_use_legacy_map"
fi
pass "orders_primary_guidance_uses_current"

if [[ "$MODE" == "--full" || "$MODE" == "full" ]]; then
  rm -rf "$TMP_ROOT"
  mkdir -p "$TMP_ROOT"

  (cd "$ROOT/services/api-nest" && npm run build >"$TMP_ROOT/api-build.log" 2>&1) || {
    tail -180 "$TMP_ROOT/api-build.log" >&2
    fail "api_build"
  }
  pass "api_build"

  (cd "$ROOT" && node "$ROUTE_PROBE" >"$TMP_ROOT/route-probe.log" 2>&1) || {
    cat "$TMP_ROOT/route-probe.log" >&2
    fail "route_preview_probe"
  }
  pass "route_preview_probe"

  (cd "$ROOT/apps/courier" && npx tsc --noEmit >"$TMP_ROOT/tsc.log" 2>&1) || {
    cat "$TMP_ROOT/tsc.log" >&2
    fail "tsc_courier"
  }
  pass "tsc_courier"

  for platform in ios android; do
    out="$TMP_ROOT/export-$platform"
    (cd "$ROOT/apps/courier" && EXPO_NO_TELEMETRY=1 npx expo export --platform "$platform" --output-dir "$out" >"$TMP_ROOT/export-$platform.log" 2>&1) || {
      tail -180 "$TMP_ROOT/export-$platform.log" >&2
      fail "export_courier_$platform"
    }
    pass "export_courier_$platform"
  done
fi

printf "\nDA_COURIER_MISSION_CURRENT_GATE=GREEN mode=%s\n" "$MODE"
