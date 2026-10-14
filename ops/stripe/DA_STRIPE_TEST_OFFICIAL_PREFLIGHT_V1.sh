#!/usr/bin/env bash
# DelishAfrica - TEST-only Stripe account preflight.
# This script NEVER creates/updates/captures/refunds a payment.
# Defaults to local inventory; external provider GET requires TWO gates.
# No real key, account ID, webhook secret, or HTTP response is ever printed.
set -Eeuo pipefail
umask 077
export NODE_NO_WARNINGS=1
MODE="${1:---inventory}"
if (( $# > 1 )); then
  printf '%s\n' 'DA_STRIPE_PREFLIGHT=INVALID_ARGUMENTS'
  exit 2
fi
case "$MODE" in
  --inventory|--offline|--account-readonly) ;;
  *) printf '%s\n' 'DA_STRIPE_PREFLIGHT=INVALID_MODE'; exit 2 ;;
esac
if [[ "${BASHOPTS:-}" == *xtrace* ]] || [[ "$-" == *x* ]]; then
  printf '%s\n' 'DA_STRIPE_PREFLIGHT=TRACE_FORBIDDEN'
  exit 2
fi
BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
printf '%s\n' 'DA_STRIPE_PREFLIGHT=TEST_ONLY' 'PRODUCTION_MUTATIONS=NONE' 'STRIPE_WRITE_REQUESTS=NONE'

check_tool() {
  local name="$1"
  if command -v "$name" >/dev/null 2>&1; then
    printf 'TOOL_%s=READY\n' "$name"
  else
    printf 'TOOL_%s=MISSING\n' "$name"
  fi
}
check_tool git
check_tool node

if git -C "$BASE" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git_branch="$(git -C "$BASE" branch --show-current)"
  if [[ "$git_branch" == 'feat/stripe-test-reconcile-pg-qa-20261012' ]]; then
    printf '%s\n' 'QA_BRANCH=CORRECT'
  else
    printf '%s\n' 'QA_BRANCH=UNEXPECTED'
    if [[ "$MODE" != '--inventory' ]]; then exit 3; fi
  fi
  if [[ -z "$(git -C "$BASE" status --porcelain --untracked-files=no)" ]]; then
    printf '%s\n' 'QA_TRACKED_FILES=CLEAN'
  else
    printf '%s\n' 'QA_TRACKED_FILES=MODIFIED'
    if [[ "$MODE" != '--inventory' ]]; then exit 3; fi
  fi
else
  printf '%s\n' 'QA_BRANCH=UNKNOWN'
  if [[ "$MODE" != '--inventory' ]]; then exit 3; fi
fi

# Required variables are read only; values are never sent to the shell output.
# Reject strings that contain whitespace, quotation marks or control chars.
valid_test_secret=0
valid_publishable=0
valid_webhook=0
valid_account=0
if [[ "${DA_STRIPE_TEST_SECRET_KEY:-}" =~ ^sk_test_[A-Za-z0-9_]{20,250}$ ]]; then valid_test_secret=1; fi
if [[ "${DA_STRIPE_TEST_PUBLISHABLE_KEY:-}" =~ ^pk_test_[A-Za-z0-9_]{20,250}$ ]]; then valid_publishable=1; fi
if [[ "${DA_STRIPE_TEST_WEBHOOK_SECRET:-}" =~ ^whsec_[A-Za-z0-9_-]{20,250}$ ]]; then valid_webhook=1; fi
if [[ "${DA_STRIPE_TEST_EXPECTED_ACCOUNT_ID:-}" =~ ^acct_[A-Za-z0-9]{6,120}$ ]]; then valid_account=1; fi
if (( valid_test_secret )); then printf '%s\n' 'SERVER_TEST_SECRET=FORMAT_OK'; else printf '%s\n' 'SERVER_TEST_SECRET=MISSING_OR_INVALID'; fi
if (( valid_publishable )); then printf '%s\n' 'CLIENT_TEST_KEY=FORMAT_OK'; else printf '%s\n' 'CLIENT_TEST_KEY=MISSING_OR_INVALID'; fi
if (( valid_webhook )); then printf '%s\n' 'WEBHOOK_TEST_SECRET=FORMAT_OK'; else printf '%s\n' 'WEBHOOK_TEST_SECRET=MISSING_OR_INVALID'; fi
if (( valid_account )); then printf '%s\n' 'PINNED_TEST_ACCOUNT=FORMAT_OK'; else printf '%s\n' 'PINNED_TEST_ACCOUNT=MISSING_OR_INVALID'; fi

if [[ "$MODE" == '--inventory' ]]; then
  printf '%s\n' 'PROVIDER_NETWORK=NEVER_USED' 'PROVIDER_CHECK=NOT_PERFORMED'
  exit 0
fi
if (( !valid_test_secret || !valid_publishable ||
      !valid_webhook || !valid_account )); then
  printf '%s\n' 'DA_STRIPE_PREFLIGHT=NO_GO_INCOMPLETE_TEST_CONFIG'
  exit 12
fi
if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' 'DA_STRIPE_PREFLIGHT=NO_GO_NODE_MISSING'
  exit 13
fi
if [[ "$MODE" == '--offline' ]]; then
  printf '%s\n' 'DA_STRIPE_PREFLIGHT=OFFLINE_FORMAT_GATE_PASS'
  printf '%s\n' 'PROVIDER_NETWORK=NEVER_USED'
  exit 0
fi

# Official provider connection is explicitly operator authorized and read-only.
if [[ "${DA_STRIPE_TEST_OFFICIAL_QA_ISOLATED:-}" != 'YES' ]] ||
   [[ "${DA_STRIPE_TEST_PROVIDER_READONLY_GO:-}" != 'YES' ]]; then
  printf '%s\n' 'DA_STRIPE_PREFLIGHT=NO_GO_OFFICIAL_PROVIDER_NOT_AUTHORIZED'
  exit 14
fi
printf '%s\n' 'PROVIDER_REQUEST=GET_ACCOUNT_ONLY'
node <<'NODE'
'use strict';
const key=process.env.DA_STRIPE_TEST_SECRET_KEY;
const account=process.env.DA_STRIPE_TEST_EXPECTED_ACCOUNT_ID;
(async()=>{
  try{
    const response=await fetch('https://api.stripe.com/v1/account',{
      method:'GET',redirect:'error',
      headers:{Authorization:'Bearer '+key},
      signal:AbortSignal.timeout(10000),
    });
    if(response.status!==200){
      console.log('STRIPE_TEST_ACCOUNT_READ=DENIED');
      process.exitCode=20;return;
    }
    const content=await response.text();
    if(content.length>65536){
      console.log('STRIPE_TEST_ACCOUNT_READ=OVERSIZED');
      process.exitCode=21;return;
    }
    let value;
    try{value=JSON.parse(content);}catch{value=null;}
    if(!value||value.object!=='account'||value.id!==account){
      console.log('STRIPE_TEST_ACCOUNT_IDENTITY=MISMATCH');
      process.exitCode=22;return;
    }
    console.log('STRIPE_TEST_ACCOUNT_IDENTITY=PIN_MATCH');
    console.log('PROVIDER_MUTATION=ZERO');
  }catch{
    console.log('STRIPE_TEST_ACCOUNT_READ=NETWORK_OR_TLS_FAILED');
    process.exitCode=23;
  }
})();
NODE
