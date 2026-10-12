# DelishAfrica — Commerce Client : idempotence SQL et autorité de paiement TEST

**12 octobre 2026 — LABORATOIRE SQL UNIQUEMENT / PAS DE DÉPLOIEMENT**

## Preuve nouvelle

GitHub Actions [#38277233376](https://github.com/adminluxe/DelishAfrica/actions/runs/38277233376) : **SUCCESS**, commit `1ca311e661d72544c0c3bc61f933ddad33cf6e52` au moment de l’exécution.

- Vrai PostgreSQL **17** éphémère, conteneur Docker `--network none`, aucun port publié et identités entièrement fictives.
- Fichier SQL **complet** : `services/api-nest/migrations/client-commerce/20261012_001_client_commerce_authority_qa_only.sql`.
- Batterie d’assertions complète : `services/api-nest/test/native-client-commerce-authority.qa.sql`.
- Workflow exact : `.github/workflows/native-client-commerce-authority-postgres-qa.yml`.
- Les tables et fonctions créées portent le suffixe `_qa`, **aucune table réelle de production n’a été modifiée**.

## Résultats vérifiés

**15 contrôles SQL adversariaux PASS** : réservation rejouée avec mêmes preuves → même `order_id`, changement d’empreinte devis ou de montant sur le même identifiant de mutation → rejet, isolement par émetteur OIDC + sujet Client, insertion directe d’une commande `paid` refusée, paiement d’un montant ne correspondant pas exactement à sa commande → rejet par clé étrangère composite, passage `paid` impossible sans autorité Stripe déclarée vérifiée, transition `reserved → succeeded` sans création d’intention préalable refusée, chaîne de transition dans l’ordre testée positivement, montant d’une commande payée immuable, état payé monotone, PaymentIntent déjà associé immuable, clé d’idempotence fournisseur unique, PaymentIntent unique entre clients et reçu d’événement fournisseur non rejouable sur une autre commande.

**Concurrence réelle multi-session** : huit connexions PostgreSQL lancées simultanément avec `issuer + subject + clientMutationId` et données financières identiques → **8 retours du même UUID, 1 ligne en base**. Un appel ultérieur avec la même clé mais un montant différent a échoué, comme attendu. Marqueurs CI : `QA_COMMERCE_8_CONCURRENT_RETRIES=ONE_ORDER`, `QA_COMMERCE_MUTATED_REPLAY=REJECTED`, `QA_COMMERCE_PG=PASS_REAL_PG_AND_8_WAY_CONCURRENCY`.

**Absence d’effets live** : `STRIPE_PROVIDER_CALLS=ZERO`, `PRODUCTION_IMPACT=NONE`, conteneur PG de QA supprimé après exécution. Les tests séquentiels font `ROLLBACK` de toutes leurs lignes, puis l’essai concurrent utilise uniquement la base jetable.

## Risques restant NON certifiés

1. **État `provider_verified` ≠ preuve bancaire** : le booléen et l’empreinte HMAC ne peuvent être écrits que par un composant backend de confiance ayant effectivement vérifié la signature webhook et/ou l’état du PaymentIntent Stripe par API. Le schéma ne fournit pas ces vérifications. Aucune clé Stripe ni client_secret n’y est enregistrée. Les rôles/permissions PostgreSQL et les RLS appropriées restent à définir et tester.
2. Le code applicatif existant utilise encore `orders.demo.store.ts` et `.runtime/payment-authority-store.json`. Les deux nouvelles tables et la fonction de réservation sont **NON raccordées** aux véritables services `OrdersAccessService` / `PaymentsService`.
3. **Aucun Stripe TEST réel** : pas de PaymentIntent auprès de Stripe, pas de webhook, capture, refund, dispute ou non-rejeu d’événement fournisseur reçu sur un réseau externe. Un même événement synthétique unique en DB est une preuve d’unicité SQL, pas une preuve Stripe.
4. Résistance aux erreurs de réseau, réconciliation d’une création Stripe réussie dont la confirmation en DB échoue, crash/restart, verrous pendant le webhook, deadlocks, expiration et délais de compensation à certifier.
5. Les gardes des véritables contrôleurs `orders/create` et `payments/create-intent` ont été exercés avec l’ancien auth stub et l’admission native ajoutée uniquement en QA ; cela ne prouve pas un pipeline d’auth multi-realm actif en production.
6. Séparation Merchant/Courier/Ops historiques, vraie preuve SMS fournisseur, chemins Android/iOS, Stripe TEST commerce complet et revue G0–G7 toujours en **NO-GO**.

## Prochain ordre de mission

Intégrer, dans un staging isolé sur branche DRAFT, un **repository PostgreSQL transactionnel** alimenté par le devis canonique serveur, la même identité JWT `issuer/sub`, et un `clientMutationId` borné. Vérifier le verrou des changements de montant et la réservation multi-serveur avant tout appel Stripe TEST. Créer un mécanisme de réconciliation sécurisé si Stripe a réussi mais l’écriture DB a échoué ; ne jamais lancer une seconde intention de paiement avec une nouvelle idempotency key pour « réparer » cet état. Mettre les preuves de paiement et l’acknowledgement des commandes sous idempotence DB et vérification des événements provider.

**Go limité au laboratoire PostgreSQL. Aucune migration VPS / commande live / Stripe LIVE / soumission Store.**

Lien de dossier connexe : [certification des vrais contrôleurs NestJS avec services simulés](DA_NATIVE_CLIENT_REALM_COMMERCE_GATE_2026-10-12.md).

## Jalon suivant — JWT Keycloak réel → identité NestJS validée → réservation PostgreSQL réelle

**12 octobre 2026 — commit commun `40f02219caa8685eeb542679a7e1b463274de455`, quatre workflows SUCCESS** :
- [CI Keycloak HTTPS 26.4.7 + JWT réel → guard NestJS réel → admission dans PostgreSQL 17 → commande et autorité Stripe TEST réservées en SQL #38279255476](https://github.com/adminluxe/DelishAfrica/actions/runs/38279255476) **SUCCESS**.
- [CI commande/paiement, vrai adaptateur TypeScript sur deux pools PostgreSQL avec 8 réservations concurrentes #38279255211](https://github.com/adminluxe/DelishAfrica/actions/runs/38279255211) **SUCCESS**.
- [CI contrôles TypeScript des trois applications/API et contrôleur NestJS isolé #38279255286](https://github.com/adminluxe/DelishAfrica/actions/runs/38279255286) **SUCCESS**.
- [CI admission PostgreSQL et anti-rejeu SMS #38279255179](https://github.com/adminluxe/DelishAfrica/actions/runs/38279255179) **SUCCESS**.

**Nouveaux candidats complets** :
- `services/api-nest/src/client-commerce/client-commerce.pg-qa.adapter.ts` : deux opérations, `reserveOrder(verifiedClient, serverQuote, mutationId)` et `reserveTestPayment(verifiedClient, orderId)`. Les requêtes sont paramétrées, l’identité et le devis ont des formes bornées, la transaction `BEGIN → SELECT FOR UPDATE → INSERT ON CONFLICT → COMMIT` réserve une autorité de paiement unique, et la clé Stripe TEST est dérivée par HMAC secret côté serveur à partir d’issuer + sujet + UUID de commande. **Aucun appel Stripe**.
- `services/api-nest/src/auth/native-client-nest-commerce.guard.ts` : le garde vérifie signature RSA, issuer/JWKS, revendications du Client et admission réelle e-mail/SMS. **Seulement après succès**, il place une identité limitée `issuer/subject/role:client/authSource:external/ownershipEligible:true` dans une propriété **Symbol privée de la requête HTTP** ; cette propriété est effacée dès le début de chaque contrôle, et ne peut pas être fournie par JSON/headers HTTP.
- `services/api-nest/test/client-commerce.pg-qa.integration.cjs` : vrais modules TypeScript transpilés en CI éphémère, deux `PgPool` ; **8 réservations commande en parallèle → un ordre unique**, puis **8 réservations paiement → un authorityId et une clé fournisseur uniques** ; client étranger interdit, tentatives de changement montant rejetées au niveau SQL, identités/devis invalides avant toute écriture. Tous les essais sans Stripe.
- `services/api-nest/test/native-client-full-stack.qa.cjs` : une route `POST /qa/native/reserve` est créée **uniquement dans un contrôleur NestJS de test**, jamais dans `OrdersController` ou `PaymentsController`. Le JWT réel provenant de l’inscription Client Keycloak (e-mail vérifié, OAuth PKCE S256) est soumis à ce garde, qui lit l’admission PostgreSQL réelle ; le handler extrait **uniquement** l’identité `Symbol` émise après autorisation. Le devis est construit depuis **un fixture canonique serveur** (`EUR 1200` centimes), et le corps HTTP ne fournit que l’ID de mutation.

**Constats visibles dans les logs de CI #38279255476** :
- `QA_PASS=nestjs_pg_commerce_no_token_no_order_http_401`
- `QA_PASS=nestjs_pg_commerce_tampered_token_no_order_http_401`
- `QA_PASS=nestjs_pg_commerce_unapproved_sms_no_order_http_403`
- `QA_PASS=nestjs_pg_commerce_denied_requests_zero_db_orders`
- `QA_PASS=actual_keycloak_verified_identity_sql_commerce_idempotency_same_provider_key`
- `QA_PASS=request_body_cannot_spoof_signed_identity_price_or_stripe_mode`
- `QA_PASS=same_real_keycloak_subject_exactly_one_postgresql_order_and_payment_authority`
- `QA_NATIVE_KEYCLOAK_NEST_PG_COMMERCE=PASS_SIGNED_CLIENT_JWT_GUARD_SYMBOL_SQL_ORDER_AND_ONE_STRIPE_TEST_RESERVATION`
- `QA_PASS=nestjs_revoked_client_does_not_create_any_new_orders`
- `QA_NATIVE_CLIENT_FULL_STACK=PASS_SYNTHETIC_ONLY`, `PRODUCTION_IMPACT=NONE`, `QA_EPHEMERAL_RESOURCES_DESTROYED=YES`.

**PERIMÈTRE** : vrai Keycloak, vraie signature JWT, vrais NestJS et PostgreSQL, mais **realm Client et certificat HTTPS purement CI éphémères**, e-mail et SMS **fictifs**, serveur de réservation QA uniquement, **devis fixture** et non véritable catalogue vivant, **aucune création de PaymentIntent Stripe TEST chez Stripe**, aucune preuve webhook de paiement, aucune commande commerciale livrée. La simple valeur `provider_verified` en DB n’est pas une preuve financière et doit être réservée à un backend PSP à privilèges SQL strictement limités. Aucun contrôleur de production n’a été modifié, aucun VPS, migration, LIVE ni Store touché.

**Prochain GO conditionnel** : implémenter et certifier des adaptateurs réels de **catalogue serveur et de preuve Stripe TEST authentique**, définir séparation multi-realm dans les vrais vieux `OrdersAuthGuard/PaymentsAuthGuard` et la migration de stockage fichier vers transaction PG, puis tester idempotence des webhooks, absence de double PaymentIntent et compensation/reconciliation d’un timeout Stripe → BD. Les trois apps Expo ne doivent être rebuild pour sortie qu’après CI sur le code exact, device QA propriétaire et autorisation G0–G7.
