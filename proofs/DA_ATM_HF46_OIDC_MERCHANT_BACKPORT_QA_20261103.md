# POG / AfriTaste Manager HF46 - OIDC merchant role hotfix candidate
Date: 2026-11-03 (Europe/Brussels)
Scope: QA-certified source + local VPS image, NOT deployed to LIVE.

## Exact source/runtime reconciliation
- LIVE API container: `delish-api` based on `delishafrica-api:r6q-requester-identity-20261026`.
- LIVE verifier artifact was copied without changing running container.
- Repository base: `release/store-triad-final-security-20261021`, SHA `4b9b648d639baa3ce16e7c250b234ba730558070`.
- Unmodified TypeScript rebuild verifier SHA256: `d2bf9e696bf2d3c55fa96d44dba5a80dc368e13b638f9ea9e015014b1155bb96`.
- Deployed production compiled verifier SHA256: identical (byte-for-byte).
- HF25 fix copied surgically from already tested QA branch `qa/atm-r40-bff-canonical-20261030`.
- Modified verifier SHA256: `b3f3eece74bf1ad79bea61db999a5712ae7004e5754df49662d65639b79d4bbb`.
- Patch touches only `services/api-nest/src/auth/external-jwks-verifier.service.ts` (+22/-4 source lines), with associated QA test fixtures.

## Exact safety semantics
- Master Dashboard OPS audience always wins, no fallback to Merchant.
- Merchant role requires BOTH `azp` in `afritaste-mobile|delishafrica-merchant` AND Merchant audience and configured Merchant role.
- Client/Courier tokens cannot borrow Merchant entitlement even if token contains Merchant audience.
- JWT signature, issuer, kid, expiry, audience, subject, scope and server ownership gates retained.
- The patch does NOT create partners, change Keycloak roles, enable membership, relax KYB, grant financial access, or mutate orders.

## Executed QA
- Baseline prior to patch, from relevant release source: TypeScript exit 0, isolated signed-JWT tests **9 PASS / 4 FAIL** (RED reproduced).
- After patch from release source: TypeScript exit 0; 13/13 signed-JWT security tests GREEN; 1/1 authentic Nest HTTP synthetic-identity/membership/catalog contract GREEN.
- Same patched JS in local image `delishafrica-api:atm-hf46-oidc-20261103`:
  - SHA256 verifier matches above.
  - Image ID sha256:6b95d2f42672e56f5cdef8118617d14acae035f5ddca52188ae2c49eb1a0ac3c.
  - Derived **offline-test** image with fixture, --network none: 13/13 pass (no Keycloak/DB/PSP network).
- ASUS canonical QA backend entire suite: 104/104 GREEN.
- Production public `/auth/trusted-identity/health` READY, one JWKS key, issuer canonical, no lastError.
- Unauthenticated protected GETs `/auth/merchant/me`, `/merchant/catalog/me`, `/merchant/membership/me`: HTTP 401 expected.
- Public Merchant membership health currently: two memberships, ZERO active. This is a legitimate business HOLD.

## Runtime and business HOLDs
- LIVE `delish-api` container was NOT replaced, no production Keycloak update, no payment, no Store/EAS build.
- Signed-in La Boule Bleue iPhone access token has NOT been validated against backend with matching subject and azp/aud/roles. Do not treat synthetic GREEN as real-account GREEN.
- Previous HF27 read-only ownership evidence: one owner and matching membership subject, but merchant membership/contract/KYB pending.
- La Boule Bleue public profile: `pending_verification`, `acceptingOrders=false`. Never activate without commercial authorization.
- OrchidPay/finance cannot be marked attested without active eligibility and per-order evidence. Stripe connector accounts from earlier chat are NOT authoritative for this transaction.

## Candidate promotion plan (not executed)
1. Inspect CI and exact source/runtime contract, approve narrow security backport.
2. If authorized QA canary fully passes, preserve original image + deployment manifest and perform controlled, reversible deployment with external health + 401/403 and cross-app smoke.
3. Re-authenticate physical La Boule Bleue user; prove `auth/merchant/me` -> `merchant/catalog/me` same trusted issuer+subject and owned partner slug.
4. Keep finance/order mutations disabled until genuine KYB/contract/membership/PSP evidence and separate authorization.
5. On failure restore original `delishafrica-api:r6q-requester-identity-20261026` without touching payment signing or other apps.
