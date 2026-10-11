# DELISHAFRICA — ROADBOOK / GATE CLIENT ENROLLMENT & REAL VERTICAL — 2026-10-11

**Status:** confirmed blockers, remediation planned, no destructive reset, no production deployment, Store release ON HOLD.
**Source of evidence:** 25 iPhone screenshots (IMG_0989.PNG through IMG_1014.PNG), GitHub repository analysis and previously known runtime state. Screenshots are intentionally not committed because they show personal contact and location information.

## What the iPhone captures actually prove
- Client: profile/address/SMS/email reach 3/3; marketplace/cart and secure checkout load, but **no OIDC account enrollment** is offered. Hosted browser authentication still says **AFRITASTE** with username/password and "Invalid username or password". An API-accepted Client OIDC subject is NOT established.
- Merchant (Thieyp): 5 orders visible, 4 delivered and 1 in route; this proves a read, NOT a new live Client→Merchant transaction.
- Courier: operational screens and a restored session are visible; a diagnostic also shows **jwt_role_missing**, so authorization cannot yet be accepted as fully validated.
- No completed Stripe sandbox purchase and no single fresh order tracked end-to-end across all three actors is demonstrated.

## Security-sensitive code facts
- apps/client/auth/daOidcConfig.ts: issuer remains https://keycloak.afritaste.delishafrica.me/realms/afritaste ; OIDC clientId delishafrica-client.
- apps/client/auth/daOidcClaims.ts: issuer + audience + azp + client role are mandatory; guest identity/profile evidence is NOT an OIDC access token.
- apps/client/app/client-space.tsx: collects/validates contact and address; it does not provision OIDC identities.
- services/api-nest/src/identity-proof/identity-proof.service.ts: proof token validation is tied to role, channel, recipient and validity, but an enrollment API also needs persistent one-time/anti-replay guarantees.
- services/api-nest/src/orders/orders.controller.ts: orders/demo/reset calls resetDemoOrders() for ops; no filtering by Stripe mode/payment or active status.
- services/api-nest/src/orders/orders.demo.store.ts: persistent file from DA_DEMO_ORDERS_STORE_FILE or .runtime/orders-demo-store.json; a historical "demo" path can be linked to a Stripe verified paid order.
- services/api-nest/src/orders/orders.access.service.ts: order creation verifies payment authority and role, so naive wiping risks paid history and reconciliation.

## Decisions
1. Client enrolment must be **native DelishAfrica UX, self-service**; never distribute technical Keycloak credentials to customers.
2. Verify existing SMS/email/address evidence on the API, exact role/destination; rate limiting, anti-replay, idempotency, anti-enumeration; only then server-side Keycloak provisioning limited to client-only identities, with activation and recovery. Avoid realm-wide default client role or global registration on a shared Merchant/Courier realm without explicit isolation.
3. Preserve OIDC issuer/PKCE/nonce/audience/azp/role. Rebrand hosted login, activation and email templates. At the end of login return to checkout preflight; NEVER create a charge automatically.
4. Check guest→client profile scoping and cross-account leakage, refresh/revocation and return journey on iPhone and Android.
5. Before a reset: inventory actual runtime file + payment modes, independently reconcile Stripe test/live, pause API writers and mission processes, encrypt and verify backups, purge ONLY unambiguous terminal synthetic nonfinancial fixtures. Do NOT call POST /orders/demo/reset blindly.
6. New one-ID vertical only after clean verified state: Client sandbox checkout → Thieyp Merchant accept/ready → Courier offer/accept/pickup/GPS ETA/delivery → Client tracking. No real charge.
7. No merges of identity changes, EAS build/store submission, or permission changes until device/CI/security gates pass.

## Provenance and tracking
- [#33 — Customer self-enrollment blocking payments](https://github.com/adminluxe/DelishAfrica/issues/33)
- [#34 — Safe demo order cleanup and genuine three-sided vertical](https://github.com/adminluxe/DelishAfrica/issues/34)
- [PR #32 — UI Maps and auth wording, still DRAFT](https://github.com/adminluxe/DelishAfrica/pull/32). Does not provision a Client account.

A separate offline kit was prepared 2026-10-11: DA_SAFE_DEMO_ORDERS_RESET_V1.py, DA_VERTICAL_READINESS_AUDIT_V1.sh and ROADBOOK_GATE_CLIENT_VERTICAL_20261011.md; on synthetic files, encrypted backup+reset+restore and test/live/unknown/active fail-closed checks all passed. The kit was NOT run against the real VPS. Remote command execution became unavailable while resuming the audit, so no operations on the live VPS were performed after that limitation.

**Hard facts to preserve in subsequent chats:** official VPS repository is /opt/delishafrica/monorepo (contains uncommitted API, orders and financial state changes that MUST NOT be reset); canonical VPS ports 3010 / 8081 / 8082 / 8083 according to pinned roadbook, while Asus iOS QA on 192.168.1.5 used original ports 8081/8082/8083 and temporary PR32 QA ports 8091/8093. Do not conflate server locations or assign new canonical ports.

Last updated 2026-10-11.