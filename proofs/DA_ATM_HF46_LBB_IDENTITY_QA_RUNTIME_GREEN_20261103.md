# POG HF46 — ATM identity: confirmed owner mapping, QA runtime canary, HF44 release source

Date: 2026-11-03 (Europe/Brussels). Scope: read-only production observation and isolated QA execution. No payment, Keycloak role mutation, merchant activation or Store build.

## Production identity, read-only
- La Boule Bleue slug: `la-boule-bleue`; exactly ONE active ownership row with `owner` role.
- Owner subject matches exactly ONE membership and the trusted identity-subject registry with the canonical realm issuer.
- Membership: pending. Contract: pending. KYB: pending.
- Published partner public status: pending_verification; acceptingOrders: false.
- Production order list for the merchant: ONE order with status pending (no client/customer/order identifiers exported).
- Against existing Keycloak Postgres afritaste realm: owner subject exists as an enabled user; direct Merchant realm role assigned; Client, Courier, Ops/Admin direct roles absent. Read-only. No account credential or token accessed.
- This proves that the backend merchant owner record maps to an enabled Keycloak Merchant identity. It DOES NOT prove that the particular currently signed-in iPhone session uses this subject.

## OIDC HF46 surgical correction
- The currently deployed production JS verifier is byte-for-byte identical to the compile of release/store-triad-final-security-20261021 SHA 4b9b648, baseline SHA256 d2bf9e696bf2d3c55fa96d44dba5a80dc368e13b638f9ea9e015014b1155bb96.
- Baseline signed-token regression (generated ephemeral RSA, no real user or JWKS keys): 9 PASS / 4 FAIL.
- HF25 source fix resolves role by authorized party (azp) + matching resource audience; OPS audience remains highest priority and cannot fall through; merchant role remains mandatory; signature, expiry, issuer, subject enforced.
- Patched old-release source + tests: 13/13 signed-token and one full Nest HTTP synthetic role/membership test PASS, TypeScript EXIT 0.
- Patched existing LIVE-derived Docker image built locally without modifying running prod: sha256:6b95d2f42672e56f5cdef8118617d14acae035f5ddca52188ae2c49eb1a0ac3c.
- Offline container, network=none: signed-token tests 13/13 PASS.
- ASUS full canonical QA backend: 104/104 PASS.

## Isolated Docker API canary
- Container `da-atm-hf46-oidc-qa-canary`, not published to public network or ports, image derived from above + only existing pg runtime vendor dependencies (required by old LIVE container).
- Network: `da-ataraxie-qa-20261101`. QA config; no production financial secrets; provider external calls OFF; client/invitation writes OFF; NODE_ENV production; DATABASE_URL empty to avoid all DB mutations; read-only rootfs, tmpfs runtime.
- Actual Nest boot: GREEN. `auth/trusted-identity/health` HTTP 200 ready=true; unauthenticated `auth/merchant/me`, `merchant/catalog/me`, `merchant/membership/me` -> HTTP 401; catalog gate health HTTP 200.
- QA canary has intentionally no DB context; it cannot prove merchant ownership read end to end. The production databases were queried separately in read-only mode.

## Latest store candidate HF44 source
- Source parent `0972513a5ccca0b51ec5dae3329eb051ec352d8d`, release/delishafrica-v304-hf44-production-candidate-20261103.
- Same HF25 OIDC patch applied surgically to HF44 worktree `fix/atm-hf46-hf44-source-20261103`.
- TypeScript backend EXIT 0; full available local Node backend tests 18/18 GREEN.
- Previous separate old-release PR #84 CI failed due inherited `node-forge@1.4.0` advisories (51 vulnerabilities / 14 high); HF44 uses `node-forge@1.4.2` override. No security gate bypass.

## Outstanding HOLD
- No production runtime patch, no PR merge, no membership/KYB override.
- Live signed-in La Boule Bleue iPhone token's issuer/subject/azp/aud/role and authenticated `auth/merchant/me -> merchant/catalog/me` remain to be proven. Do not assume personal app session maps to owner based on matching login words alone.
- Existing financial transaction ("cappuccino") not attested in ATM; Stripe connector accounts are not the correct authority to assert this.
- Promotion requires passing CI for HF44 source, a controlled reversible backend deployment with cross-app smoke, and physical-account validation.
