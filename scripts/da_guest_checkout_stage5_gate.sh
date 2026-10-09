#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPECTED="/home/afripayadmin/worktrees/guest-checkout-p5-20261009"
if [[ "$ROOT" != "$EXPECTED" || "$(git -C "$ROOT" branch --show-current)" != "feature/client-guest-checkout-p5-20261009" ]]; then
 echo "REFUSED: incorrect branch/worktree" >&2; exit 3
fi
LAB=/home/afripayadmin/guest-checkout-evidence-20261009/pg-lab-p3
if ! pg_isready -h 127.0.0.1 -p 55438 > /dev/null 2>&1; then
 [[ -f "$LAB/PG_VERSION" ]] || { echo "REFUSED: PG lab unavailable" >&2; exit 4; }
 /usr/lib/postgresql/16/bin/pg_ctl -D "$LAB" \
   -l /home/afripayadmin/guest-checkout-evidence-20261009/pg-lab.log \
   -o "-h 127.0.0.1 -p 55438 -k /home/afripayadmin/guest-checkout-evidence-20261009/pg-socket" \
   start
fi
CHECK_PORT="$(psql -h 127.0.0.1 -p 55438 -U afripayadmin -d postgres -Atqc 'SELECT inet_server_port()')"
[[ "$CHECK_PORT" == 55438 ]] || { echo "REFUSED: wrong PG" >&2; exit 4; }

echo "== CRYPTO / PREVIEW / LEDGER LAB SIMULATION (12 TESTS) =="
node --test "$ROOT/services/api-nest/test/guest-capability.test.cjs" \
 "$ROOT/services/api-nest/test/guest-session.service.test.cjs" \
 "$ROOT/services/api-nest/test/guest-checkout-ledger.test.cjs"

echo "== REAL PG STRIPE-SIMULATED FINANCIAL TESTS (6) =="
node --test "$ROOT/services/api-nest/test/guest-stripe-finalizer.postgres.test.cjs"

echo "== REAL PG CANONICAL ENCRYPTED FULFILLMENT TESTS (9) =="
node --test "$ROOT/services/api-nest/test/guest-fulfillment.postgres.test.cjs"

echo "== REAL PG ALTERNATIVE VAULT REGRESSION TESTS (4) =="
node --test "$ROOT/services/api-nest/test/guest-delivery-vault.postgres.test.cjs"

echo "== REAL PG CANONICAL LOCATION + CATALOG STAGING TESTS (8) =="
node --test "$ROOT/services/api-nest/test/guest-canonical-checkout.postgres.test.cjs"

echo "== NO PUBLIC GUEST PAYMENT OR ORDER ROUTES =="
if grep -R -lE 'GuestCanonicalCheckoutStager|GuestPrivateFulfillmentVault|GuestPaidFulfillmentPreparer' \
 "$ROOT/services/api-nest/src/orders/orders.controller.ts" \
 "$ROOT/services/api-nest/src/payments/payments.controller.ts" \
 "$ROOT/services/api-nest/src/stripe/stripe-webhook.controller.ts" \
 "$ROOT/services/api-nest/src/guest-checkout/guest-session.controller.ts"; then
 echo "REFUSED: guest code exposed via public routes" >&2; exit 5
fi
grep -q 'PaymentsAuthGuard' "$ROOT/services/api-nest/src/payments/payments.controller.ts"
grep -q 'OrdersAuthGuard' "$ROOT/services/api-nest/src/orders/orders.controller.ts"
echo "== ENSURE P4 SEALED FULFILLMENT TRIGGER ACTIVE =="
TRIGGER="$(psql -h 127.0.0.1 -p 55438 -U afripayadmin -d postgres -Atqc "SELECT t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relname='da_guest_checkout_sessions' AND t.tgname='da_guest_payment_fulfillment_gate' AND NOT t.tgisinternal")"
[[ "$TRIGGER" == "O" ]] || { echo "REFUSED: trigger disabled" >&2; exit 5; }

echo "== TYPESCRIPT API + CLIENT =="
pnpm --dir "$ROOT/services/api-nest" exec tsc --noEmit --incremental false
pnpm --dir "$ROOT/apps/client" exec tsc --noEmit --incremental false
echo "== GIT DIFF CHECK =="
git -C "$ROOT" diff --check
git -C "$ROOT" diff --cached --check
echo "FINAL_DA_GUEST_CHECKOUT_STAGE5_GATE=PASS"
echo "NOTE: 39/39 lab tests, no real Google calls, no Stripe payments, no deployment."
