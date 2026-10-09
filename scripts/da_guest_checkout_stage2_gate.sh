#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPECTED="feature/client-guest-checkout-secure-20261009"
ACTUAL="$(git -C "$ROOT" branch --show-current)"
if [[ "$ACTUAL" != "$EXPECTED" ]]; then
  echo "REFUSE: expected feature branch, got $ACTUAL" >&2
  exit 3
fi

echo "== STAGE1 EXISTING GATE =="
bash "$ROOT/scripts/da_guest_checkout_stage1_gate.sh"

echo "== P2 PERSISTENT LEDGER UNIT TESTS (SIMULATED DB, NO NETWORK) =="
node --test "$ROOT/services/api-nest/test/guest-checkout-ledger.test.cjs"

echo "== P2 FAIL-CLOSED CONTROLLER BOUNDARY =="
# The ledger is not exposed to anyone by a direct web/controller handler.
if grep -R -l 'GuestCheckoutLedger'   "$ROOT/services/api-nest/src/guest-checkout/guest-session.controller.ts"   "$ROOT/services/api-nest/src/guest-checkout/guest-session.service.ts"   "$ROOT/services/api-nest/src/payments/payments.controller.ts"   "$ROOT/services/api-nest/src/orders/orders.controller.ts"; then
  echo "REFUSE: ledger has become reachable from an HTTP route" >&2
  exit 4
fi

echo "== P2 MIGRATION DRY PRESENCE (NOT EXECUTED) =="
test -s "$ROOT/migrations/20261009_guest_checkout_ledger.sql"
test -s "$ROOT/services/api-nest/src/guest-checkout/guest-checkout-ledger.ts"

echo "== GIT WHITESPACE =="
git -C "$ROOT" diff --check
git -C "$ROOT" diff --cached --check

echo "FINAL_DA_GUEST_CHECKOUT_STAGE2_GATE=PASS"
echo "NOTE: PostgreSQL migration not applied; integration/transaction tests P3 pending."
