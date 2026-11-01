# DELISHAFRICA / ATM R40 — server BFF QA evidence (30 Oct 2026)

Scope: **isolated canonical DA worktree** on ASUS, branch
`qa/atm-r40-bff-canonical-20261030`, based on GitHub release branch
`release/store-triad-final-security-20261021` commit
`4b9b648d639baa3ce16e7c250b234ba730558070`. The implementation
was first developed and tested in local branch
`qa/atm-r40-server-bff-readonly-20261030` (commit
`ae5553b939d44e3bff144498484cab64c4d71a57`).
Existing DA `release-source`, finance R4S worktree, ATM R40 and ALL VPS
production configurations are untouched by this server-code intervention.

## Direct infrastructure observations (READ ONLY)
- VPS `srv1037391` OraclePay/OrchidPay bridge: `afritaste-orchidpay-bff.service` active.
- Local BFF `GET http://127.0.0.1:8091/api/pay/healthz` returns **200**,
  `{"ok":true,"upstreamReady":true}`. Its server route
  `GET /api/pay/orchidpay/reconciliation/order/{order_id}` requires a
  privileged `X-ATM-Token`. Never copy this token to React Native/Expo.
- DelishAfrica public trusted-identity health is **200** and ready; verifier
  advertises issuer `https://keycloak.afritaste.delishafrica.me/realms/afritaste`
  and merchant resource audience `delishafrica-merchant`.
- User-facing ATM client uses OIDC `afritaste-mobile`. For the new BFF,
  merchant rights require BOTH a trusted `azp`
  (`afritaste-mobile` or `delishafrica-merchant`) AND the
  `delishafrica-merchant` resource audience. Neither mapper nor a valid
  merchant JWT/membership was verified on a real user session.
- Production `/api/v1/merchant/membership/health` is **HTTP 200** but reports
  `membershipCount:2` and **`activeMembershipCount:0`** on 2026-10-30.
  Thus no finance-authorized merchant E2E can be certified without legitimate
  approved onboarding; do not fabricate an eligible membership or bypass KYB.
- New production GET endpoints remain **HTTP 404**:
  `/api/v1/integrations/orchidpay/read-model/me`,
  `/api/v1/merchant/inventory/me`,
  `/api/v1/merchant/suppliers/me`.
  This remains a **RELEASE HOLD**, NOT an app QA failure.

## Implemented server-side in isolated DA QA

1. Nest-only QA endpoints match mobile read adapters exactly (3 GET routes).
   `DA_ATM_READONLY_QA_ENABLED=YES` and `NODE_ENV != production`
   are mandatory; default module is absent from production AppModule.
2. Server validates actual Keycloak token through existing
   `AuthService.resolvePrincipalFromAuthorization`, rejects wrong
   `azp`/aud, revocations, bad role, dev-login, missing ownership,
   cross-merchant scope, ambiguous partner selection, unapproved KYB
   and inactive/expired/revoked memberships. Finance additionally requires
   membership role owner/admin/finance. API has no POST/PUT/PATCH/DELETE.
3. Finance source uses existing server-only bridge over fixed loopback
   `127.0.0.1:8091`. Secret comes from a server-only absolute file path.
   Independent flag `DA_ATM_ORCHID_BRIDGE_QA_ENABLED=YES` plus
   non-production required. Before bridge GET, order IDs are selected
   server-side by parameterized, merchant-scoped, bounded SQL.
   Unknown OrchidPay reconciliation schema fails 503 instead of inventing
   money. Exposed envelopes are `SHADOW`, `verified:false`,
   `amountMinor:null`, `currency:null`, and show NO cash balance.
4. Stocks and suppliers have server-side read-only PostgreSQL QA adapters,
   parameterized merchant scope, at most 250 rows, no writes. Require
   separate `DA_ATM_OPERATIONS_QA_ENABLED=YES` and independently
   provisioned **SELECT-only QA DB credentials**, with PostgreSQL
   `default_transaction_read_only=on`. Source tables do not
   exist in production by assumption; they are **not deployed here**.
   QA-only DDL file has a hard `da.qa_isolated=YES` guard and does
   not insert sample data.
5. All error paths reject 401/403/409/503 without exposing credentials,
   financial payloads, other merchants or stale session data.
6. Local runtime QA HTTP Nest test exercises real controller decorators
   (GET paths, status, no-store, RBAC and 404 for POST) using injected fake
   trust/data ports. It did not access a live DB or financial processor.

## Evidence and promotion gates

- `node node_modules/typescript/bin/tsc -p services/api-nest/tsconfig.json
  --incremental false`: **EXIT 0**.
- `node --test services/api-nest/test/*.qa.test.cjs`: **87 PASS / 0 FAIL**,
  includes Nest HTTP loopback, merchant ownership/RBAC, OIDC audience,
  backend schema limits, bridge token secrecy, and scoped inventory/supplier
  queries; no live finance.
- `git diff --check`: PASS.
- Runtime flags are OFF unless explicitly provisioned in isolated QA.
  No real Keycloak admin edit, no EAS, no payments, no live ledger/payout,
  no production deployment or schema migration.
- **PROVENANCE RESOLVED FOR SERVER PATCH:** GitHub branch
  `release/store-triad-final-security-20261021` at `4b9b648d` has exact
  matching Git blobs with the original local DA source for app.module,
  auth.service, merchant-catalog-gate.guard,
  catalog-foundation.service and financial-state.repository (5/5).
  The QA patch was cleanly cherry-picked onto this exact canonical
  GitHub branch in a separate sparse worktree on Windows (the canonical
  Git tree contains an invalid Windows filename outside the sparse path).
  TypeScript + all 87 backend tests passed again against canonical source.
  No other DA release branch or production checkout was mutated.
  The canonical QA branch can be pushed only as a DRAFT / no auto-merge.

## Not to misinterpret
The existing DelishAfrica -> OrchidPay BFF and relays are reachable and
active. This does NOT prove a completed real payment, a bank settlement, or
the availability of a trusted finance source for ATM. QA routes, TypeScript
and unit/HTTP tests are GREEN; financial merchant E2E, live inventory,
suppliers, authenticated iOS/Android smoke, PR merges and store promotion
remain blocked pending authoritative evidence.
