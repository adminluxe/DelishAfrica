# DelishAfrica - Order-first UX candidate - 2026-10-11

Status: **DRAFT CANDIDATE / DO NOT MERGE BEFORE ON-DEVICE CHECKS**

## Decision respected
The identity provider (Keycloak/OIDC) remains a backend implementation detail. No new signup, password reset, forced account screen, or Keycloak-flow modification belongs to this candidate.

The existing customer journey already collects and verifies contact/address in Client Space before payment. This PR does not change those sensitive verification rules, payment intent creation, idempotency or order transaction logic.

## Source baseline
- Repository: `adminluxe/DelishAfrica`
- Base: `main` at `161f7d568a1edcaec702916747b68d1a6e16cf0b`
- Candidate branch: `feat/valerie-client-order-first-20261011`
- Files changed (UI only): `apps/client/app/index.tsx`, `apps/merchant/app/index.tsx`, `apps/courier/app/index.tsx`.

## Change summary
1. Client: the primary **Commander maintenant** action now appears ahead of the optional Radar rail.
2. Client: clarify that restaurant browsing does not require an account, and explain contact/address verification in the normal checkout, without suggesting an additional account-creation step.
3. Client: Radar copy explicitly indicates discovery, not an ordering requirement.
4. Merchant / Courier: remove internal `S10N` release code labels and some development jargon from visible home screens; keep route targets and permission checks unchanged.
5. Preserve all existing protected API, merchant association, delivery role and payment gates.

## Evidence available
- TypeScript 5.9 transpilation syntax check of all three changed TSX files: PASS.
- Baseline OIDC screen and `useDaPkceAuth.ts` unchanged: PASS.
- Five source-level assertions including order-first placement: PASS.
- `git diff --check`: PASS.
- No full typecheck with Expo dependencies yet; no simulator or device run.
- No production deployment, EAS build, Store submission, Meta publish or payment touched.

## Mandatory release gate
- Confirm normal guest discovery -> restaurant -> menu -> cart -> preflight on Android and iOS.
- Confirm primary ordering action appears before the Radar at small viewport size and with text scaling/accessibility enabled.
- Confirm Radar remains reachable and clearly optional.
- Confirm SMS/email/address validation behaves exactly as before; no fake identity is accepted.
- Confirm duplicate-payment protection and order confirmation against a sandbox provider only.
- Confirm Merchant/Courier wording works on actual devices and role gates fail closed.
- Run monorepo typecheck, lint, and relevant CI.
- Rebuild using certified EAS credentials and version increments only after QA and explicit release go.

## Provenance note
Source changes alone are not evidence of app distribution, and no Store-live claim is made.
