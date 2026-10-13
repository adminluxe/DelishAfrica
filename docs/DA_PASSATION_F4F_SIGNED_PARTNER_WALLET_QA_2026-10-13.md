# DELISHAFRICA® — PASSATION F4F — JWT signé → portefeuille Merchant/Courier QA
**13 octobre 2026 | PR #38 DRAFT | F4F sécurité QA isolée ; véritable identité financière opérationnelle : NO-GO**

> Ne pas confondre le JWT synthétique signé par une clé éphémère dans CI avec une session du Keycloak public. Aucun jeton, banque, Stripe TEST officiel ou appareil de production n'a été utilisé. Aucun payout.

## A. Référence et sanctuarisation

- Repo : `adminluxe/DelishAfrica`.
- F4D : SHA `cd0ba578401d087f9f42c4303e5501704d6bbf94`, [PG17 38325285489](https://github.com/adminluxe/DelishAfrica/actions/runs/38325285489) et [API + apps 38325285497](https://github.com/adminluxe/DelishAfrica/actions/runs/38325285497) SUCCESS.
- F4E : SHA `ae90656dfe3b25ac69a9b1b32f1ebaec5725822d` (docs incluses), [PG17 38327446269](https://github.com/adminluxe/DelishAfrica/actions/runs/38327446269), [API + 3 apps 38327445964](https://github.com/adminluxe/DelishAfrica/actions/runs/38327445964) SUCCESS, [PR #37](https://github.com/adminluxe/DelishAfrica/pull/37) DRAFT.
- F4F : `feat/f4f-wallet-verified-session-bridge-qa-20261013` ; [PR #38 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/38), empilée sur #37. Aucune fusion.
- Code de laboratoire autonome, pas de registration dans `services/api-nest/src/app.module.ts`, pas de modification des apps Expo publiées.
- Papy Toshiba : worktree existant `/home/tontoncestcarre/work/DA_STRIPE_RECON_QA_20261012` conservé ; PAS de reset, checkout, dépendances, migration ou Docker local imposés.
- VPS `/opt/delishafrica/monorepo/apps/{client,merchant,courier}` non touché.

## B. Chaîne cible (distinction claire entre QA et production)

```text
Merchant / Courier Bearer JWT    (F4F CI: signature RSA SYNTHÉTIQUE)
     |
     v
Verificateur OIDC officiel de l'API : signature, issuer,
audience, azp, role, horodatage, sub UUID  [API QA]
     |
     v
Bridge QA : sid/jti obligatoires, TTL max 15 minutes,
identité issue UNIQUEMENT du vérificateur (aucun slug HTTP),
role Merchant ou Courier, issuer épinglé
     |
     v
Service de révocation de session indépendant, réponse fraîche < 5 s
(FAUX registre en test ; VRAI service non raccordé)
     |
     v
Registre métier Merchant : UNIQUE, actif, contrat actif,
KYB verified, published, organisation/territoire, dates valides
OU registre Courier : actif, contrat, KYC, organisation/territoire
(registres QA synthétiques 010, source réelle non reliée)
     |
     v
Connexion PG17 sous compte Merchant/Courier distinct
      + attestor PG SQL **AUTRE COMPTE**
     |
     v
challenge PG liée à session_user + backend PID/start
     |
     v
attestation 010 sur identity/organization/territory
     |
     v
ticket unique court → da_qa_wallet_read_attested_010
     |
     v
ledger synthétique 009 : earning pending/available/held, pas de payout
```

Le lecteur Merchant/Courier n'accepte que `Authorization: Bearer <JWT>` et `limit`. Le slug, le sujet, l'organisation et le territoire proviennent de la preuve vérifiée et sont comparés aux registres SQL ; aucune identité passée dans un body mobile n'est considérée comme autorité. Le propriétaire SQL ne détient pas le droit de créer un paiement réel.

## C. Fichiers livrés

- `services/api-nest/src/client-commerce/merchant-courier-wallet-signed-session.pg-qa.bridge.ts` : nouvelle classe `QaWalletVerifiedSessionBridge`; verrous fail-closed (activation CI et refus `NODE_ENV=production`), reconnaissance JWT, vérification d'une session active, contrat/KYB/roster, scope DB, reprise d'un ticket strictement de même session PostgreSQL, cohérence du ledger et du nom de compte légal.
- `services/api-nest/test/merchant-courier-wallet-signed-session.pg-qa.integration.cjs` : PostgreSQL17 réel déconnecté, deux commerçants, deux coursiers, faux realms séparés, paire RSA générée en mémoire, signatures vérifiées, usurpation, absence de droits, révocations, impayés/réserves et aucun versement.
- `services/api-nest/test/merchant-courier-real-signed-jwt-verifier.qa.test.cjs` : tests du véritable `ExternalJwksVerifierService.verifyToken` sur une paire RSA **synthétique épinglée en mémoire**, sans réseau Keycloak ; vérifie aussi le rejet des audiences et rôles croisés, `azp` et altérations de signature. Ce test ne certifie ni la provenance d'une JWKS réelle ni les permissions FGAP.
- CI `.github/workflows/native-client-commerce-authority-postgres-qa.yml` et `.github/workflows/client-enrollment-gate.yml` : testent cette chaîne après migration QA 010, API TS et applications Client/Merchant/Courier, sans build payant ou public.

## D. Jeux adversariaux à satisfaire

1. JWT Merchant A → seul wallet A (18,40 € synthétiques) ; Merchant B autre organisation/territoire → 0, jamais A.
2. JWT Courier A assigné → 3,90 € synthétiques ; Courier B non assigné → 0 ; même sujet dans un autre realm → 0 et aucune confusion.
3. Signature RSA invalide ou charge utile altérée, issuer/audience/`azp` non conforme, rôles croisés, mauvais sujet, JWT expiré, SID/JTI absent → rejet opaque.
4. Session signée mais révoquée → refus malgré `exp` non expiré.
5. Contrat Merchant suspendu / registre Courier inactivé → refus même avec JWT et session valides.
6. Attesteur SQL sous mauvais login, fraude sur le ticket ou scope, replay ou connexion PostgreSQL différente → refus F4E 010.
7. `withdrawableMinor=0`, `payoutEnabled=false`, appel Stripe = zéro, route API publique = zéro.

Ces preuves confirment seulement les propriétés du **laboratoire synthétique sur un PostgreSQL 17 réel isolé** et des tests RSA en mémoire. Jamais d'argent véritable.

## E. État des preuves et certification

- Exécution initiale F4F sur SHA `319142a00e916107e472f12dff3f28120dd74ed7` : [PG17 #38328234670](https://github.com/adminluxe/DelishAfrica/actions/runs/38328234670) SUCCESS, marqueurs `QA_F4F_RSA_MERCHANT_A_B_SEPARATE_SQL_WALLET=PASS`, `QA_F4F_RSA_COURIER_REALM_ORG_SESSION_PARTITION=PASS`, `QA_F4F_SIGNED_BUT_REVOKED_PARTNER_SESSIONS=DENIED`, `QA_F4F_REAL_STRIPE_CALLS=ZERO_PAYOUTS=ZERO`.
- Les modifications ultérieures du test JWT réel et du workflow API **nécessitent une nouvelle double CI sur le SHA final**. Aucun statut global SUCCESS n'est affirmé ici avant consultation des runs finaux.

## F. Blocages P0 réels / critères d'acceptation

- Service d'identité indépendant devant utiliser les **vraies** signatures/issuer/audiences Keycloak Merchant/Courier avec validation `azp`, expiration, rotation, logs et révocations effectives (`sid`/`jti`). Actuellement `AuthService` ne gère explicitement la révocation Redis que du Client.
- Autorité des memberships Merchant réel (contrat/KYB + identité légale) et véritable registre de coursiers : source durable, multi-organisation et territoire, révoquée de façon atomique. Les 010 sont des fixtures.
- Attestor réellement isolé dans un service dont les credentials ne sont **pas** disponibles à l'API publique, revue des privileges SQL et résistance à la compromission des services.
- Chaîne de lecture ET d'écriture Merchant/Dispatch/Courier sous attestation ; ancienne écriture 007 désactivée après 010. Aucun rétablissement sans batterie adverse.
- Versionnement financier par territoire/devise/contrat/frais/taxes/PSP ; chargebacks, refunds partiels, prorata, négatifs, KYC/KYB, settlement. Pas de payout.
- Raccordement Stripe **TEST officiel** seulement après P0 vrai, puis G0–G7 et autorisation explicite ; Stripe LIVE, VPS, Store, merge demeurent interdits.

## G. UX premium cible (pas de livraison dans cette PR)

Merchant et Courier verront leur solde évoluer uniquement après événement financier certifié par l'API avec identifiant de commande, journal de commissions, réserve, disponibilité opérationnelle, bloqueur de litige, date de synchronisation et futur statut de versement **sans préfigurer un vrai virement**. L'information hors ligne doit être datée, jamais présentée comme un nouveau solde certain.

**Statut final provisoire : F4F-NEW-QA-LAB / REAL-OIDC-NOT-WIRED / NO-STRIPE / NO-PAYOUT / NO-PROD / NO-MERGE / NO-STORE.**

---

## H. CI de code F4F synchronisées, à épingler

**SHA exact `2d7b6b250bf160244f91c85eeb80615fb6e9b4e4` :**
- [PostgreSQL17 QA F4F, #38328354487](https://github.com/adminluxe/DelishAfrica/actions/runs/38328354487) — **SUCCESS** ; exécute la vraie transaction PG17 et le pont à identité RSA synthétique, registre métier synthétique, session active/révoquée.
- [API + Client + Merchant + Courier QA F4F, #38328354493](https://github.com/adminluxe/DelishAfrica/actions/runs/38328354493) — **SUCCESS** ; compile les quatre workspaces et vérifie l'implémentation réelle de `ExternalJwksVerifierService.verifyToken` avec signatures RSA synthétiques et garde d'isolation des rôles.

**Précision documentaire** : le prochain SHA après documentation sera contrôlé à son tour avant de signer ce jalon comme version QA finale. La correction F4F ne signifie pas un vrai raccordement de Keycloak/KYB/Courier et ne prouve aucun flux bancaire.

## I. Sécurité de fermeture

- PR #38 reste DRAFT, base PR #37 DRAFT, aucun merge.
- Ancienne branche F4D et son worktree Toshiba intacts ; aucune migration sur le VPS.
- AppModule en production et apps Expo inchangés ; aucun endpoint wallet activé, aucun store ou build.
- Stripe TEST officiel et Stripe LIVE intacts ; données, policy EUR, montants et événements restent **synthétiques**.
- Objectif suivant : autorité d'identité réellement vérifiée de bout en bout et capable de révoquer avant lecture et avant paiement, avec séparation effective des credentials de l'attestor.
