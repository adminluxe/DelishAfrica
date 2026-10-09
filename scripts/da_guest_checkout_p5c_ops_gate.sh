#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXPECTED="/home/afripayadmin/worktrees/guest-p5c-ops-integrated-20261009"
BRANCH="feature/client-guest-p5c-ops-integrated-20261009"
LAB_BASE="/home/afripayadmin/guest-checkout-evidence-20261009"
LAB="$LAB_BASE/pg-lab-p5c-ops"
PORT=55439

if [[ "$ROOT" != "$EXPECTED" || "$(git -C "$ROOT" branch --show-current)" != "$BRANCH" ]]; then
  echo "REFUSE: wrong repo/branch" >&2
  exit 3
fi
if ! pg_isready -h 127.0.0.1 -p "$PORT" > /dev/null 2>&1; then
  if [[ ! -f "$LAB/PG_VERSION" ]]; then
    echo "REFUSE: private PostgreSQL test cluster missing" >&2
    exit 4
  fi
  mkdir -p "$LAB_BASE/pg-p5c-socket"
  /usr/lib/postgresql/16/bin/pg_ctl -D "$LAB" -l "$LAB_BASE/pg-p5c.log" \
     -o "-h 127.0.0.1 -p $PORT -k $LAB_BASE/pg-p5c-socket" start
fi

CHECK_PORT="$(psql -h 127.0.0.1 -p "$PORT" -U afripayadmin -d postgres -Atqc 'SELECT inet_server_port()')"
[[ "$CHECK_PORT" == "$PORT" ]] || { echo "REFUSE: unexpected database endpoint" >&2; exit 5; }
echo "P5C LAB ISOLATION: 127.0.0.1:$PORT (no production DB connection)"

if grep -l 55438 "$ROOT"/services/api-nest/test/guest*.postgres.test.cjs; then
  echo "REFUSE: a PG test still targets shared laboratory" >&2
  exit 5
fi

TEST_DIR="$ROOT/services/api-nest/test"
TOTAL=0
check_suite() {
  local name="$1" expected="$2"
  shift 2
  local logfile="$LAB_BASE/p5c_$(echo "$name" | tr '[:upper:] ' '[:lower:]_')_$(date +%Y%m%d).log"
  echo "== $name (expected $expected) =="
  if ! node --test "$@" > "$logfile" 2>&1; then
    tail -85 "$logfile"
    echo "FAIL: $name" >&2
    return 1
  fi
  local got fail
  got="$(sed -n 's/^# pass //p' "$logfile" | tail -1)"
  fail="$(sed -n 's/^# fail //p' "$logfile" | tail -1)"
  if [[ "$got" != "$expected" || "$fail" != "0" ]]; then
    tail -85 "$logfile"
    echo "REFUSE: wrong count $name, pass=$got, fail=$fail" >&2
    return 1
  fi
  TOTAL=$((TOTAL + expected))
  echo "PASS $name: $got/$expected"
}

check_suite "P1_P2" 12 \
 "$TEST_DIR/guest-capability.test.cjs" \
 "$TEST_DIR/guest-session.service.test.cjs" \
 "$TEST_DIR/guest-checkout-ledger.test.cjs"
check_suite "P3_Stripe_Financial" 6 "$TEST_DIR/guest-stripe-finalizer.postgres.test.cjs"
check_suite "P4_Private_Vault" 9 "$TEST_DIR/guest-fulfillment.postgres.test.cjs"
check_suite "P4_Historical_Vault" 4 "$TEST_DIR/guest-delivery-vault.postgres.test.cjs"
check_suite "P5A_Catalog_Google" 8 "$TEST_DIR/guest-canonical-checkout.postgres.test.cjs"
check_suite "P5B_Merchant_Coverage" 8 "$TEST_DIR/guest-merchant-coverage-strict.test.cjs"
check_suite "P5B_Ops_Approvals" 5 "$TEST_DIR/guest-coverage-ops-approval.postgres.test.cjs"
check_suite "P5C_Intent_Ops_Gated" 19 "$TEST_DIR/guest-stripe-intent.postgres.test.cjs"

[[ "$TOTAL" == 71 ]] || { echo "REFUSE: wrong total $TOTAL" >&2; exit 6; }

echo "== CLIENT AND API TYPESCRIPT =="
pnpm --dir "$ROOT/services/api-nest" exec tsc --noEmit --incremental false
pnpm --dir "$ROOT/apps/client" exec tsc --noEmit --incremental false

echo "== AUTH GUARDS AND PUBLIC ROUTE ISOLATION =="
grep -q PaymentsAuthGuard "$ROOT/services/api-nest/src/payments/payments.controller.ts"
grep -q OrdersAuthGuard "$ROOT/services/api-nest/src/orders/orders.controller.ts"
if grep -R -lE "GuestStripeIntentReservation|readTrustedDeliveryForPayment" \
 "$ROOT/services/api-nest/src/payments/payments.controller.ts" \
 "$ROOT/services/api-nest/src/orders/orders.controller.ts" \
 "$ROOT/services/api-nest/src/stripe/stripe-webhook.controller.ts" \
 "$ROOT/services/api-nest/src/guest-checkout/guest-session.controller.ts"; then
 echo "REFUSE: guest intent connected to public route before security review" >&2
 exit 7
fi

echo "== CURRENT OPS REGISTRY AND ENCRYPTED CHECKOUT DB GUARDS =="
TRIGGER="$(psql -h 127.0.0.1 -p "$PORT" -U afripayadmin -d postgres -Atqc \
 "SELECT t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relname='da_guest_checkout_sessions' AND t.tgname='da_guest_payment_fulfillment_gate' AND NOT t.tgisinternal")"
[[ "$TRIGGER" == O ]] || { echo "REFUSE: guest fulfillment trigger missing"; exit 8; }

echo "== SOURCE DIFF INTEGRITY =="
git -C "$ROOT" diff --check
git -C "$ROOT" diff --cached --check

echo "FINAL_DA_GUEST_P5C_OPS_INTEGRATED_GATE=PASS"
echo "71/71 tests; PostgreSQL isolated; Stripe and Google simulators only."
echo "Production, public API, merchant/courier accounts and Store builds NOT MODIFIED."
