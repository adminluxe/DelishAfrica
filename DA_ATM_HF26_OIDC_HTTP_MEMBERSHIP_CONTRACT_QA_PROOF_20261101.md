# HF26 — OIDC merchant HTTP integration and membership contract (QA only)

Date: 2026-11-01 (Europe/Brussels). Scope: isolated ASUS source/test worktree, PR DelishAfrica #77 **DRAFT**. No runtime deployment, IAM permission edit, financial operation, store build, or production mutation.

## Execution

- New test: `services/api-nest/test/hf26-oidc-merchant-routes.qa.test.cjs`.
- Starts the **actual compiled Nest** `AuthController`, `AuthService`, `ExternalJwksVerifierService`, `MerchantMembershipController`, `MerchantCatalogOwnershipGuard`, `MerchantCatalogReadController` and `MerchantCatalogGateService`.
- Binds HTTP to local `127.0.0.1:0` with a random free port; no external network.
- Uses runtime-generated ephemeral RSA key pair, RS256-signed synthetic JWT and synthetic role/ownership/membership test objects. No actual Keycloak client, real token, user identity, DB, Redis, email or secret. The test deliberately blocks use of the legacy PostgreSQL vendor runtime.
- Test command `node --test services/api-nest/test/hf26-oidc-merchant-routes.qa.test.cjs` => **1/1 PASS, exit 0**.
- Full backend QA command `node --test services/api-nest/test/*.qa.test.cjs` => **103/103 PASS, exit 0** (102 preexisting + 1 integrated HTTP suite).
- Previous exact TypeScript command `node node_modules/typescript/bin/tsc -p services/api-nest/tsconfig.json --incremental false` => exit 0 (HF26, to revalidate after commit).
- No runtime service restarted or configured.

## Verified HTTP matrix — only isolated ephemeral identities

| Condition | Endpoint(s) | Observed expected status |
|---|---|---|
| Missing bearer | auth/merchant/me, merchant/membership/me, merchant/catalog/me | 401 |
| Forged JWT signature or wrong merchant azp | auth/merchant/me | 401 |
| Authenticated merchant, dual audience Client+Merchant, azp ATM | auth/merchant/me | 200 |
| Merchant identity with no membership | merchant/membership/me | 200, **accessEligible=false**, eligibleMembershipCount=0 |
| Merchant identity with one owned merchant but no membership | merchant/catalog/me and /me/draft | **200 (current code)** |
| Merchant role with no ownership | merchant/catalog/me | 403 |
| Merchant role with multiple owned merchants and no selector | merchant/catalog/me | 409 |
| Merchant role with foreign selector | merchant/catalog/me | 403 |
| Merchant role with owned selector | merchant/catalog/me | 200 |
| Authenticated Ops role, no Merchant role | merchant/catalog/me, auth/merchant/me | 403 |
| Catalogue POST | merchant/catalog/me | 404 |
| Merchant with synthetic eligible membership | merchant/membership/me | 200, accessEligible=true |

## Security policy decision / nontrivial HOLD

The current `MerchantCatalogOwnershipGuard` checks a cryptographically trusted merchant identity and **ownership**, but not an active approved merchant membership. `MerchantCatalogGateService.health()` reports `membershipEnforcementEnabled:false`. Membership endpoint reports eligibility without granting it, so 200 there is not an authorization certificate.

Thus a trusted merchant account with ownership but no active membership could read its own catalog. This may be **intentional onboarding/draft access**, but it has not been approved as a release contract. Do not automatically enforce membership on self-catalog reads: that might break permitted onboarding. Determine and document intended policy; require KYB, contract, active membership and tenant scope for higher-risk ATM business/finance read models. QA tests for those read models already enforce merchant eligibility in an isolated harness.

## Runtime and real-user caveats

- Active production and Ataraxie QA compiled JS **both** use old Client-before-Merchant audience priority, despite HF25 correction in source QA. Neither runtime has been promoted to HF25 in this phase.
- No server rejection reason from the real TestFlight 400017 iPhone Bearer has been captured; Docker prod logs in the sampled 2026-11-01 UTC window produced zero lines. The exact cause of live HTTP 401 remains **UNKNOWN**.
- Canonical OIDC HTTPS discovery 200; prod/QA JWKS health READY, keyCount=1; prod memberships 2 historical/0 active, Ataraxie 0/0. Directly assigned Keycloak merchant role counts (aggregate read-only query) are 11 realm merchant and 1 client-scope merchant across clients; they cannot identify the iPhone account or imply eligible ownership.
- External TestFlight XR RA acceptance, Beta App Review, tactile Android and physical Client→Merchant→Courier→ATM transaction remain **HOLD**. ATM 400017 source SHA `73a55b4` predates ATM QA HEAD `2b4c96d`.
- This file and test are QA-only evidence, not a release promotion. Keep PR #50 and #77 DRAFT and POG #56/#57 OPEN.
