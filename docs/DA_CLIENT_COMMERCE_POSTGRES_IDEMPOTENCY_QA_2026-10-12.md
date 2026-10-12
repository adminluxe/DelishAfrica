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
