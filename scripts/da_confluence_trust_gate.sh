#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-quick}"
TMP_ROOT="${TMPDIR:-/tmp}/da_confluence_trust_gate"

pass() { printf "PASS  %s\n" "$1"; }
fail() { printf "FAIL  %s\n" "$1" >&2; exit 70; }
require_file() { [[ -f "$1" ]] || fail "missing:$1"; }
require_text() { local pattern="$1" file="$2" label="$3"; grep -Fq -- "$pattern" "$file" || fail "$label"; pass "$label"; }

CLIENT_LENS="$ROOT/apps/client/ui/confluence/ConfluenceOracleLens.tsx"
COURIER_LENS="$ROOT/apps/courier/ui/confluence/ConfluenceOracleLens.tsx"
MERCHANT_LENS="$ROOT/apps/merchant/ui/confluence/ConfluenceOracleLens.tsx"
CLIENT_HOOK="$ROOT/apps/client/ui/confluence/useConfluenceSuggestion.ts"
COURIER_HOOK="$ROOT/apps/courier/ui/confluence/useConfluenceSuggestion.ts"
MERCHANT_HOOK="$ROOT/apps/merchant/ui/confluence/useConfluenceSuggestion.ts"
SERVICE="$ROOT/services/api-nest/src/confluence-ai/confluence-ai.service.ts"
POLICY="$ROOT/services/api-nest/src/confluence-ai/confluence-ai.policy.ts"
TYPES="$ROOT/services/api-nest/src/confluence-ai/confluence-ai.types.ts"
CLIENT_ORACLE="$ROOT/apps/client/app/taste-oracle.tsx"
COURIER_ORACLE="$ROOT/apps/courier/app/route-oracle.tsx"

for f in "$CLIENT_LENS" "$COURIER_LENS" "$MERCHANT_LENS" "$CLIENT_HOOK" "$COURIER_HOOK" "$MERCHANT_HOOK" "$SERVICE" "$POLICY" "$TYPES" "$CLIENT_ORACLE" "$COURIER_ORACLE"; do
  require_file "$f"
done
pass "required_files"

cmp -s "$CLIENT_LENS" "$COURIER_LENS" || fail "lens_parity_client_courier"
cmp -s "$CLIENT_LENS" "$MERCHANT_LENS" || fail "lens_parity_client_merchant"
pass "lens_byte_parity_3_apps"
cmp -s "$CLIENT_HOOK" "$COURIER_HOOK" || fail "hook_parity_client_courier"
cmp -s "$CLIENT_HOOK" "$MERCHANT_HOOK" || fail "hook_parity_client_merchant"
pass "hook_byte_parity_3_apps"

require_text "store: false" "$SERVICE" "provider_store_disabled"
require_text "requestContainsSensitiveEvidence(body)" "$SERVICE" "sensitive_request_guard_present"
require_text "providerStore: false" "$SERVICE" "privacy_meta_store_false"
require_text "sensitiveEvidenceTransit: false" "$SERVICE" "privacy_meta_sensitive_transit_false"
require_text "actionSideEffects: false" "$SERVICE" "side_effect_contract_false"
require_text "contains_context" "$POLICY" "context_uncertainty_taxonomy"
require_text "providerStore: false" "$TYPES" "privacy_contract_typed"
require_text "COUNTERFLOW" "$CLIENT_ORACLE" "client_counterflow_present"
require_text "SAS HUMAIN · AUCUNE ACTION ENVOYÉE" "$COURIER_ORACLE" "courier_decision_sandbox_present"
require_text "setDecisionPreviewOpen((value) => !value)" "$COURIER_ORACLE" "decision_preview_local_toggle"

sensitive_line="$(grep -nF "requestContainsSensitiveEvidence(body)" "$SERVICE" | head -1 | cut -d: -f1)"
provider_line="$(grep -nF "providerSuggestion(input" "$SERVICE" | head -1 | cut -d: -f1)"
[[ -n "$sensitive_line" && -n "$provider_line" && "$sensitive_line" -lt "$provider_line" ]] || fail "sensitive_guard_precedes_provider"
pass "sensitive_guard_precedes_provider"

if [[ "$MODE" == "--full" || "$MODE" == "full" ]]; then
  rm -rf "$TMP_ROOT"
  mkdir -p "$TMP_ROOT"

  (cd "$ROOT/services/api-nest" && npm run build >"$TMP_ROOT/api-build.log" 2>&1) || { tail -120 "$TMP_ROOT/api-build.log" >&2; fail "api_build"; }
  pass "api_build"

  for app in client courier merchant; do
    (cd "$ROOT/apps/$app" && npx tsc --noEmit >"$TMP_ROOT/tsc-$app.log" 2>&1) || { cat "$TMP_ROOT/tsc-$app.log" >&2; fail "tsc_$app"; }
    pass "tsc_$app"
  done

  for app in client courier merchant; do
    for platform in ios android; do
      out="$TMP_ROOT/export-$app-$platform"
      (cd "$ROOT/apps/$app" && npx expo export --platform "$platform" --output-dir "$out" >"$TMP_ROOT/export-$app-$platform.log" 2>&1) || { tail -140 "$TMP_ROOT/export-$app-$platform.log" >&2; fail "export_${app}_${platform}"; }
      pass "export_${app}_${platform}"
    done
  done
fi

printf "\nCONFLUENCE_TRUST_GATE=GREEN mode=%s\n" "$MODE"
