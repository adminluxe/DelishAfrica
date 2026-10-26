# DELISHAFRICA R6C — CLIENT UX CLARITY — 26 OCTOBRE 2026

## Scope and source
QA only. Branch qa/r6c-client-simplified-20261026, based on enrollment worktree at /home/afripayadmin/DA_WORKTREES/da-client-enrollment-qa-20261012. The active production release and Stores are not modified by this UI patch.

Evidence from 10 iPhone screens captured 26 October 2026, supplied by product owner:
- Mon espace showed 3/3 proofs then a secure-session panel with TWO return-to-space actions.
- A subsequent visit showed 0/3 despite an authenticated account on the previous screen.
- Saving the profile displayed a modal advising activation again.
- Account activation screen correctly remained disabled on the server, but the distinction between local profile and real account was opaque.
- Stripe TEST payment and order confirmation were observed in the screenshots; existing payment, cart and tracking code is NOT changed in this patch.

## UX R6C contract
1. Two visible steps, not a wall of forms: contacts (first name, email, SMS) then delivery address and consent.
2. An existing saved verified profile opens as a short summary: direct continuation and an edit link; no second "Enregistrer mon espace" button.
3. Signed-in OIDC session displays "compte connecté" and never simultaneously prompts "Activer mon compte". An authenticated principal from another scope is NOT automatically given a previous guest profile.
4. Creation disabled: UI explicitly says the draft is saved on this device but that no NEW account was created. Readiness is probed from backend; no fabricated status.
5. Optional food preferences are collapsed for a fresh user; prior allergen signals remain visible for review and explicit confirmation.
6. A single clear primary CTA per stage; legal access remains available at the bottom.
7. Secure-session authenticated view no longer displays two near-identical "Retour à mon espace" buttons. A non-checkout login returns automatically to Mon espace without another tap.
8. Activation screen bypasses creation for authenticated users; users not yet verified have one clear return to their details.
9. Critical invariants preserved: SMS/email signed attestation, 30-day proof expiry, trusted addresses, consent, one-time enrollment, scoped SecureStore by principal, payment never auto-starts during onboarding.
10. The actual Client enrollment endpoint remains disabled (backend security gates have NOT been waived).

## QA / Verification
- Original exact file hashes matched three files in isolated VPS worktree: client-space, secure-session, activate-account.
- ASUS QA sources updated and Metro remains bound to http://192.168.1.5:8095 (DEV CLIENT).
- ASUS Client QA TypeScript noEmit: PASS.
- VPS isolated enrollment worktree Client TypeScript noEmit: PASS.
- Metro Expo manifest iOS: PASS. iOS JavaScript bundle: HTTP 200, 11,375,602 bytes.
- Android bundle: see separate acceptance receipt after test completion.
- iPhone+Android tactile walkthrough: PENDING. Native Store builds and LIVE enrollment: NOT CERTIFIED.

## Release boundaries / rollback
- No production API feature-flag changes, no IAM creation, no role bypass, no card payments, no Stripe LIVE, no Store deployment.
- Source backups ASUS: C:/Users/Valerie/Documents/DA_CLIENT_ENROLL_QA_20261011/R6C_UX_BACKUP_20261026 (profile name actually accented on disk).
- Source backups VPS: /home/afripayadmin/DA_EXPORTS/DA_R6C_UX_BACKUP_20261026.
- Authoritative safe QA branch: qa/r6c-client-simplified-20261026, stacked on the Client enrollment candidate; not to merge into the unconnected live branch blindly.

## Device acceptance checklist, to execute once updated bundle is visible
1. With previously verified contacts, Mon espace opens to the compact summary instead of a long form.
2. When already connected, show a single "Compte connecté" state, not another activation.
3. Edit existing address only: phone and email proofs are preserved if contact values are unchanged.
4. In first use, contacts -> address -> continue; only one save; optional allergies do not block unless selected, and selection then requires explicit review.
5. In secured session, one return button, not two; after sign-in, non-checkout route returns to Mon espace.
6. When enrollment server disabled, explain "local saved != account created" in clear words; do not ask for card credentials.
7. A guest profile cannot be imported into another unrelated OIDC subject.
8. Only order checkout preflight may trigger payment; preserving existing signed Stripe TEST checkout and order tracking.
