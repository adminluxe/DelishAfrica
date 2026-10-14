# DelishAfrica — P0 PostgreSQL-first checkout QA ports, 14 October 2026

**Status: DRAFT / QA only / NO-GO production.** This is a targeted composition, not a new financial platform or a released payment route.

## Baseline and preservation

- Canonical VPS: `/opt/delishafrica/monorepo`, HEAD `e504c0434db43e6d15d041154176d23ee00c1347`.
- Read-only recheck at resumption: 15 tracked modified files, 0 staged; binary diff SHA-256 `7b07d120f99adba3666547860b4f43b579e804e3de5a0983705762da3433b3c5`.
- 13 running Docker containers confirmed with `sudo -n docker ps`; unprivileged `docker` is denied by socket permissions (a zero count without `sudo` is NOT a stopped stack).
- Both ports 127.0.0.1:3010 and :3011 returned HTTP 200 on `/api/v1/payments/health`.
- No VPS file written, no Docker restart, no production database accessed or migrated, no EAS build or LIVE payout/payment.

## Exact GitHub lineage

- PR #48: `security/p0-checkout-stripe-failclosed-20261014` stacked on PR #46; documentary parent SHA `c78b09bcd7226a6b02aaeaa146a323f284c3a389`, tested-code anchor `9129a7d9c3bcbc1aa8938a6f0b8103c0d91fb94b`. Its protective 503 remains mandatory and is **not** a standalone deployable release.
- New stacked DRAFT candidate: `security/p0-postgres-first-qa-ports-20261014`, from the exact #48 documentary parent SHA.
- This branch does not modify the existing QA adapters, migrations 001–017, payment service, order store, public controllers, or `AppModule`.

## What was missing and what was added

Existing, **not rewritten**:

1. `NativeClientNestCommerceGuard` — pinned issuer/audience/azp, JWT signature and committed email/SMS admission for a Client-only principal.
2. `QaCanonicalClientQuoteAdapter` — server-authoritative catalog quotation; mobile totals never trusted.
3. `QaCanonicalOrderSnapshotPgAdapter` — transactionally stores a durable order UUID AND immutable merchant-fulfillment snapshot in the same PostgreSQL commit (migration 006).
4. `QaClientCommercePgAdapter` — reserves the separate payment authority with an invariant server-derived HMAC Stripe idempotency key.
5. `QaStripeTestIntentCreator` — Stripe TEST account verification, provider request and PostgreSQL binding, same-key recovery for transport/SQL failures.
6. `QaClientOwnedOrderReceiptReader` — read-only owner-scoped financial state.
7. `QaIsolatedClientCommerceController` — two-phase order/create and payments/create-intent (signed Client access), intentionally absent from production `AppModule`.
8. Separate Stripe signed-webhook inbox, read-only reconciliation and PG financial-finish tests remain QA-only.

**New isolated assembly:** `services/api-nest/src/client-commerce/native-client-checkout-pg-first.qa.ports.ts`.

- Supplies the controller's existing `QA_NATIVE_CLIENT_CHECKOUT_PORTS` interface without altering the controller or live payment flow.
- Rejects calls unless `GITHUB_ACTIONS=true`, `QA_SYNTHETIC_ONLY=YES`, `DA_QA_ISOLATED_CLIENT_COMMERCE_ENABLED=YES`, and `NODE_ENV` is not production.
- Requires a synthetic injected Stripe TEST fetcher; the dedicated CI test runs under Docker `--network none` with fake provider responses.
- Uses distinct PostgreSQL pools and low-privilege service roles. No direct ledger table DML granted to the Client application user.
- Order and immutable snapshot are committed *before* any payment-authority reservation. The PG trigger additionally denies a payment authority for an order without a canonical snapshot.
- A provider timeout or lost DB bind must be recovered with the same mutation/reserved provider key; no minting a second PaymentIntent.

## Targeted evidence / test scope

New test: `services/api-nest/test/p0-pg-first-ports.pg-qa.integration.cjs`.

New isolated CI: `.github/workflows/p0-pg-first-checkout-ports-qa.yml`.

The CI must be judged **only** on its exact final commit SHA. The new tests run actual adapters and PostgreSQL 17 with ephemeral SQL migrations 001–006, fake catalog fixture and Stripe HTTP stub, verifying:

- Database transaction failure before snapshot commit -> no order, no provider request.
- Payment reservation before canonical snapshot -> blocked at SQL, no Stripe.
- Replayed Client mutation -> one order/snapshot; changed fingerprint -> denied.
- Foreign Client owner read and Merchant role -> denied.
- Provider response lost after an intent is created -> same Stripe idempotency key and one synthetic intent.
- PostgreSQL bind failure after provider create -> retry same key; no second synthetic intent.
- Owner receipt stays `awaiting_payment`; dispatch remains false without final financial evidence.
- No external network, LIVE key, real payment, capture, refund, payout, SQL migration on VPS or released mobile app.

**Previously certified evidence is not re-run**: PR #48 checkout hard-stop (9/9 + API/Client TypeScript), PR #45 F4M PG/Keycloak, plus existing isolated signed webhook, financial reconciliation, refunds and role/access suites on their previously certified SHAs. Distinct proofs must not be mistaken for a single end-to-end release certification.

## P0 gaps still explicitly NO-GO

- Real production-grade Client admission, issuer-pinned JWKS resolver, committed SMS/email authority and approved enrollment policy; global `manage-users` is not approved.
- Durable production authorization mapping from public checkout to restricted PG roles and F4M authority; isolated QA is not a live migration.
- Verified webhook ingress, persisted inbox/outbox job delivery, delayed/duplicated events, expired/failed intents, reconciliation scheduler, refund/chargeback hold and manual recovery runbook as a single E2E trace.
- Exact asset/provenance matching between published iOS apps, EAS build identifiers, OTA channels/runtime versions, Git SHAs and backend deployment.
- Release and operational risk review, privacy and multi-country payout/KYB/KYC; Merchant/Courier wallet values remain synthetic read-only, `withdrawableMinor=0` and `payoutEnabled=false`.

**Promotion prohibition:** no merge, deploy, public route wiring, production IAM change, persistent migration, LIVE payment/payout, paid Store build or submission without specific authorization and complete release gates. PR #48's 503 is not lifted.

**Verdict until exact SHA CI finishes:** implementation prepared; integration verification **PENDING**, production **NO-GO**.
