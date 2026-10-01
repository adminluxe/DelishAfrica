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
MERCHANT_ORACLE="$ROOT/apps/merchant/app/service-oracle.tsx"
DISPATCH_SERVICE="$ROOT/services/api-nest/src/dispatch-intelligence/assignment-intelligence.service.ts"
FRUGAL_PROBE="$ROOT/scripts/da_confluence_frugal_probe.cjs"

for f in "$CLIENT_LENS" "$COURIER_LENS" "$MERCHANT_LENS" "$CLIENT_HOOK" "$COURIER_HOOK" "$MERCHANT_HOOK" "$SERVICE" "$POLICY" "$TYPES" "$CLIENT_ORACLE" "$COURIER_ORACLE" "$MERCHANT_ORACLE" "$DISPATCH_SERVICE" "$FRUGAL_PROBE"; do
  require_file "$f"
done
pass "required_files"

cmp -s "$CLIENT_LENS" "$COURIER_LENS" || fail "lens_parity_client_courier"
cmp -s "$CLIENT_LENS" "$MERCHANT_LENS" || fail "lens_parity_client_merchant"
pass "lens_byte_parity_3_apps"
cmp -s "$CLIENT_HOOK" "$COURIER_HOOK" || fail "hook_parity_client_courier"
cmp -s "$CLIENT_HOOK" "$MERCHANT_HOOK" || fail "hook_parity_client_merchant"
pass "hook_byte_parity_3_apps"

require_text "requestLooksSensitiveLocally" "$CLIENT_HOOK" "local_sensitive_guard_present"
require_text "if (evidenceContractBlocked || privacyBlocked)" "$CLIENT_HOOK" "local_sensitive_short_circuit_present"
require_text "transit serveur bloqué localement avant tout envoi" "$CLIENT_HOOK" "local_zero_leak_copy_present"
require_text "provider_sensitive_output_guard" "$CLIENT_HOOK" "provider_sensitive_fallback_explained"
require_text "provider_evidence_guard" "$CLIENT_HOOK" "provider_evidence_fallback_explained"
require_text "provider_daily_cap" "$CLIENT_HOOK" "provider_budget_fallback_explained"
require_text "ANGLE MORT" "$CLIENT_LENS" "blind_spot_disclosure_present"
require_text "L’absence de donnée reste une absence de donnée" "$CLIENT_LENS" "blind_spot_truth_copy_present"

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
require_text "Local uniquement choisi" "$CLIENT_HOOK" "local_only_user_choice_copy_present"
require_text "ConfluenceAiMode = \"server\" | \"local\" | \"silent\"" "$CLIENT_LENS" "sovereign_silence_mode_contract_present"
require_text "Aucune suggestion Confluence n’est affichée et aucune requête Confluence n’est envoyée" "$CLIENT_LENS" "sovereign_silence_truth_copy_present"
require_text "SILENCE" "$CLIENT_LENS" "sovereign_silence_control_present"
require_text "PACTE D’ATTENTION" "$CLIENT_LENS" "attention_covenant_present"
require_text "Rien de nouveau dans les preuves" "$CLIENT_LENS" "attention_quiet_state_present"
require_text "Confluence libère l’écran et reviendra seulement si les preuves changent" "$CLIENT_LENS" "attention_return_contract_present"
require_text "attentionFingerprint" "$CLIENT_LENS" "attention_evidence_fingerprint_present"
require_text "setAcknowledgedFingerprint(attentionFingerprint)" "$CLIENT_LENS" "attention_acknowledgement_present"
require_text "NOUVEAU SIGNAL" "$CLIENT_LENS" "attention_new_signal_reentry_present"
require_text "SESSION_CACHE_MAX_ENTRIES" "$CLIENT_HOOK" "frugal_session_cache_present"
require_text "sessionCacheGet" "$CLIENT_HOOK" "frugal_session_cache_read_present"
require_text "sessionCacheSet" "$CLIENT_HOOK" "frugal_session_cache_write_present"
require_text "PROVIDER_MEMO_TTL_MS" "$SERVICE" "frugal_provider_memo_present"
require_text "providerFingerprint" "$SERVICE" "frugal_provider_fingerprint_present"
require_text "providerInflight" "$SERVICE" "frugal_singleflight_present"
require_text "frugalCompute" "$SERVICE" "frugal_compute_observability_present"
require_text "computeSource" "$TYPES" "frugal_compute_source_typed"
require_text "controller.abort()" "$CLIENT_HOOK" "network_abort_cleanup_present"
require_text "signal: controller.signal" "$CLIENT_HOOK" "network_abort_signal_present"
require_text "if (!enabled || !evidence.length)" "$CLIENT_HOOK" "disabled_mode_short_circuits_before_network"
require_text "enabled: confluenceAiMode === \"server\"" "$CLIENT_ORACLE" "client_user_ai_mode_controls_network"
require_text "enabled: Boolean(oracleLens) && confluenceAiMode === \"server\"" "$COURIER_ORACLE" "courier_user_ai_mode_controls_network"
require_text "enabled: confluenceAiMode === \"server\"" "$MERCHANT_ORACLE" "merchant_user_ai_mode_controls_network"
require_text "aiMode={confluenceAiMode}" "$CLIENT_ORACLE" "client_sovereign_mode_wired"
require_text "aiMode={confluenceAiMode}" "$COURIER_ORACLE" "courier_sovereign_mode_wired"
require_text "aiMode={confluenceAiMode}" "$MERCHANT_ORACLE" "merchant_sovereign_mode_wired"
require_text "LIGNE ROUGE · HORS LECTURE" "$CLIENT_LENS" "algorithmic_red_line_disclosure_present"
require_text "excludedSignals=" "$CLIENT_ORACLE" "client_excluded_signals_present"
require_text "Taux de refus" "$COURIER_ORACLE" "courier_refusal_exclusion_disclosed"
require_text "excludedSignals=" "$MERCHANT_ORACLE" "merchant_excluded_signals_present"
require_text "EVIDENCE_CONTRACT" "$CLIENT_HOOK" "evidence_firewall_contract_present"
require_text "evidenceContractViolation" "$CLIENT_HOOK" "evidence_firewall_validator_present"
require_text "Evidence Firewall" "$CLIENT_HOOK" "evidence_firewall_user_truth_copy_present"
require_text "Intention choisie" "$CLIENT_HOOK" "taste_evidence_contract_present"
require_text "Taux de refus" "$COURIER_ORACLE" "courier_refusal_red_line_present"
require_text "Statut commande" "$CLIENT_HOOK" "route_evidence_contract_present"
require_text "Charge observée" "$CLIENT_HOOK" "service_evidence_contract_present"

score_block="$(sed -n '/private scoreCourier(/,/private reason(/p' "$DISPATCH_SERVICE")"
if grep -Fq "courier.acceptanceRate" <<<"$score_block"; then
  fail "courier_refusal_rate_excluded_from_assignment_score"
fi
pass "courier_refusal_rate_excluded_from_assignment_score"

sensitive_line="$(grep -nF "requestContainsSensitiveEvidence(body)" "$SERVICE" | head -1 | cut -d: -f1)"
provider_line="$(grep -nF "providerSuggestion(input" "$SERVICE" | head -1 | cut -d: -f1)"
[[ -n "$sensitive_line" && -n "$provider_line" && "$sensitive_line" -lt "$provider_line" ]] || fail "sensitive_guard_precedes_provider"
pass "sensitive_guard_precedes_provider"

memo_line="$(grep -nF "const memoized = this.providerMemoGet(key)" "$SERVICE" | head -1 | cut -d: -f1)"
inflight_line="$(grep -nF "const inflight = this.providerInflight.get(key)" "$SERVICE" | head -1 | cut -d: -f1)"
budget_line="$(grep -nF "const budget = this.consumeProviderBudget()" "$SERVICE" | head -1 | cut -d: -f1)"
[[ -n "$memo_line" && -n "$inflight_line" && -n "$budget_line" && "$memo_line" -lt "$budget_line" && "$inflight_line" -lt "$budget_line" ]] || fail "frugal_reuse_precedes_provider_budget"
pass "frugal_reuse_precedes_provider_budget"

fingerprint_block="$(sed -n '/private providerFingerprint(/,/private providerMemoGet(/p' "$SERVICE")"
if grep -Fq "localSuggestion" <<<"$fingerprint_block"; then
  fail "frugal_provider_fingerprint_must_ignore_local_copy"
fi
pass "frugal_provider_fingerprint_evidence_only"

if grep -Fq "CACHE_TTL_MS" "$CLIENT_HOOK"; then
  fail "frugal_session_cache_must_be_evidence_keyed_not_time_polled"
fi
pass "frugal_session_cache_no_time_polling"

disabled_line="$(grep -nF "if (!enabled || !evidence.length)" "$CLIENT_HOOK" | head -1 | cut -d: -f1)"
local_guard_line="$(grep -nF "if (evidenceContractBlocked || privacyBlocked)" "$CLIENT_HOOK" | head -1 | cut -d: -f1)"
network_line="$(grep -nF "daOrdersFetch(" "$CLIENT_HOOK" | head -1 | cut -d: -f1)"
[[ -n "$disabled_line" && -n "$network_line" && "$disabled_line" -lt "$network_line" ]] || fail "disabled_mode_precedes_network"
pass "disabled_mode_precedes_network"
[[ -n "$local_guard_line" && -n "$network_line" && "$local_guard_line" -lt "$network_line" ]] || fail "local_evidence_and_sensitive_guards_precede_network"
pass "local_evidence_and_sensitive_guards_precede_network"

for oracle_file in "$CLIENT_ORACLE" "$COURIER_ORACLE" "$MERCHANT_ORACLE"; do
  if grep -Fq "confluenceNetworkEnabled" "$oracle_file"; then
    fail "legacy_boolean_ai_control_removed"
  fi
done
pass "legacy_boolean_ai_control_removed"

if grep -Eq "SecureStore|AsyncStorage|localStorage|persist" "$CLIENT_LENS"; then
  fail "attention_covenant_must_remain_session_only"
fi
pass "attention_covenant_session_only"

if [[ "$MODE" == "--full" || "$MODE" == "full" ]]; then
  rm -rf "$TMP_ROOT"
  mkdir -p "$TMP_ROOT"

  (cd "$ROOT/services/api-nest" && npm run build >"$TMP_ROOT/api-build.log" 2>&1) || { tail -120 "$TMP_ROOT/api-build.log" >&2; fail "api_build"; }
  pass "api_build"

  (cd "$ROOT" && node "$FRUGAL_PROBE" >"$TMP_ROOT/frugal-probe.log" 2>&1) || { cat "$TMP_ROOT/frugal-probe.log" >&2; fail "frugal_compute_probe"; }
  pass "frugal_compute_probe"

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
