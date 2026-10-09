# DELISHAFRICA — ROADBOOK P5-C / STRIPE INVITÉ + OPS GÉOGRAPHIQUE

**Date :** 09 octobre 2026 — **Statut :** VALIDÉ EN LABORATOIRE, JAMAIS DÉPLOYÉ.
**Branche :** `feature/client-guest-p5c-ops-integrated-20261009`
**Worktree isolé VPS :** `/home/afripayadmin/worktrees/guest-p5c-ops-integrated-20261009`
**Origine :** branche P5-B sécurisée `2f539c6` (appartenant à notre branche `feature/client-guest-coverage-strict-20261009`).

## 1. Mission livrée en laboratoire

Intégrer un prototype P5-C de réservation d'intention Stripe avec **l'approbation indépendante Ops** de P5-B, sans exposer de paiement invité à la production.

Les trois fichiers initiaux P5-C (`guest-stripe-intent-reservation.ts`, `guest-stripe-intent.postgres.test.cjs`, `20261009_guest_intent_creation_reservations.sql`) ont été **copiés depuis le worktree parallèle** `/home/afripayadmin/worktrees/guest-checkout-p5c-20261009`, sans le modifier. Empreintes de cette copie, avant corrections :
- Stripe service : `9a9c574879584dd6649c693f44f691f42c6d1985f4ca596a3382b5467b429123`
- Test d'intégration : `473f89d27df2caa4a2ce22a9bf05948510d34c24466c9c2dfa173b9ce87b4d15`
- Migration : `09f64618089153e26d319d116390d15af39bd9dcb8741d37ca7e4b63c59a69ba`

## 2. Modifications sécurisées

- `guest-canonical-checkout-stager.ts` : conserve dans le dossier P4 chiffré la preuve Google côté serveur (placeId, BE, code postal, coordonnées, origine `google_places_new`) en plus du devis et du périmètre autorisé.
- `guest-private-fulfillment-vault.ts` : valide cette preuve avant AES-256-GCM; ajoute une lecture **interne à périmètre limité**, protégée simultanément par HMAC, hash du jeton conservé en base, identité de commande et intégrité AEAD.
- `guest-stripe-intent-reservation.ts` : exige un `GuestMerchantCoverageStrict` (source de vérité Merchant publiée et registre Ops PostgreSQL indépendant) :
  1. à l'entrée, avant de réserver un slot ;
  2. immédiatement avant l'appel `createIntent` Stripe ;
  3. après réception de la réponse Stripe, avant tout COMMIT et toute remise de `clientSecret`.
- Si la couverture est révoquée/expirée, si sa révision change, si sa géographie ne correspond plus, ou si l'Ops Registry est indisponible : **aucun nouvel Intent ne doit être créé avant la vérification** et aucun secret n'est rendu dans le scénario de révocation pendant un appel.
- Si la réponse Stripe est perdue après création, le numéro d'ordre reste associé à **une seule clé d'idempotence stable**, réservée dans PostgreSQL avant tout appel réseau ; une reprise réutilise cette clé.

## 3. Preuves techniques

Tous les tests sont exécutés sur un **PostgreSQL 16 dédié** :
`127.0.0.1:55439` dans
`/home/afripayadmin/guest-checkout-evidence-20261009/pg-lab-p5c-ops`.

Ce serveur ne partage pas son port, son cluster, ses tables ni ses données avec PostgreSQL de production ni avec les autres tests sur `55438`. Les six fichiers historiques de tests PostgreSQL sont fournis **en entier**, avec comme seule modification de leur configuration la migration du port de laboratoire `55438 → 55439` (plus deux assertions du champ Google server-side).

- P1/P2 : 12/12.
- P3 transaction financière : 6/6.
- P4 coffre canonique : 9/9.
- P4 variante historique : 4/4.
- P5-A devis et Google Places : 8/8.
- P5-B couverture Merchant : 8/8.
- P5-B registre indépendant Ops PostgreSQL : 5/5.
- P5-C réservation Stripe simulée et contrôles anti-révocation : **19/19**.
- **Total attendu après le gate : 71/71.**
- API TypeScript et Client TypeScript : PASS.
- Guards `PaymentsAuthGuard` et `OrdersAuthGuard` conservés.
- Aucune nouvelle route publique de paiement, aucune migration production, aucun build EAS/OTA.
- Fournisseurs Stripe et Google Places : **simulés**, sans aucune opération bancaire réelle.

Log complet : `/tmp/da_guest_p5c_ops_gate_20261009_FINAL.log`.
Commande :
```bash
ssh purplecrm-vps 'cd /home/afripayadmin/worktrees/guest-p5c-ops-integrated-20261009 && bash scripts/da_guest_checkout_p5c_ops_gate.sh'
```

## 4. Cas P0 prouvés

1. Rejet si l'Ops révoque la zone entre devis et réservation.
2. Rejet si l'Ops révoque après la création de la réservation PostgreSQL mais avant l'appel Stripe.
3. Rejet si la zone est révoquée pendant l'appel Stripe, avant toute restitution de `clientSecret`.
4. Rejet de la restauration d'un ancien secret après révocation.
5. Rejet si l'autorisation Ops expire, si sa révision change ou si le rayon de livraison est réduit.
6. Rejet en cas d'indisponibilité du registre Ops.
7. Rejet si le dossier AES ne contient pas de preuve Google vérifiée.
8. Une seule intention Stripe malgré huit appels concurrents.
9. Reprise après perte réseau après création Stripe avec la même clé d'idempotence.
10. Refus de montant/devise/métadonnées incohérents ou mode `livemode`.
11. Scénario complet en laboratoire `catalogue → Google Places → validation Merchant+Ops → AES → Stripe simulé` ; un montant mobile forgé ne détermine jamais le prix.

## 5. Ce qui reste bloquant avant une activation réelle

- **P0 :** mécanisme de compensation/réconciliation des PaymentIntents **orphelins**, notamment lorsque le fournisseur a créé l'Intent puis que la couverture a été révoquée avant COMMIT, ou lorsque Stripe expire sa propre mémoire des clés d'idempotence. Si la révocation survient après remise d'un secret de paiement, la seule lecture au début de la requête ne suffit pas : ajouter annulation Stripe, surveillance des changements d'autorisation et traitement post-paiement (remboursement/incident Ops).
- Service Stripe réel en **mode test** seulement, avec récupération idempotente, verification des états et simulation de pannes réseaux.
- Endpoints guest fermés par défaut, gestion des clés et anti-abus distribués.
- Règles géographiques réelles validées par les restaurants et par Ops ; aucune configuration de laboratoire ne vaut approbation commerciale.
- Projection durable du paiement/ordre privé vers Merchant et Courier sous OIDC, notification/outbox, suivi invité et récupération sécurisée.
- Adaptation Client iOS/Android `Mon espace → Panier → Payer → Suivre` sans Keycloak obligatoire, seulement après les protections serveur, E2E et RGPD.
- Revue de la persistance financière non commitée de `/opt/delishafrica/monorepo` avant toute fusion.
- Aucune version Store en revue n'a été modifiée ou republiée.

**Décision : fondation de paiement invité intégrée P5-C validable en laboratoire ; activation réelle INTERDITE à ce stade.**
