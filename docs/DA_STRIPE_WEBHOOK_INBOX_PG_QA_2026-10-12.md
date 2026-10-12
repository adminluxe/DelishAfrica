# DelishAfrica — Réception Stripe TEST durable, signée et non rejouable (QA)

**Date : 12 octobre 2026 — commit certifié `640df62bc9ed6bdfbf3de593b08e99b6faae72b4` — PR #35 DRAFT**

## Preuves d’exécution indépendantes

Quatre workflows `SUCCESS` sur le **même commit** :

- [Commerce PostgreSQL 17 / réception webhook signée / concurrence 8-way #38287236021](https://github.com/adminluxe/DelishAfrica/actions/runs/38287236021)
- [Vrai Keycloak RSA + NestJS + admission Client + PostgreSQL #38287235999](https://github.com/adminluxe/DelishAfrica/actions/runs/38287235999)
- [Client Enrollment API + trois applications #38287236078](https://github.com/adminluxe/DelishAfrica/actions/runs/38287236078)
- [Registre de preuves e-mail/SMS PostgreSQL #38287236009](https://github.com/adminluxe/DelishAfrica/actions/runs/38287236009)

**Nouveaux fichiers complets du laboratoire** :

- `services/api-nest/migrations/client-commerce/20261012_003_stripe_test_webhook_inbox_qa_only.sql`
- `services/api-nest/src/client-commerce/stripe-test-webhook-inbox.pg-qa.adapter.ts`
- `services/api-nest/test/stripe-test-webhook-inbox.pg-qa.integration.cjs`
- `.github/workflows/native-client-commerce-authority-postgres-qa.yml` (révisé, contient le test).

Les nouvelles tables, fonctions et rôles existent **uniquement dans un PostgreSQL 17 Docker jetable avec `--network none`**, sans ports publiés. Les secrêts webhook fictifs sont générés en CI et ne sont pas consignés dans les logs. Aucune API Stripe, aucun serveur de production, aucun client réel, aucune carte ou paiement n'est utilisé.

## Chaîne de confiance effectivement testée

`rawBody` et `Stripe-Signature` → HMAC SHA-256 sur les **octets bruts** du body avec secret de QA côté serveur → signature vérifiée en temps constant + tolérance temporelle → JSON strict (événement Stripe TEST / objet `payment_intent` TEST) → empreinte SHA-256 du body → connexion PostgreSQL sous le rôle **`da_qa_webhook_inbox_receiver` sans droits DML ni SELECT direct** → fonction SQL limitée `da_qa_record_signed_test_webhook(...)` → vérification d'une réservation de PaymentIntent préexistante (`state=intent_created`) → insertion atomique dans `da_stripe_test_webhook_inbox_qa` avec `PRIMARY KEY (stripe_event_id)`.

La fonction se contente d'enregistrer le **fait qu'un événement signé a été reçu**, la référence financière correspondante, son type et un hash non réversible du body. Elle n'enregistre aucun body brut, secret, PAN, token ou adresse personnelle ; elle ne modifie **ni `provider_verified`, ni `succeeded`, ni `paid`**. Les triggers empêchent UPDATE/DELETE, le rôle de réception ne peut pas lire directement les tables ni réclamer les droits des autres rôles.

## Résultats adversariaux lus dans les journaux

- `QA_STRIPE_INBOX_8_WAY_2_POOLS=ONE_DURABLE_RECEIPT` : huit réceptions sur deux instances du même adaptateur, **un seul reçu SQL**, une requête initiale et sept doublons.
- `QA_STRIPE_INBOX_REDELIVERY=IDEMPOTENT` : redelivery reconnue sans seconde mutation.
- `QA_STRIPE_INBOX_EVENT_ID_HASH_AND_AUTHORITY_COLLISIONS=REJECTED` : même `event_id` avec empreinte modifiée ou PaymentIntent étranger → refus, aucune ligne additionnelle.
- `QA_STRIPE_INBOX_HMAC_WRONG_EXPIRED_FUTURE_DUP_TIMESTAMP=REJECTED` : mauvaise signature, timestamp ancien/futur ou ambigu → refus avant SQL.
- `QA_STRIPE_INBOX_UNTRUSTED_SHAPE_MODE_PI_JSON_SIZE=REJECTED` : mauvais type, LIVE, JSON erroné, intention inconnue, taille excessive → refus.
- `QA_STRIPE_INBOX_SIGNED_EVENT_NEVER_MARKS_PAID=PASS` : malgré un succès Stripe **synthétique signé**, l'ordre reste `pending_payment`, l'autorité `intent_created`, `provider_verified=false`.
- `QA_STRIPE_INBOX_APP_PSP_RECEIVER=NO_DIRECT_FINANCIAL_DML` : client app, futur récepteur PSP non vérifié et rôle webhook → refus PostgreSQL lors d'une tentative d'UPDATE `paid/succeeded`. La fonction d'enregistrement n'est pas exécutable par le rôle app.
- `QA_STRIPE_INBOX_NETWORK_STRIPE_CALLS=ZERO` et `QA_STRIPE_INBOX_PRODUCTION_ROUTES=NOT_WIRED`.

## Menaces et exclusions (NO-GO maintenu)

**Un événement Stripe signé n'est PAS une preuve de capture financière**. Il peut arriver plusieurs fois, être délivré en retard ou coexister avec un refund/dispute. La validation financière future nécessite au minimum la consultation officielle de Stripe TEST (ou un mécanisme équivalent confirmé), la vérification des montants, devises, comptes, commandes, charges, refunds, litiges et la concordance avec l'autorité PostgreSQL, avec un rôle financier distinct minimisant les écritures et une transaction atomique.

**Le flux candidat ne traite pas encore** la notification réelle du compte Stripe, les secrets officiels, les retries provider et pannes HTTP/SQL, les cas de charge remboursée après paiement, la réconciliation après crash, les files dead-letter, l'observabilité PII-safe ni les tests sur appareils réels. Le chemin de production `POST /stripe/webhook` utilise toujours `PaymentsService.handleStripeWebhook` et son stockage fichier local (limite de 30 IDs par autorité). **Le candidat n'est pas branché aux routes live** et ne démontre aucune sécurité de production.

**Attention aux rôles CI** : PostgreSQL `trust` et propriétaire de fonction superuser existent uniquement dans le conteneur isolé. Pour staging/prod, exiger TLS, propriétaire NOLOGIN non-superuser, schéma sans CREATE public, séparation stricte de rôles, durcissement `SECURITY DEFINER`, sauvegardes, quotas et revue d'accès.

**Décision** : **PASS du registre webhook synthétique signé et durable en QA**, mais **NO-GO Stripe TEST externe, Stripe LIVE, migration du VPS, fusion PR, builds iOS/Android et Stores**. Prochaine étape : vraie création PaymentIntent TEST + webhook signé reçu du fournisseur, processing sûr et réconciliation transactionnelle ; puis workflow réel Client → Merchant → Courier, QA devices et G0–G7.
