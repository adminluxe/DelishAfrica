#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="$(git -C "$ROOT" branch --show-current)"
if [[ "$BRANCH" != "feature/client-guest-checkout-secure-20261009" ]]; then
  echo "REFUSED: wrong branch ($BRANCH)" >&2
  exit 3
fi
echo "== GUEST STAGE1 BRANCH: $BRANCH =="
echo "== GUEST CRYPTO & SECURITY TESTS =="
node --test "$ROOT/services/api-nest/test/guest-capability.test.cjs" "$ROOT/services/api-nest/test/guest-session.service.test.cjs"
echo "== API TYPECHECK =="
pnpm --dir "$ROOT/services/api-nest" exec tsc --noEmit --incremental false
echo "== CLIENT TYPECHECK =="
pnpm --dir "$ROOT/apps/client" exec tsc --noEmit --incremental false
echo "== OIDC GUARDS STILL PRESENT =="
grep -q 'PaymentsAuthGuard' "$ROOT/services/api-nest/src/payments/payments.controller.ts"
grep -q 'OrdersAuthGuard' "$ROOT/services/api-nest/src/orders/orders.controller.ts"
echo "== DIFF CHECK =="
git -C "$ROOT" diff --check
echo "FINAL_DA_GUEST_CHECKOUT_STAGE1_GATE=PASS"
