# DELISHAFRICA — ROADBOOK P5-D / STRIPE INTENT RECOVERY & COMPENSATION

**Date :** 09 octobre 2026 (Europe/Brussels)
**Statut :** LABORATOIRE ISOLÉ, checkout invité public NON ACTIVÉ.
**Branche :** `feature/client-guest-p5d-reconciliation-20261009`
**Worktree :** `/home/afripayadmin/worktrees/guest-p5d-reconciliation-20261009`
**Parent :** `d353170`, P5-C intégré Merchant/Ops (71/71 tests).

## Mission

Éviter qu'une erreur réseau ou PostgreSQL au cours de la création d'un PaymentIntent Stripe n'autorise un second paiement, et empêcher qu'une annulation échouée se fasse passer pour une annulation réussie.

Le besoin est un prérequis à « Mon espace → Payer → Suivre » sans Keycloak obligatoire. Il ne justifie **aucune régression** de contrôle de prix, devis, couverture Merchant/approbation Ops ni intégrité du coffre privé P4.

## Fichiers complets créés/modifiés

- `services/api-nest/src/guest-checkout/guest-orphan-intent-compensator.ts` (NOUVEAU) : tentative d'annulation du Stripe Intent connu sous verrou de ligne PostgreSQL, protection de la propriété du bail, marquage terminal `cancelled` ou `review_required`, et quarantaine de la clé après expiration.
- `services/api-nest/src/guest-checkout/guest-stripe-intent-reservation.ts` (FICHIER COMPLET CORRIGÉ) : `cancelIntent` exigé du transport Stripe de laboratoire ; interdit de recréer un Intent à partir d'une réservation trop ancienne ; compensation si la couverture est révoquée après la création Stripe ou si la transaction de liaison a échoué ; gestion des commits PostgreSQL incertains sans annulation dangereuse ; messages d'erreur réseau neutralisés.
- `migrations/20261009_guest_intent_recovery.sql` (NOUVEAU) : deux états terminaux supplémentaires pour la réservation : `cancelled` et `review_required`, avec raison non personnelle ; contraintes de transition, index pour surveillance des dossiers en attente.
- `services/api-nest/test/guest-stripe-intent.postgres.test.cjs` (FICHIER COMPLET CORRIGÉ) : FakeStripe peut annuler, simuler timeout, mauvais statut, refus ou perte d'accusé de réception PostgreSQL ; **30 tests ciblés**, dont 11 nouveaux par rapport à P5-C.
- `scripts/da_guest_checkout_p5d_gate.sh` : vérifie l'intégralité des tests P1 → P5-D sur un PostgreSQL dédié, TypeScript API/Client, guards Payments/Orders, absence de route publique et différences Git.
- Les six fichiers de tests PostgreSQL hérités sont fournis complets, avec port isolé `55440` à la place du `55439` du laboratoire P5-C.

## Matrice des pannes & résultats attendus

| Incident | Décision P5-D |
| --- | --- |
| Permission Merchant/Ops retirée avant Stripe | Aucun nouvel Intent |
| Permission retirée après création Stripe, avant retour Client | Annuler sous verrou PG ; statut `cancelled` si Stripe confirme `canceled` |
| Annulation en erreur réseau ou état Stripe non annulable | `review_required`, aucun nouveau paiement ni `clientSecret` |
| Réponse Stripe contenant des métadonnées invalides | Ne pas annuler un identifiant non vérifié ; `review_required` |
| PostgreSQL échoue à enregistrer l'Intent alors que Stripe a répondu | Rollback, annulation contrôlée sous bail si commit non tenté |
| PostgreSQL perd l'accusé de COMMIT | **Ne pas annuler aveuglément** un Intent possiblement `bound` ; vérifier/récupérer le même |
| PostgreSQL indisponible après création Stripe | Réservation initiale conservée, pas de nouveau numéro de paiement, reprise avec même clé après rétablissement |
| Stripe a créé l'Intent mais la réponse réseau s'est perdue | Réessayer même clé et mêmes paramètres tant que fenêtre de sûreté ouverte |
| Première réservation antérieure à 23 heures | Aucune nouvelle requête Stripe `createIntent` sur cette clé ; `review_required` quand bail expiré |
| Un autre worker possède désormais le bail | Aucune annulation risquant d'affecter un Intent déjà réservé ou lié par cet autre worker |
| Intent déjà lié et secret demandé de nouveau | Lecture Stripe + couverture actuelle, aucun nouveau `createIntent` |

La limite conservatrice de **23 h** est une marge d'architecture au regard de la conservation limitée des clés d'idempotence Stripe. Elle ne remplace pas une véritable recherche et réconciliation opérateur.

## Tests et preuves

- 12 P1/P2 (capacités et ledger).
- 6 P3 (financier Stripe simulé avec PostgreSQL).
- 9 P4 coffre canonique.
- 4 P4 historique.
- 8 P5-A catalogue/Google.
- 8 P5-B couverture géographique Merchant.
- 5 P5-B approbation Ops indépendante.
- 30 P5-C/P5-D réservation Stripe et compensation.

**Total attendu : 82/82** après gate final.
**PostgreSQL labo :** `127.0.0.1:55440`, cluster distinct de production et de `55438`/`55439`.
**Stripe et Google :** exclusivement des simulateurs ; zéro débit.
**Log VPS :** `/tmp/da_guest_p5d_gate_FINAL_20261009.log`.

Commande tout-en-un (à exécuter depuis le Toshiba ; ne déploie rien) :

```bash
ssh purplecrm-vps 'cd /home/afripayadmin/worktrees/guest-p5d-reconciliation-20261009 && bash scripts/da_guest_checkout_p5d_gate.sh'
```

## Risques P0 encore ouverts

1. **Post-remise du secret :** si une livraison est révoquée après que Stripe a transmis le clientSecret au téléphone, le client peut encore tenter de confirmer un paiement. Il faudra annuler côté Stripe/traiter les webhooks de paiement déjà confirmé, rembourser si nécessaire, puis alerter Ops.
2. **Observabilité/reconciliation :** créer un worker avec journal durable et alarmes pour les lignes `review_required`. Ne jamais libérer une commande Merchant/Courier sans confirmation financière P3.
3. **Adaptateur Stripe authentique :** tester `createIntent`, `getIntent`, `cancelIntent` en **mode test réel** ; limiter la durée des appels et suivre les restrictions Stripe. Le mock n'est pas une preuve PSP externe.
4. **Autorisations Ops :** l'écriture des approbations par un vrai RBAC et les zones réelles de restaurant restent à développer.
5. **Un seul chemin de commandes réelles :** transaction/dispatcher métier Merchant, Courier, outbox durable, notification et suivi Client privé.
6. **Review sécurité :** rôles SQL distincts, RGPD/PCI, redaction des logs, résilience multi-workers, OTP/récupération d'un profil Guest, tests iOS/Android.
7. **Flux utilisateur :** Client exige encore Keycloak ; ne pas ouvrir cette dépendance tant que l'API Guest de bout en bout n'est pas prête.
8. **Aucun déploiement ni Store build** avant revue officielle et gates E2E.

## État de livraison

**P5-D fondation de compensation de paiement = laboratoire validé après le gate.**
**Commande invitée opérationnelle en production = NON.**
**Stripe réel activé = NON.**
