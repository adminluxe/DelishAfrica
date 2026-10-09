#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ "$ROOT" != "/home/afripayadmin/worktrees/guest-coverage-strict-20261009" ]] ||
   [[ "$(git -C "$ROOT" branch --show-current)" != "feature/client-guest-coverage-strict-20261009" ]]; then
  echo "REFUSED: wrong worktree or branch" >&2; exit 3
fi
[[ "$(psql -h 127.0.0.1 -p 55438 -U afripayadmin -d postgres -Atqc 'SELECT inet_server_port()')" == "55438" ]] ||
 { echo "REFUSED: wrong DB instance" >&2; exit 4; }
echo "== P1/P2 TESTS: 12 =="
node --test "$ROOT/services/api-nest/test/guest-capability.test.cjs" \
 "$ROOT/services/api-nest/test/guest-session.service.test.cjs" \
 "$ROOT/services/api-nest/test/guest-checkout-ledger.test.cjs"
echo "== P3 REAL PG / FAKE STRIPE: 6 =="
node --test "$ROOT/services/api-nest/test/guest-stripe-finalizer.postgres.test.cjs"
echo "== P4 FULL PRIVATE VAULT: 9 =="
node --test "$ROOT/services/api-nest/test/guest-fulfillment.postgres.test.cjs"
echo "== P4 ALTERNATIVE VAULT RETAINED: 4 =="
node --test "$ROOT/services/api-nest/test/guest-delivery-vault.postgres.test.cjs"
echo "== P5A CANONICAL ADDRESS AND PRICING: 8 =="
node --test "$ROOT/services/api-nest/test/guest-canonical-checkout.postgres.test.cjs"
echo "== P5B STRICT MERCHANT COVERAGE: 6 =="
node --test "$ROOT/services/api-nest/test/guest-merchant-coverage-strict.test.cjs"
echo "== API AND CLIENT TYPESCRIPT =="
pnpm --dir "$ROOT/services/api-nest" exec tsc --noEmit --incremental false
pnpm --dir "$ROOT/apps/client" exec tsc --noEmit --incremental false
echo "== PRODUCTION PAYMENT GUARDS UNCHANGED =="
grep -q PaymentsAuthGuard "$ROOT/services/api-nest/src/payments/payments.controller.ts"
grep -q OrdersAuthGuard "$ROOT/services/api-nest/src/orders/orders.controller.ts"
echo "== NO CHECKOUT GUEST ROUTES PUBLISHED =="
if grep -l GuestMerchantCoverageStrict "$ROOT/services/api-nest/src/orders/orders.controller.ts" "$ROOT/services/api-nest/src/payments/payments.controller.ts" "$ROOT/services/api-nest/src/stripe/stripe-webhook.controller.ts"; then
 echo "REFUSED: coverage wired prematurely" >&2; exit 5
fi
git -C "$ROOT" diff --check
git -C "$ROOT" diff --cached --check
echo "FINAL_DA_GUEST_P5B_COVERAGE_GATE=PASS"
echo "NOTE: 45/45 tests with mock Google and Stripe; merchant zones currently need approved configuration."
