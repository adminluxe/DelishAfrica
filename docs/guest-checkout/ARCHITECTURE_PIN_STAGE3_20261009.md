# DELISHAFRICA — ARCHITECTURE PIN GUEST CHECKOUT / P3
Date: 9 octobre 2026. Statut: laboratoire, zéro service public activé.

## Contrats de sécurité P1-P3
- P1 crée une capacité invitée HMAC limitée à une commande, 4 heures, sans données personnelles.
- P2 introduit un ledger PostgreSQL par empreinte SHA-256 du jeton, état `issued -> quoted -> payment_pending`, montants du serveur uniquement.
- P3 finalise financièrement depuis le serveur sans téléphone : webhook Stripe signé -> API Stripe indépendante -> transaction PostgreSQL unique -> paiement confirmé, outbox financière ; pas de dispatch en l'absence de données de livraison fiables.
- Keycloak des comptes Merchant/Courier/Ops demeure strict. Aucune route HTTP ni Stripe PaymentIntent guest n'est activée en P3.
- Les deux migrations SQL restent séparées de la base de production et doivent être revues avant tout déploiement.

## Pipeline transactionnel
```text
[Stripe signed event, payment_intent.succeeded]
      |
[HMAC v1 + timestamp within 300s]
      |
[GET Stripe PaymentIntent expanded latest_charge]
      |
[Verify order, mutation, subject, issuer, fingerprint, amount,
 currency, mode, captured, paid, not refunded, not disputed]
      |
[BEGIN PostgreSQL | SELECT guest session FOR UPDATE]
      |
+-----+-----------------------------------------------+
| First valid receipt | Duplicate valid receipt          |
| INSERT guest_verified_payments                     |
| INSERT guest_financial_outbox                       |
| UPDATE guest_session => committed                  |
| COMMIT           | check existing proof, COMMIT    |
+------------------+----------------------------------+
      |
[Financially confirmed; fulfillment pending P4]
```

## Tests négatifs prouvés
- 8 événements simultanés sur une même session -> une seule écriture.
- Fausse signature ou décalage de temps -> rejet sans mutation.
- Informations Stripe invalides, remboursement, capture partielle -> rejet.
- Panne entre écriture du paiement et outbox -> rollback, retry fiable.
- App/token expiré après paiement -> réconciliation serveur possible.
- Ancien état committed -> relecture sûre et idempotente.

## Invariants et limites
- Aucune livraison ni mutation de commande réelle à ce stade. Le ledger financier ne contient PAS le panier, l'adresse, les coordonnées ni les consentements nécessaires au restaurant.
- La future intégration devra chiffrer ces éléments côté serveur et enregistrer l'ordre de façon atomique avant toute transmission.
- P3 utilise un lecteur de réponses Stripe simulé dans les tests. L'adaptateur HTTP Stripe n'est pas autorisé à effectuer un paiement réel.
- PostgreSQL laboratoire : `127.0.0.1:55438`, répertoire privé `/home/afripayadmin/guest-checkout-evidence-20261009/pg-lab-p3`.
- Connexions de production, API de production, EAS, stores et comptes testeurs : inchangés.

## Références
Roadbook : `docs/guest-checkout/ROADBOOK_GUEST_CHECKOUT_STAGE3_20261009.md`.
Source finalizer : `services/api-nest/src/guest-checkout/guest-stripe-financial-finalizer.ts`.
Migration P3 : `migrations/20261009_guest_verified_payment.sql`.
Tests : `services/api-nest/test/guest-stripe-finalizer.postgres.test.cjs`.
Gate : `scripts/da_guest_checkout_stage3_gate.sh`.
