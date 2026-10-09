#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ "$(git -C "$ROOT" branch --show-current)" == "feature/client-guest-checkout-secure-20261009" ]] || exit 3
bash "$ROOT/scripts/da_guest_checkout_stage3_gate.sh"
echo "== P4 ENCRYPTED DELIVERY AND ATOMIC QUOTE ON ISOLATED POSTGRES =="
node --test "$ROOT/services/api-nest/test/guest-delivery-vault.postgres.test.cjs"
echo "== ENCRYPTED DELIVERY CONTEXT SCHEMA IS STAGED, NOT EXPOSED =="
test -s "$ROOT/migrations/20261009_guest_delivery_context.sql"
grep -q "GuestCheckoutQuoteContext" "$ROOT/services/api-nest/src/guest-checkout/guest-delivery-vault.ts"
echo "== P4 STATIC SAFETY CHECK =="
git -C "$ROOT" diff --check
echo "FINAL_DA_GUEST_CHECKOUT_STAGE4_VAULT_GATE=PASS"
echo "NOTE: encrypted context is a laboratory building block, not a live checkout."
