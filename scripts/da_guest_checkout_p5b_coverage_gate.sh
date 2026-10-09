#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ "$ROOT" != "/home/afripayadmin/worktrees/guest-coverage-strict-20261009" ]] ||
   [[ "$(git -C "$ROOT" branch --show-current)" != "feature/client-guest-coverage-strict-20261009" ]]; then
  echo "REFUSED: wrong worktree or branch" >&2
  exit 3
fi
PORT="$(psql -h 127.0.0.1 -p 55438 -U afripayadmin -d postgres -Atqc 'SELECT inet_server_port()')"
[[ "$PORT" == "55438" ]] || { echo "REFUSED: wrong test database"; exit 4; }

echo "== P1/P2 CRYPTO + LEDGER TESTS: 12 =="
node --test "$ROOT/services/api-nest/test/guest-capability.test.cjs" \
 "$ROOT/services/api-nest/test/guest-session.service.test.cjs" \
 "$ROOT/services/api-nest/test/guest-checkout-ledger.test.cjs"

echo "== P3 VERIFIED FINANCIAL STRIPE-SIMULATED TESTS: 6 =="
node --test "$ROOT/services/api-nest/test/guest-stripe-finalizer.postgres.test.cjs"

echo "== P4 CANONICAL PRIVATE FULFILLMENT: 9 =="
node --test "$ROOT/services/api-nest/test/guest-fulfillment.postgres.test.cjs"

echo "== P4 HISTORIC RECONCILED VARIANT: 4 =="
node --test "$ROOT/services/api-nest/test/guest-delivery-vault.postgres.test.cjs"

echo "== P5A CANONICAL PRICE + VERIFIED ADDRESS: 8 =="
node --test "$ROOT/services/api-nest/test/guest-canonical-checkout.postgres.test.cjs"

echo "== P5B STRICT MERCHANT GEOGRAPHIC COVERAGE: 8 =="
node --test "$ROOT/services/api-nest/test/guest-merchant-coverage-strict.test.cjs"

echo "== P5B SEPARATE OPS APPROVALS LEDGER ON REAL LAB PG: 5 =="
node --test "$ROOT/services/api-nest/test/guest-coverage-ops-approval.postgres.test.cjs"

echo "== API AND CLIENT TYPESCRIPT =="
pnpm --dir "$ROOT/services/api-nest" exec tsc --noEmit --incremental false
pnpm --dir "$ROOT/apps/client" exec tsc --noEmit --incremental false

echo "== PAYMENT/ORDERS OIDC GUARDS STILL ACTIVE =="
grep -q PaymentsAuthGuard "$ROOT/services/api-nest/src/payments/payments.controller.ts"
grep -q OrdersAuthGuard "$ROOT/services/api-nest/src/orders/orders.controller.ts"

echo "== INDEPENDENT OPS REGISTRY IS READ ONLY FROM CHECKOUT =="
test -s "$ROOT/migrations/20261009_guest_coverage_ops_approvals.sql"
if grep -nE '\bINSERT INTO da_guest_coverage_ops_approvals|\bUPDATE da_guest_coverage_ops_approvals' \
 "$ROOT/services/api-nest/src/guest-checkout/guest-coverage-ops-approval-pg.ts"; then
 echo "REFUSED: checkout contains Ops approval write path" >&2; exit 5
fi
echo "== NO GUEST PAYMENTS EXPOSED =="
if grep -l GuestMerchantCoverageStrict \
 "$ROOT/services/api-nest/src/payments/payments.controller.ts" \
 "$ROOT/services/api-nest/src/orders/orders.controller.ts" \
 "$ROOT/services/api-nest/src/stripe/stripe-webhook.controller.ts"; then
 echo "REFUSED: premature production checkout wiring" >&2; exit 5
fi
git -C "$ROOT" diff --check
git -C "$ROOT" diff --cached --check
echo "FINAL_DA_GUEST_P5B_COVERAGE_GATE=PASS"
echo "NOTE: 52/52 laboratory tests; Ops approval DB independent; no Stripe/Google real calls, no production."
