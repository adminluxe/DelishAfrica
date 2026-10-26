# DelishAfrica® — Client Enrollment secure mainline reconciliation (R6Q, 2026-10-26)

Status: **DRAFT / GATED, not a Store release**.

## Why this branch
GitHub PR #75 diverged from both `main` and its target feature branch. This branch is based directly on current `main` and brings only the guarded NestJS Client Enrollment module, PostgreSQL migration, tests and canonical requester-IP code.

## Verified against the live VPS
- Keycloak **26.8.1** installed with rollback, JWKS continuity and HTTPS endpoints validated (R6K).
- FGAP v2 service account `delishafrica-client-enrollment` restricted to `/da-clients-enrollment-v1`: Merchant/Courier read/write forbidden HTTP403; synthetic create/disable PASS, cleanup PASS (R6L).
- Keycloak realm default `client` role leaked into all new accounts. **Fixed in R6O**, with backup and independent QA clone test. Only dedicated Client group grants the role.
- Keycloak 26.8 managed user attributes `phoneNumber` and `delishafrica_enrollment_version` were not persisted until explicitly registered in the profile. **Fixed and verified in R6O**, including activation/disable with attributes.
- Real Postmark SMTP e-mail reached the project-owned Gmail QA mailbox and contained HTTPS signed reset link. QA user cleaned. This proves delivery, **not** completed browser password reset (R6N).
- Production API R6Q overlay deployed, base preserved, 9 mounts, loopback port, env and rollback container. Public API HTTP200 and Client enrollment `enabled:false`.
- Nginx already rewrites X-Real-IP from verified Cloudflare real-IP. The API helper reads only that Nginx value when direct peer is the pinned Docker bridge gateway `172.19.0.1` and mode flag is verified; all other forwarded headers rejected. Both identity-proof and signup share the same identity for rate-limit coherence.
- Mainline reconciliation worktree built on VPS: Nest TypeScript 0 errors, Nest build PASS, **Client enrollment tests 14/14 PASS**, **requester-IP spoof regression assertions 9/9 PASS**.

## Explicit release prohibitions
- Public Client signup is still OFF; do not set `DA_CLIENT_ENROLLMENT_ENABLED=true` without real iOS/Android signup, SMS/e-mail proofs and anti-replay, database verification, edge multi-client IP tests, and actual password-reset browser flow.
- IdentityProof reporting configured true does not certify high availability: remediation flag remains disabled and attempt store remains single-instance memory.
- Merchant/Courier finance screens show operational counts from `orders/demo/list`, not settled money; no ledger-based payouts or balances are certified.
- THIEYP/LA BOULE BLEUE await contractual identity validation; their catalogs are preview-only.
- Stripe TEST complete vertical and Store publication evidence are still pending.
- This PR does not change production IAM realm configuration; separate operational evidence is stored on VPS.

## Evidence on VPS
- `/home/afripayadmin/DA_EXPORTS/DA_R6Q_API_CUTOVER_20261026.json`
- `/home/afripayadmin/DA_EXPORTS/DA_R6O_KEYCLOAK_HARDEN_PROD_20261026.json`
- `/home/afripayadmin/DA_EXPORTS/DA_R6Q_MAINLINE_TSC_20261026.log`
- `/home/afripayadmin/DA_EXPORTS/DA_R6Q_MAINLINE_NEST_BUILD_20261026.log`
- `/home/afripayadmin/DA_EXPORTS/DA_R6Q_MAINLINE_ENROLL_TEST_20261026.log`
- `/home/afripayadmin/DA_EXPORTS/DA_R6Q_MAINLINE_REQUESTER_TEST_20261026.log`
