#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ "$(git -C "$ROOT" branch --show-current)" != "feature/client-guest-ux-preview-20261009" ]];then
  echo "REFUSED: wrong worktree for Client UI security gate" >&2
  exit 3
fi
echo "== GUEST CLIENT DRAFT PERSISTENCE TESTS =="
node --test "$ROOT/apps/client/tests/guest-checkout-draft.test.cjs"
echo "== CLIENT TYPESCRIPT =="
pnpm --dir "$ROOT/apps/client" exec tsc --noEmit --incremental false
echo "== THE EXISTING CHECKOUT WAS NOT REPLACED BEFORE BACKEND READY =="
git -C "$ROOT" diff --check
echo "FINAL_DA_GUEST_CLIENT_DRAFT_GATE=PASS"
