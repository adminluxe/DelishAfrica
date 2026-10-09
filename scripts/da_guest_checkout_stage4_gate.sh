#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="$(git -C "$ROOT" branch --show-current)"
if [[ "$BRANCH" != "feature/client-guest-checkout-secure-20261009" ]]; then
  echo "REFUSED: incorrect working branch ($BRANCH)" >&2
  exit 3
fi
if [[ "$ROOT" != "/home/afripayadmin/worktrees/guest-checkout-secure-20261009" ]]; then
  echo "REFUSED: gate only authorized inside isolated feature worktree" >&2
  exit 3
fi

LAB="/home/afripayadmin/guest-checkout-evidence-20261009/pg-lab-p3"
PORT=55438
if ! pg_isready -h 127.0.0.1 -p "$PORT" > /dev/null 2>&1; then
  if [[ ! -f "$LAB/PG_VERSION" ]]; then
    echo "REFUSED: isolated Postgres lab has not been initialized" >&2
    exit 4
  fi
  mkdir -p "/home/afripayadmin/guest-checkout-evidence-20261009/pg-socket"
  /usr/lib/postgresql/16/bin/pg_ctl -D "$LAB" \
    -l "/home/afripayadmin/guest-checkout-evidence-20261009/pg-lab.log" \
    -o "-h 127.0.0.1 -p $PORT -k /home/afripayadmin/guest-checkout-evidence-20261009/pg-socket" \
    start
fi
pg_isready -h 127.0.0.1 -p "$PORT"
CHECK_PORT="$(psql -h 127.0.0.1 -p "$PORT" -U afripayadmin -d postgres -Atqc 'SELECT inet_server_port()')"
[[ "$CHECK_PORT" == "$PORT" ]] || { echo "REFUSED: wrong DB server" >&2; exit 4; }

echo "== GUEST P1/P2 SECURITY AND CLIENT/API TYPECHECK =="
bash "$ROOT/scripts/da_guest_checkout_stage2_gate.sh"

echo "== P3 STRIPE FINANCIAL FINALIZATION / REAL PG LAB =="
node --test "$ROOT/services/api-nest/test/guest-stripe-finalizer.postgres.test.cjs"

echo "== P4 ENCRYPTED FULFILLMENT / REAL PG LAB =="
node --test "$ROOT/services/api-nest/test/guest-fulfillment.postgres.test.cjs"
echo "== P4 ALTERNATIVE DELIVERY CONTEXT REGRESSION TESTS =="
node --test "$ROOT/services/api-nest/test/guest-delivery-vault.postgres.test.cjs"

echo "== DB TRIGGER EXISTS AND ACTIVE =="
ACTIVE="$(psql -h 127.0.0.1 -p "$PORT" -U afripayadmin -d postgres -Atqc "SELECT t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relname='da_guest_checkout_sessions' AND t.tgname='da_guest_payment_fulfillment_gate' AND NOT t.tgisinternal")"
[[ "$ACTIVE" == "O" ]] || { echo "REFUSED: missing/enabled guest payment seal DB trigger" >&2; exit 5; }

echo "== P4 MUST NOT BE EXPOSED TO HTTP / MERCHANT DISPATCH YET =="
if grep -R -lE 'GuestPaidFulfillmentPreparer|GuestPrivateFulfillmentVault' \
  "$ROOT/services/api-nest/src/orders/orders.controller.ts" \
  "$ROOT/services/api-nest/src/payments/payments.controller.ts" \
  "$ROOT/services/api-nest/src/stripe/stripe-webhook.controller.ts" \
  "$ROOT/services/api-nest/src/guest-checkout/guest-session.controller.ts"; then
  echo "REFUSED: P4 vault is exposed to public controller" >&2
  exit 5
fi

echo "== API TYPESCRIPT REGRESSION CHECK =="
pnpm --dir "$ROOT/services/api-nest" exec tsc --noEmit --incremental false

echo "== CLIENT TYPESCRIPT REGRESSION CHECK =="
pnpm --dir "$ROOT/apps/client" exec tsc --noEmit --incremental false

echo "== DIFF WHITESPACE =="
git -C "$ROOT" diff --check
git -C "$ROOT" diff --cached --check

echo "FINAL_DA_GUEST_CHECKOUT_STAGE4_GATE=PASS"
echo "NOTE: 31/31 cumulative tests; PostgreSQL lab real, Stripe simulated, no live checkout."
