# DELISHAFRICA — ARCHITECTURE PIN P5-E / OPS FINANCIAL RECONCILIATION

**Date :** 09 octobre 2026
**Statut :** LABORATOIRE, SANS DÉPLOIEMENT.
**Branche :** `feature/client-guest-p5e-ops-reconciler-20261009`
**Worktree VPS :** `/home/afripayadmin/worktrees/guest-p5e-ops-reconciler-20261009`

## Chaîne de confiance canonique

```text
CLIENT (Panier + Mon espace, aucun montant autoritaire)
  |
  -> Catalogue backend + vrai devis immuable P2
  -> Google Places relu côté serveur (adresse vérifiée)
  -> Couverture Merchant + approbation Ops indépendante P5-B
  -> Coffre AES-256-GCM P4 avec contact et preuve d'adresse
  -> Réservation Stripe Test P5-C / compensation P5-D
         |
         | State: CREATING / BOUND / REVIEW_REQUIRED / CANCELLED
         |
         +--> P5-E GuestPaymentReconciliationMonitor [LAB, sans ordonnance]
                |
                +--> PostgreSQL 55441, SELECT ... SKIP LOCKED
                |    claim 120 secondes, reprise après crash
                |
                +--> Stripe READ ONLY getIntent(id) [MOCK pendant tests]
                |    id + amount + currency + livemode=false
                |    + orderId + clientSubject + mutationId
                |    + quoteFingerprint + issuer + source
                |
                +--> DÉCISION DURABLE en alertes Ops (sans PII)
                |    investigating
                |    retry_scheduled
                |    operator_action_required
                |    verified_cancelled
                |    financially_committed
                |
                +--> Si PAIEMENT CAPTURÉ ET LIÉ:
                      GuestStripeFinancialFinalizer P3
                        - récupère la preuve Stripe indépendamment
                        - vérifie capture et charge
                        - transaction SQL: VERIFIED_PAYMENT + FINANCIAL_OUTBOX
                        - statut de commande COMMITTED
                        - NE DÉCLENCHE AUCUN DISPATCH LIVREUR
                        |
                        +--> P5-E confirme alert = financially_committed
                        +--> redémarrage sûr même après crash post-P3

P5-F À CONSTRUIRE: notification Ops réelle, livraison métier Merchant/Courier,
 suivi Guest Client sans Keycloak obligatoire, remboursements/chargebacks.
```

## Cloisonnement et sûreté

- P5-E est un **scanner interne invoqué explicitement** ; il n'ajoute aucun endpoint Nest public, ne possède aucun timer en production et aucune connexion à Stripe Live.
- Il ne crée, confirme, annule ou rembourse jamais un PaymentIntent. Seul P5-D possède la compensation contrôlée ; P5-E n'effectue que `getIntent`.
- Lorsqu'une preuve distante annonce un paiement capturé, P5-E exige qu'il soit **lié au ledger** avant d'invoquer P3. P3 fait sa propre vérification financière indépendante et atomique.
- Alertes Ops : `da_guest_payment_reconciliation_alerts` sur PostgreSQL, ordre, Intent ID, décision, raison codée, priorité, échéance et jeton de claim. AUCUNE adresse, numéro, nom, carte, client secret ou corps d'erreur réseau.
- Concurrence : `FOR UPDATE SKIP LOCKED`, claims temporaires, réinspection de la source sous verrou avant d'enregistrer une décision.
- Une preuve financière déjà validée permet de fermer une alerte orpheline **sans créer de deuxième paiement ni revalider P3 deux fois**.
- `GuestStripeHttpTestTransport` : domaine Stripe fixe, clés `sk_test_` / `rk_test_` uniquement, méthodes limitées à CREATE, GET et CANCEL, idempotence stable et timeout, jamais de clé Live.
- Le montant ne provient pas du téléphone. Aucune donnée de carte transmise par notre backend ; le futur Client devra utiliser le SDK officiel Stripe.
- `DA_GUEST_STRIPE_TEST_ONLY=1` et `NODE_ENV != production` conditionnent tout ce laboratoire ; même en mode test, aucun endpoint public n'est exposé.

## Ce que 111 tests démontrent

12 P1/P2 ; 6 P3 ; 13 P4 ; 8 P5-A ; 13 P5-B ; 30 P5-C/D ; 19 P5-E Ops ; 11 P5-E HTTP Test.

**112/112 tests PASS** avec PostgreSQL réel isolé `127.0.0.1:55441`, faux fournisseur Stripe/HTTP et Google Places simulés. TypeScript API + trois apps Client, Merchant, Courier PASS.

Gate : `scripts/da_guest_checkout_p5e_gate.sh`
Log : `/tmp/da_guest_p5e_full_gate_20261009.log`
Roadbook : `docs/guest-checkout/ROADBOOK_P5E_20261009.md`

## Ce qui reste NON autorisé

- Aucune clé Stripe TEST réellement utilisée contre `api.stripe.com`; connexion externe PSP à qualifier.
- Pas de worker permanent, d'alerte externe Ops, ni de workflow de traitement humain RBAC et audité.
- Pas de détachement des protections Keycloak des commandes professionnelles.
- Pas de commande commerçant/livreur créée depuis l'outbox P3, pas de remboursement ni notification post-paiement.
- Pas de migration SQL production, merge dans le monorepo actif, rebuild EAS, OTA ou publication Store.
- Le Guest Checkout Client n'est PAS encore fonctionnel pour les utilisateurs distribués.

**Conclusion : P5-E donne une fondation Ops/financière robuste en laboratoire ; la prochaine vraie verticale devra relier Stripe Test, la console Ops, le ledger commande et les trois applications.**
