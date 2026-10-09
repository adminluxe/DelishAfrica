#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ "$ROOT" == "/home/afripayadmin/worktrees/guest-checkout-p5b-20261009" ]] || {
 echo "REFUSED: incorrect isolated worktree" >&2; exit 3;
}
[[ "$(git -C "$ROOT" branch --show-current)" == "feature/client-guest-checkout-p5b-coverage-20261009" ]] || {
 echo "REFUSED: incorrect feature branch" >&2; exit 3;
}
# Never connect to production PostgreSQL. The port and path are hardcoded.
LAB="/home/afripayadmin/guest-checkout-evidence-20261009/pg-lab-p3"
if ! pg_isready -h 127.0.0.1 -p 55438 >/dev/null 2>&1; then
 [[ -f "$LAB/PG_VERSION" ]] || { echo "REFUSED: missing test PG" >&2; exit 4; }
 /usr/lib/postgresql/16/bin/pg_ctl -D "$LAB" \
   -l "/home/afripayadmin/guest-checkout-evidence-20261009/pg-lab.log" \
   -o "-h 127.0.0.1 -p 55438 -k /home/afripayadmin/guest-checkout-evidence-20261009/pg-socket" start
fi
[[ "$(psql -h 127.0.0.1 -p 55438 -U afripayadmin -d postgres -Atqc 'SELECT inet_server_port()')" == 55438 ]] || exit 4
echo "== P1/P2 CRYPTO, AUTH GATES, LEDGER (12) =="
node --test "$ROOT/services/api-nest/test/guest-capability.test.cjs" \
 "$ROOT/services/api-nest/test/guest-session.service.test.cjs" \
 "$ROOT/services/api-nest/test/guest-checkout-ledger.test.cjs"
echo "== P3 Stripe simulated + real Postgres (6) =="
node --test "$ROOT/services/api-nest/test/guest-stripe-finalizer.postgres.test.cjs"
echo "== P4 canonical encrypted fulfillment (9) =="
node --test "$ROOT/services/api-nest/test/guest-fulfillment.postgres.test.cjs"
echo "== P4 alternative vault historical tests (4) =="
node --test "$ROOT/services/api-nest/test/guest-delivery-vault.postgres.test.cjs"
echo "== P5-A canonical catalog/Places tests (8) =="
node --test "$ROOT/services/api-nest/test/guest-canonical-checkout.postgres.test.cjs"
echo "== P5-B OPS approved merchant coverage (8) =="
node --test "$ROOT/services/api-nest/test/guest-published-partner-coverage.postgres.test.cjs"
echo "== P4 DB TRIGGER MUST REMAIN ACTIVE =="
CHECK="$(psql -h 127.0.0.1 -p 55438 -U afripayadmin -d postgres -Atqc "SELECT t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relname='da_guest_checkout_sessions' AND t.tgname='da_guest_payment_fulfillment_gate' AND NOT t.tgisinternal")"
[[ "$CHECK" == "O" ]] || { echo "REFUSED: trigger disabled" >&2; exit 5; }
echo "== PUBLIC FINANCIAL GUARDS AND SEALED INTERNAL MODULE =="
grep -q 'PaymentsAuthGuard' "$ROOT/services/api-nest/src/payments/payments.controller.ts"
grep -q 'OrdersAuthGuard' "$ROOT/services/api-nest/src/orders/orders.controller.ts"
if grep -R -lE 'PublishedPartnerCoveragePolicy|GuestCanonicalCheckoutStager|GuestPrivateFulfillmentVault' \
 "$ROOT/services/api-nest/src/payments/payments.controller.ts" \
 "$ROOT/services/api-nest/src/orders/orders.controller.ts" \
 "$ROOT/services/api-nest/src/stripe/stripe-webhook.controller.ts" \
 "$ROOT/services/api-nest/src/guest-checkout/guest-session.controller.ts"; then
 echo "REFUSED: guest capability visible in public financial controllers" >&2; exit 5
fi
echo "== TYPESCRIPT API AND CLIENT =="
pnpm --dir "$ROOT/services/api-nest" exec tsc --noEmit --incremental false
pnpm --dir "$ROOT/apps/client" exec tsc --noEmit --incremental false
echo "== GIT WHITESPACE =="
git -C "$ROOT" diff --check
git -C "$ROOT" diff --cached --check
echo "FINAL_DA_GUEST_CHECKOUT_STAGE5B_GATE=PASS"
echo "NOTE: 47/47 lab tests; no production migrations, no real Google calls, no Stripe payments."
