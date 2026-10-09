# DELISHAFRICA — ROADBOOK PALIER 2 : LEDGER INVITÉ POSTGRESQL
Date : 9 octobre 2026. État : CODÉ EN BRANCHE, JAMAIS APPLIQUÉ À LA BASE RÉELLE.
Branche : feature/client-guest-checkout-secure-20261009.
Socle : commit palier 1 4f596894e929b7d5cabc2014ffbedc1ac3bad351.

## Résultat de la réconciliation
- Le dépôt actif /opt/delishafrica/monorepo contient un module financier PostgreSQL fonctionnel en code et des modifications locales non committées sur Orders.
- Une copie de travail de la partie « financial-state » a été scellée SANS toucher au dépôt actif :
  /home/afripayadmin/guest-checkout-evidence-20261009/finance-snapshot-current-20261009
- Checksums SHA256 de preuve :
  - financial-state.repository.ts : 0088e1689f81581b0d5b8c0351a6ec21c3debb7f79bd9d3f2f48acd363b49418
  - financial-state.module.ts : 969ae2bc71cdb26cafcb5b913bc6741b16b3709401b429f8d7388e716e15cdf8
- Le code guest stage 2 adopte une interface SQL compatible avec le style financier, sans importer directement ces fichiers financiers tant que leur historique n'est pas scellé.
- Aucune donnée de base, connection string, compte testeur ni secret Stripe n'a été lu/modifié.

## Nouveaux fichiers complets
1. migrations/20261009_guest_checkout_ledger.sql
   - Table additive da_guest_checkout_sessions, non migrée.
   - Unicité sur order_id, guest_subject, mutation_id, capability_sha256 et payment_intent_id.
   - Etats énumérés, montants et identifiants contraints, expiration, index des sessions actives.
   - Aucune donnée personnelle ni jeton brut ni secret Stripe.
2. services/api-nest/src/guest-checkout/guest-checkout-ledger.ts
   - Adaptateur PostgreSQL injectable via interface SQL.
   - issue() n'émet le jeton qu'APRÈS insertion persistée.
   - findForCapability() vérifie HMAC et empreinte SHA256 avant toute lecture d'une commande.
   - attachVerifiedQuote() transition atomique ISSUED -> QUOTED, retry identique idempotent, modification rejetée.
   - bindTrustedPaymentIntent() transition atomique QUOTED -> PAYMENT_PENDING, idem, un seul PaymentIntent par ordre.
   - Montant et prix fournis par un service de catalogue de confiance (pas par le téléphone).
   - AUCUNE route HTTP ne donne accès à cet adaptateur à ce stade.
3. services/api-nest/test/guest-checkout-ledger.test.cjs
   - 5 tests sur simulation SQL, vérification de non divulgation, isolation, idempotence, conflits, pannes et migration.
4. scripts/da_guest_checkout_stage2_gate.sh
   - Gate palier 1 + 5 tests P2 + contrôle absence exposition du Ledger sur API + présence migration.

## Validation technique
- Palier 1 : 7 tests unitaires, typechecks Client et Nest, et guards conservés.
- Palier 2 : 5 tests supplémentaires basés sur un adaptateur SQL simulé, PASS.
- TypeScript API après P2 : PASS.
- Le gate stage2 vérifie l'ensemble, pour un total attendu 12/12.
- Les tests simulés NE PROUVENT PAS l'intégration réelle Postgres : une vraie DB isolée de préproduction est nécessaire avant P3.

## Points interdits avant la prochaine étape
- NE PAS appliquer la migration SQL sur la base de production avant revue et backup.
- NE PAS exposer les endpoints Checkout guest ni changer OrdersAuthGuard/PaymentsAuthGuard.
- NE PAS déclencher Stripe depuis l'app Client avec un montant envoyé par le téléphone.
- NE PAS penser que la seule transition PAYMENT_PENDING signifie débit confirmé, ou commande créée.
- NE PAS merger les modules financiers non committés du dépôt actif à l'aveugle.
- NE PAS relancer de build Store ou OTA pour cette étape.

## Travaux P3 bloquants
- Brancher CatalogOrderPolicyService pour obtenir l'objet TrustedQuote côté serveur, avec stock produit/horaires/territoire.
- Utiliser la clé de mutation liée à la session invitée comme clef d'idempotence Stripe ; gérer l'Intent orphelin en cas de panne.
- Implémenter un consommateur de webhook Stripe fiable, idempotent, vérifié en lecture depuis Stripe, et une TRANSACTION PostgreSQL unique ordre+paiement+outbox.
- Assurer la reprise si app fermée, doublon webhook, remboursement, dispute, livraison et suivi.
- Introduire des capacités de suivi indépendantes expirant de façon appropriée, preuve d'accès et effacement RGPD.
- Mettre en place rate limit multi-instance, anti-spam et observabilité sans fuite PII.
- Tests d'intégration sous vraie PostgreSQL isolée, avec simulation Stripe uniquement ; aucune vraie transaction de test requise.

## État de sortie
Palier 2 = stockage et transitions transactionnelles de préparation CODÉS et simulés. Pas encore utilisés par un client.
Livraison Guest Checkout final = NON. Relecture manuelle et gate P3 obligatoires.
