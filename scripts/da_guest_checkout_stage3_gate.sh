#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ "$(git -C "$ROOT" branch --show-current)" == "feature/client-guest-checkout-secure-20261009" ]] || {
 echo "REFUSED: wrong branch" >&2; exit 3;
}
echo "== P1/P2 CRYPTO, GUARDS, TYPECHECK GATE =="
bash "$ROOT/scripts/da_guest_checkout_stage2_gate.sh"
echo "== PHYSICAL POSTGRES LAB GUARANTEE =="
HOST=127.0.0.1
PORT=55438
[[ "$HOST" == "127.0.0.1" && "$PORT" != "5432" ]] || exit 4
pg_isready -h "$HOST" -p "$PORT"
echo "== P3 SIGNED WEBHOOK, IDEMPOTENCE, ROLLBACK, REFUND CHECKS =="
node --test "$ROOT/services/api-nest/test/guest-stripe-finalizer.postgres.test.cjs"
echo "== P3 STRIPE / PROD GUARDS PRESERVED =="
grep -q "PaymentsAuthGuard" "$ROOT/services/api-nest/src/payments/payments.controller.ts"
grep -q "OrdersAuthGuard" "$ROOT/services/api-nest/src/orders/orders.controller.ts"
if grep -l "GuestStripeFinancialFinalizer" \
 "$ROOT/services/api-nest/src/stripe/stripe-webhook.controller.ts" \
 "$ROOT/services/api-nest/src/payments/payments.controller.ts"; then
 echo "REFUSED: new finalizer connected to publicly exposed route" >&2
 exit 5
fi
echo "== P3 SQL MIGRATION PRESENCE ONLY =="
test -s "$ROOT/migrations/20261009_guest_verified_payment.sql"
echo "== DIFF CHECK =="
git -C "$ROOT" diff --check
git -C "$ROOT" diff --cached --check
echo "FINAL_DA_GUEST_CHECKOUT_STAGE3_GATE=PASS"
echo "NOTE: only isolated PostgreSQL + Stripe simulated evidence; no real payments or mobile checkout."
