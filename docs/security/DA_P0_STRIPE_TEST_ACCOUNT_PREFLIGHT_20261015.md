# DelishAfrica P0 — Stripe TEST account identity preflight (15 October 2026)

**STATUS: DRAFT, OFFLINE QA CANDIDATE — NO PRODUCTION DEPLOYMENT.**

## Why this guard exists

- Officially connected Purple Orchid Group TEST account: `acct_1Txb0H1ulfIzeuc8` / Luxembourg (LU).
- Existing VPS Main + Canary TEST runtime: `acct_1SAabJEMrD4x5RWS` / Belgium (BE).
- All three Stripe environment aliases on Main/Canary resolve to the **BE** account. The accounts must **not** be described as equivalent. The legal/contractual beneficiary and Connect permissions still require confirmation.

## Scope

`scripts/security/stripe-test-account-preflight.mjs` is a standalone **read-only, GET-only** verifier. It does not alter runtime wiring, create PaymentIntents, install new packages, update Docker secrets, migrate PostgreSQL, or deploy anything.

It requires an **explicit** expected account ID and expected country, a secret beginning in `sk_test_`, and an explicit network opt-in. If any of the three configured legacy alias variables disagree, it returns NO-GO *before network access*. It rejects a returned account ID/country mismatch, unexpected `livemode:true`, HTTP errors and timeouts. Results contain **only fixed verdict codes**, not keys, payment details, API response objects, or customer data. Never paste secrets into a public PR or logs.

There is no network traffic in GitHub Actions. Tests inject fake credentials and stub the fetch API. The CI does not use the real Stripe integration nor prove payment activation.

## Isolated TEST operator procedure — only after approval

Use an authorized secrets manager to inject the test key into an **ephemeral, nonproduction** process environment. Do not type or commit a secret to a shell history, terminal screenshot, repository, CI variable output, or roadbook.

Required environment names (non-secret values shown):

- `STRIPE_EXPECTED_TEST_ACCOUNT_ID=acct_1Txb0H1ulfIzeuc8`
- `STRIPE_EXPECTED_TEST_COUNTRY=LU`
- `STRIPE_PREFLIGHT_ALLOW_GET=1`
- `STRIPE_SECRET_KEY` = scoped `sk_test_` secret provisioned explicitly for the LU TEST account

Then run `node scripts/security/stripe-test-account-preflight.mjs` in the isolated checkout, observing only `PASS_TEST_ACCOUNT_ID_AND_COUNTRY_MATCH` and exit code 0. All other messages or nonzero exits are **NO-GO**. If the retrieved account reports a different ID or country, **stop**; do not rewrite VPS environment keys to silence it.

A PASS only establishes that the *provided test credential* retrieves the intended LU Stripe account. It **does not** prove charges, payouts, Stripe Connect merchant availability, legal entity activation, webhook ownership, or end-to-end ordering.

## Independent tests and promotion gates

- `node --test test/stripe-test-account-preflight.test.mjs`: matching TEST ID/country; country missing and BE mismatch; no account ID; missing opt-in; LIVE secret; key aliases; missing secret; Stripe live flag; HTTP/network/JSON failure.
- SHA-exact CI must be SUCCESS on this DRAFT PR before declaring test quality PASS.
- Before official sandbox integration: verify webhook signing per account, access scopes, key storage and rotation, country-specific Connect contract, auth/authorization, idempotency, reconciliation, refunds and finality with isolated PostgreSQL.
- Payment LIVE, payout, main branch promotion, Store/OTA, VPS restart, IAM and key swap remain **NO-GO** without explicit approval.
