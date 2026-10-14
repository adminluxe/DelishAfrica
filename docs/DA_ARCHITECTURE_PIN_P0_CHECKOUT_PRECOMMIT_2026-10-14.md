# Architecture Pin — DelishAfrica P0 autorité pré-paiement, 14 octobre 2026

**ÉTAT RÉEL DU CANDIDAT QA : toute création de nouveau PaymentIntent est arrêtée, sans aucun déclenchement Stripe. Pas de déploiement ni de nouveaux paiements.**

## Couche active dans le candidat

    Client /checkout-preflight
          |
          | authentification Client requise + session liée
          v
    POST /payments/create-intent
          |
          | PaymentsAuthGuard
          v
    PaymentsService.createPaymentIntent()
          |
          +--> P0 : 503 checkout_durable_order_authority_not_certified
          |
          X   PAS de quote, PAS de Stripe, PAS de nouveau paiement
          |
    Client : « paiement momentanément indisponible »
             « aucun débit initié, panier conservé »

En parallèle, les anciennes méthodes de rapprochement d'intentions et de webhooks n'ont pas été modifiées. Le stockage de commandes .runtime/orders-demo-store.json et les routes /orders/demo ne sont **pas** autorisés à devenir une autorité comptable ou de commande exploitable ; l'API peut y masquer les erreurs d'écriture. Aucune mutation de l'API live n'est intervenue.

## Architecture CIBLE à certifier avant de lever le verrou

    Client connecté (issuer, audience, subject, tenant)
        |
        v
    Catalogue serveur + devis canonique (unités mineures)
        |
        v
    PostgreSQL transaction (SERIALIZABLE / row locks / tenant scope)
      - réservation commande AVANT appel au PSP
      - clé idempotence (issuer, subject, mutation, panier, montant, EUR)
      - contraintes uniques, aucun faux succès disque
      - disponibilité restaurant et zone de livraison vérifiées
      - statut réservé et outbox persistés atomiquement
        |
        v
    Stripe TEST PaymentIntent (même idempotency key et métadonnées)
        |
        v
    Webhook signé + inbox idempotente + statut PSP relu
        |
        v
    COMMIT commande durable + état ledger + notifications outbox
        |
        +--> Merchant : commandes appartenant au merchant
        +--> Courier : offres strictement attribuées à son identité
        +--> Client : accusé durable + suivi
        |
    Remboursement, dispute, retenue, solde et payout :
    sorties réelles INTERDITES tant que l'autorité AfriPay cible
    et le contexte légal/PSP ne sont pas certifiés.

## Gates indispensables (NO-GO jusqu'à preuves)

- GET sans identité, mauvais rôle ou autre propriétaire => 401/403 ; aucune donnée hors tenant.
- Même clé/payload => même transaction, sans second débit ; même clé/payload différent => 409.
- DB indisponible AVANT Stripe => 503, aucun appel PSP ; panne APRÈS appel => réservation récupérable et rapprochée, jamais un faux statut de paiement.
- Webhooks rejoués, désordonnés, refunded/disputed => transitions sûres, sans crédit financier fictif.
- Redémarrage API, plusieurs instances, crash entre étapes => contraintes DB et outbox résolvent les ambiguïtés.
- Facturation uniquement sur autorité PSP validée ; pas de solde Merchant/Courier issu d'un JSON local, ni d'écritures AfriPay historiques interprétées comme de l'argent disponible.
- Version effectivement présente dans l'App Store à réconcilier avec son binaire, son backend et ses release flags. Aucun nouveau Store push automatique.

## Preuve contrôlée

[DelishAfrica PR #48 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/48) : SHA code 06b747def12ad8fd1b4770f496a5cc6e65c3d533, [QA Actions 38619080284](https://github.com/adminluxe/DelishAfrica/actions/runs/38619080284), 6 PASS et tsc API+Client PASS. Cette preuve ne porte pas sur une instance Nest HTTP live, le VPS ni sur un paiement réel.

## Décision de gouvernance

**Le verrou candidat est protecteur mais non prêt à être déployé seul.** Maintenir PR DRAFT, ne pas autoriser Stripe LIVE, payout, migration ni merge. Préserver le HEAD VPS, les 15 modifications suivies et la parité historique AfriPay 33/132/33 PASS sans nouvel audit.
