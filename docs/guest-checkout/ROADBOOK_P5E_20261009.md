# DELISHAFRICA — ROADBOOK P5-E / RECONCILIATION FINANCIÈRE OPS

**Date :** 09 octobre 2026, Bruxelles.
**Statut :** LABORATOIRE ISOLÉ • GUEST CHECKOUT PUBLIC NON ACTIVÉ.
**Branche :** `feature/client-guest-p5e-ops-reconciler-20261009`
**Worktree VPS :** `/home/afripayadmin/worktrees/guest-p5e-ops-reconciler-20261009`
**Parent :** `88a0fd5` — P5-D, 82/82 tests.

## Objectif

Éviter de perdre une intention Stripe dans les états `creating`, `review_required` ou `bound/payment_pending`, sans générer un deuxième débit ni exposer de données client. Permettre au système de repérer et classer durablement les incidents, puis de clôturer automatiquement **une preuve de capture seulement via le finaliseur financier P3**.

P5-E n'est PAS un routeur d'argent, un nouveau PSP, une console de remboursement ni une route HTTP. La livraison demeure interdite sans ordre métier distinct, dispatch autorisé et validation financière.

## Livrables complets

| Fichier | Fonction |
| --- | --- |
| `services/api-nest/src/guest-checkout/guest-payment-reconciliation-monitor.ts` | Scanner de candidats, verrouillage `SKIP LOCKED`, baux de worker, lecture Stripe sans mutation, classification, reprise après crash et éventuelle délégation P3 |
| `services/api-nest/src/guest-checkout/guest-stripe-http-test-transport.ts` | Adaptateur REST Stripe restreint aux clés `sk_test_` / `rk_test_`, `createIntent` / `getIntent` / `cancelIntent`, idempotence et timeout |
| `migrations/20261009_guest_payment_reconciliation_alerts.sql` | Table PostgreSQL sans PII d'alertes Ops avec contrôle de priorité, décisions, claim et prochain scan |
| `services/api-nest/test/guest-payment-reconciliation.postgres.test.cjs` | 19 tests réels PostgreSQL, lecteur Stripe simulé, finaliseur P3 réel contre charge Stripe simulée |
| `services/api-nest/test/guest-stripe-http-test-transport.test.cjs` | 11 tests du contrat HTTP, fournisseur HTTP simulé, aucune requête Internet |
| `scripts/da_guest_checkout_p5e_gate.sh` | Gate cumulatif P1-P5E, TypeScript API et trois apps, guards et isolation |

Les scripts et tests préexistants sont repris **en entier** ; seules les adresses du PostgreSQL de laboratoire passent de `55440` à `55441`.

## Pipeline du moniteur

1. Une exécution explicite `scanOnce(batchLimit)` vérifie l'environnement `NODE_ENV != production`, `DA_GUEST_STRIPE_TEST_ONLY=1`.
2. Il réclame jusqu'à 20 dossiers admissibles par PostgreSQL `FOR UPDATE SKIP LOCKED` et baux de 120 secondes. Pas de HTTP dans cette transaction.
3. Il ne consulte que les identifiants Stripe déjà connus et correctement formés. En l'absence d'ID, une alerte Ops est créée sans « deviner » l'intention.
4. Il compare **serveur et fournisseur** : Intent ID, montant, devise, mode test, orderId, clientSubject, mutationId, quoteFingerprint, issuer et source.
5. Une panne réseau mène à un retry contrôlé ; des échecs répétés créent une alerte prioritaire. Une preuve incohérente ou une intention capturée sans liaison autorisée déclenche une revue Ops.
6. Si Stripe dit `succeeded` et la réservation est `bound`, le finaliseur P3 facultatif relit et vérifie **indépendamment** le paiement et la capture, puis écrit atomiquement finance + outbox. Sans P3, l'incident reste critique ; aucune livraison.
7. L'état `financially_committed` de l'alerte n'est accepté que si le ledger est `committed` ET si le registre P3 contient le même Intent ET que son outbox financier existe.
8. Si le worker s'interrompt juste après COMMIT P3, le prochain scan récupère l'alerte abandonnée, confirme le record financier et évite un deuxième enregistrement.
9. Les décisions enregistrées sont `investigating`, `retry_scheduled`, `operator_action_required`, `verified_cancelled`, `financially_committed`.
10. Aucune donnée nom/prénom, téléphone, email, adresse, carte, secret ou `clientSecret` n'est écrite dans les alertes ou les raisons.

## Adaptateur Stripe

Le transport Stripe HTTP accepte exclusivement les clés de **test** (y compris les clés restreintes `rk_test_`), un domaine fixe `https://api.stripe.com`, des identifiants validés et un délai borné. Les clés live sont refusées. Les cartes ne sont pas saisies ni transmises par notre backend : Stripe doit recevoir le moyen de paiement dans le SDK officiel mobile côté Client.

**Historique du gate initial :** les 11 tests contractuels HTTP demeurent simulés. Aucune clé n'était présente dans le shell de laboratoire : les accès TEST existants sont conservés dans les fichiers serveur protégés. **Mise à jour 09/10/2026 :** une sonde indépendante a validé CREATE, GET, replay idempotent et CANCEL auprès des véritables serveurs Stripe TEST, sans carte, confirmation ni fonds encaissés. Voir l'addendum et le rapport fournisseur ci-dessous.

## Preuves

- PostgreSQL 16 indépendant sur `127.0.0.1:55441` ; pas de migration ni d'accès à la production.
- Base P5-D : 82 tests.
- P5-E Ops scanner : 19 tests.
- P5-E HTTP Stripe Test : 11 tests.
- **Total attendu du gate final : 112/112**, à consigner après exécution.
- TypeScript API, Client, Merchant, Courier : à confirmer dans le gate.
- Aucun endpoint public Guest, aucun scheduler permanent, aucun build EAS / OTA / Store.

## Limitations à ne pas minimiser

- Aucun vrai Stripe TEST HTTP exécuté ; il faudra le réaliser avec une clé de test créée/validée dans un coffre de secrets, sans jamais l'imprimer dans un terminal, une conversation ou un log.
- Le scheduler est **délibérément non branché** et aucune notification externe Ops n'est envoyée : seuls le moteur et la table durable sont disponibles. Le workflow Ops RBAC, son journal et ses alertes doivent être implémentés avant production.
- Un cas `review_required` sans Intent connu n'est pas automatiquement annulé. Seules des preuves Stripe indépendantes + une procédure d'Ops peuvent le résoudre.
- Une commande déjà payée ou disputée ne doit jamais être relâchée au livreur par ce scanner : P3 écrit un outbox financier, pas une commande métier.
- Après remise de `clientSecret`, révocation Merchant/Ops, refund, dispute ou chargeback doivent être pris en compte par webhook/worker dédié avec des compensations vérifiables ; P5-E ne remplace pas ce flux.
- Les vrais restaurants doivent approuver leurs zones ; Ops doit approuver séparément sous un rôle autorisé, avec révocation et audit.
- Projet prioritaire ensuite : Stripe TEST réel contrôlé, notifications Ops sécurisées, P5-F commandes Merchant/Courier, puis UX Client sans Keycloak obligatoire.

**Conclusion :** un moniteur financier testable et un adaptateur HTTP Stripe test sont livrés en branche de laboratoire ; le parcours de paiement Guest en production reste NON OUVERT.

## 2026-10-09 — Fournisseur Stripe TEST : validation extérieure
La suite P1-P5-E reste validée en laboratoire (112/112 tests simulés).
Une sonde indépendante sur le VPS a authentifié le compte Stripe TEST,
créé une intention non confirmée de 0,50 EUR, rejoué la même demande
avec la même clé d'idempotence et obtenu le même identifiant, relu puis
annulé cette intention et relu le statut final canceled.
Aucun moyen de paiement, aucune capture, aucun débit LIVE.
Journal protégé : un seul état cancelled, permissions 0600.
La paire des clés publiques/privées reste à confirmer côté compte.
Preuve : docs/guest-checkout/ROADBOOK_P5E_STRIPE_REAL_PROVIDER_PASS_20261009.md.
Le checkout invité public demeure NON activé.
