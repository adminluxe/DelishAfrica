# DELISHAFRICA — AUDIT DE JONCTION P5-B → P5-C : COUVERTURE / STRIPE

**Date :** 09 octobre 2026. **État :** décision de revue AVANT fusion, sans modification du code P5-C.
**Objectif :** protéger un Client sans compte obligatoire contre les doubles paiements et les commandes hors zone en cas de révocation d'une desserte.

## 1. Branches concurrentes — vérité Git observée

- P5-B strict revu : `feature/client-guest-coverage-strict-20261009`, commit `30c5952946aa518d60cd8c8b8794952f0934c7a1`.
  - Deux approbations : configuration Merchant publiée, versionnée et hachée + approbation Ops indépendante en base.
  - Géométrie : centre GPS/rayon, codes postaux, pays, révocation/expiration par empreinte.
  - Gate : 52/52 tests P1–P5-B, TypeScript API/Client PASS.
- Branche parallèle P5-B : `feature/client-guest-checkout-p5b-coverage-20261009`, HEAD observé `e55a79e`.
  - Source : `guest-published-partner-coverage.ts`.
  - Approbation Ops également indépendante via `da_guest_merchant_coverage`, avec périmètre de rectangle GPS, code postal et expiration.
  - Le modèle de preuve est différent, mais le principe « Ops indépendant, fail closed » est présent.
- Branche P5-C parallèle : `feature/client-guest-checkout-p5c-stripe-20261009`, basée sur `e55a79e` au dernier contrôle.
  - Travail en cours : `guest-stripe-intent-reservation.ts`, `20261009_guest_intent_creation_reservations.sql` et tests associés; ces fichiers étaient encore non commités au moment de l'audit.
  - Ne **pas** modifier ce worktree concurrent ni en cherry-picker un état de travail instable.

## 2. Arbitrage obligatoire : une seule source de vérité de couverture

Les deux chemins ne doivent PAS être activés ensemble. Avant merge, choisir explicitement :
A. catalogue Merchant versionné + table Ops d'empreintes signées, ou
B. zones entièrement administrées dans un registre Ops indépendant, avec consentement Merchant prouvé via le catalogue.

Les deux peuvent être sécurisés sous RBAC, mais possèdent des schémas SQL différents. Vérifier que :
- Seuls les opérateurs habilités peuvent créer/révoquer une approbation ; le checkout n'a que SELECT.
- Le restaurateur peut retirer/limiter son droit de livraison sans créer une nouvelle autorisation.
- Chaque décision possède une date limite, un historique d'audit et un contrôle de révocation.
- Aucune zone fictive de laboratoire ni tableau de codes postaux n'est automatiquement autorisé en production.

## 3. P0 — REVALIDATION IMMÉDIATEMENT AVANT PAYMENTINTENT

Aujourd'hui, `GuestStripeIntentReservation.start(token)` utilise la session et le dossier scellé, mais ne revalide pas explicitement la couverture Merchant/Ops au moment de créer Stripe.

**Risque à couvrir par des tests :** zone autorisée à l'instant T0 (devis/scellement), révoquée à T1, mais paiement lancé à T2. Une commande pourrait être payée sans droit de livraison actif.

Remédiation proposée :
- Lors du scellement P4/P5-A, mémoriser **dans le dossier chiffré** les preuves non ambiguës de l'adresse confirmée : Google placeId, pays, code postal, latitude/longitude, révision de couverture / preuve Ops ou identifiant d'autorisation.
- Avant toute réservation d'Intent, relire et vérifier la décision de desserte depuis la **source Ops courante** et les droits Merchant; si révoquée, expirée ou déplacée => REFUS AVANT STRIPE.
- Revalider le devis et les horaires/données critiques du restaurant, en distinguant correctement l'expiration d'une session mobile de la continuité d'une commande déjà payée.
- Après paiement déjà confirmé, une révocation ne doit jamais faire disparaître l'argent ou la commande : conserver le dossier financier, déclencher un chemin opérateur de traitement/compensation ou remboursement.

**Attention :** P4 `GuestPrivateFulfillmentVault` stocke aujourd'hui `address/city/serviceAreaCode`, pas l'ensemble des coordonnées/empreintes géographiques. Étendre et tester le schéma chiffré de façon versionnée AVANT un branchement de cette revalidation.

## 4. P0 — IDEMPOTENCE STRIPE ET ETATS DE PANNE

La réservation P5-C utilise une clé Stripe stable `da-gc-pi-v1:{orderId}` et un bail PostgreSQL. C'est une bonne direction; vérifier impérativement :
1. Crash juste après création Stripe mais avant COMMIT PG : un retry récupère le MEME Intent et ne génère jamais un nouvel Intent pour le même ordre.
2. Tentatives simultanées ou bail expiré en plein appel externe : un seul Intent pouvant être présenté au client.
3. Un échec de Stripe, un conflit d'idempotency key ou une panne réseau n'implique aucune facture client doublée; récupération explicite.
4. Aucun `clientSecret` n'est retourné au téléphone AVANT l'association durable en base.
5. L'idempotence reste sûre si l'historique fournisseur expire; ne pas se fier à une conservation illimitée chez Stripe.
6. Les intents annulés, remboursés, confirmés ou contestés ne sont pas restaurés comme nouveaux paiements.
7. Aucun flux P5-C n'utilise un secret Stripe live avant la revue sécurité et la procédure contrôlée d'activation.

## 5. Critères de fusion

- Worktree P5-C propre et commit partagé.
- Choix d'un seul schéma de couverture Ops approuvé, architecture et Roadbook maîtres réconciliés.
- Tests nouveaux : révocation Ops entre quote et Stripe; réduction de zone; hôtel/adresse/placeId différents; expiration; panne du registre Ops (fail closed).
- Tests PostgreSQL concurrence + timeout création Stripe, statut Stripe réel **mode test** uniquement, finalisation webhook et outbox, sans création double ni perte.
- TypeScript API/Client, tests P1–P5-B cumulés, sécurité Merchant/Courier/Ops, RGPD et replay.
- Aucun merge sur `/opt/delishafrica/monorepo`, aucun déploiement et aucun build store avant ce gate final.

**Conclusion : l'absence de connexion forcée est l'objectif produit; l'autorisation de livrer et la preuve d'encaissement restent des invariants de sécurité.**

## CONCLUSION D AUDIT P5-C LAB — 09/10/2026
- La preuve géographique est maintenant incluse dans le paquet scellé P4 sous AES-256-GCM sur la branche P5C ops integrated.
- La couverture Ops est revalidée avant création d'Intent et après réponse; 19/19 tests P5C et 71/71 cumulés.
- Une seule variante P5B est retenue sur CETTE branche d'intégration: la couverture par empreinte avec approbation Ops indépendante.
- Risque restant: course temporelle apres remise de clientSecret, annulation d'Intent et reconciliation bancaire reelle; aucune activation avant validation.
- Source: docs/guest-checkout/ROADBOOK_P5C_OPS_INTEGRATED_20261009.md.
