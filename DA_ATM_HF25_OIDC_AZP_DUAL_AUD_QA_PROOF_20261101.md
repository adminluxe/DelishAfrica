# DelishAfrica / AfriTaste Manager — HF25 OIDC multi-audience security fix (QA only)
**Date:** 2026-11-01 Europe/Brussels.
**Scope:** isolated canonical QA worktree `qa/atm-r40-bff-canonical-20261030`, PR #77 DRAFT.
**No production deployment, Keycloak admin mutation, AAB/IPA rebuild, payment action or Store submission.**

## Trigger: live iPhone 17 Pro, TestFlight 3.0.6 (400017)
Screenshot supplied at 22:56 Brussels: Bearer present, JWT readable, local issuer/audience/azp/expiration hints = YES; obsolete literal merchant role hint = NO; four protected merchant GET routes = HTTP 401. The app-local JWT decoder does **not** verify the signature or server side RBAC and cannot establish exact server rejection reason.

## Deterministic code defects and RED proof
Source: `services/api-nest/src/auth/external-jwks-verifier.service.ts`.
- The former `resolveExternalRole` selected a CLIENT audience before a MERCHANT audience. With a **synthetically signed** Keycloak-shaped token using `azp=afritaste-mobile`, `aud=[delishafrica-client,delishafrica-merchant]`, and merchant role, the valid signature was verified, yet the verifier returned `authorized_party_mismatch` as if the token belonged to Client.
- The former merchant branch did not enforce that `azp` be an approved merchant application client. A validly signed synthetic token with merchant audience/role but unrelated `azp` was erroneously accepted as a merchant principal. This is a security hardening necessity independent of the iPhone issue.
- Regression suite added: `services/api-nest/test/trusted-identity-multi-audience.qa.test.cjs`, generating **ephemeral RSA test keys and fake claims entirely in memory**, with no real user token or network. Before fix: **9 PASS, 4 FAIL** (four precisely reproducible discrepancies).

## Guarded correction
- Preserve highest-priority dashboard/OPS audience and authorization checks.
- Select Client/Courier/Merchant role using both `azp` and required audience. For ATM accept `afritaste-mobile` with `delishafrica-merchant` audience; for merchant native accept `delishafrica-merchant` with that audience.
- Reject all other merchant `azp` values before creating a principal, with existing `authorized_party_mismatch` error.
- Role verification remains required (`merchant` or configured realm/client role); JWT RS256 signature, issuer, exp, nbf, iat, subject and ownership/membership gates are preserved.
- Cross-app synthetic negative cases confirm that a Client, Courier, or Ops token is not granted merchant access.

## GREEN re-run (ASUS)
- `node node_modules/typescript/bin/tsc -p services/api-nest/tsconfig.json --incremental false`: **EXIT 0**.
- `node --test services/api-nest/test/*.qa.test.cjs`: **102 PASS / 0 FAIL** (89 pre-existing + 13 new).
- `git diff --check`: **EXIT 0**.
- No runtime QA/prod services restarted or deployed. Neither the merchant 401 on the existing TestFlight IPA nor a positive authorized QA identity is certified as fixed yet.

## HOLD and next gate
- Current TestFlight 400017 was built at SHA `73a55b4` before the latest ATM HF22 source patch and before this backend fix; it has **not** been rebuilt.
- Verify the server-side failure reason via an authorized read-only trace without ever exporting JWT, refresh tokens, user identifiers or secrets.
- QA partner `atm-qa-r41-20261101` remains pending a legitimate test identity, authorized ownership, verified membership and contractual/KYB checks.
- Keep PR #77 DRAFT and POG security reserves #56/#57 OPEN. Review full GitHub CI and 3-app Hermes exports before any possible QA promotion. Production remains unchanged.
