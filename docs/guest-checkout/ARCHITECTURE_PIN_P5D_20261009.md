# DELISHAFRICA — ARCHITECTURE PIN P5-D / PAIEMENT INVITÉ RÉSILIENT

**Date :** 09/10/2026. **Statut :** architecture de laboratoire, aucune API publique Guest Checkout.

## Chaîne métier cible

```text
CLIENT "Mon espace" (carte/panier, Place ID, consentement)
       |
       v
CatalogOrderPolicy.quote (catalogue et prix backend)
       |
Google Places server-side (adresse vérifiée)
       |
GuestMerchantCoverageStrict + PostgresGuestCoverageOpsApprovals
       |             (zone Merchant ET preuve Ops indépendante)
       v
GuestCheckoutLedger (devis immuable) -> coffre P4 AES-256-GCM
  (contact, lignes, zone, géométrie Google vérifiée; aucune PII en clair)
       |
       v
GuestStripeIntentReservation (P5-C/D LAB UNIQUEMENT)
  (capabilité HMAC, hash PG, appartenance ordre)
       |
  Contrôle du droit de livraison ACTUEL
       |
  Réserver en PG la clé stable idempotencyKey(orderId)
       |
  Revalider Merchant + Ops avant Stripe
       |
  Stripe.createIntent SIMULÉ
       |
  Vérifier métadonnées, statut, montant, devise, test mode
       |
  Revalider Merchant + Ops après Stripe
       |
  +--- autorisation valide ---> PG transaction : PAYMENT_PENDING + BOUND
  |                                        |
  |                                   renvoyer clientSecret
  |
  +--- révocation / échec PG ---> GuestOrphanIntentCompensator P5-D
                                  |
                                  | sous SELECT FOR UPDATE, bail vérifié
                                  +--> Stripe.cancelIntent SIMULÉ
                                  |       |
                                  |       +-- Stripe 'canceled' : CANCELLED
                                  |       +-- échoué/incertain : REVIEW_REQUIRED
                                  |
                                  +--> jamais recréer une clé périmée (>23h)
       |
[P3] Webhook signé + lecture Stripe + transaction financière
[P4] Préparation privée sans diffusion
[P5-E A CONSTRUIRE] vraie commande Merchant/Courier + outbox
[P5-F A CONSTRUIRE] suivi Guest Client / reprise sans Keycloak
```

## 10 règles de sécurité

1. Pas de prix de confiance en provenance du Client.
2. La couverture ne provient pas d'un booléen marchand auto-approuvé ; preuve Ops séparée et révision hachée.
3. Le dossier privé et la position GPS vérifiée sont chiffrés sous AES-GCM avec AAD orderId/quote.
4. Une seule réservation et **une seule clé d'idempotence stable par ordre**.
5. Ne jamais créer un nouvel Intent si la création précédente est incertaine au-delà de la fenêtre sûre de 23 h.
6. Ne jamais annuler un Intent sans savoir si une transaction concurrente l'a lié (verrou PG et bail vérifié).
7. Ne jamais considérer qu'une annulation en erreur réseau signifie « Stripe a annulé ». État REVIEW_REQUIRED.
8. Si COMMIT PG est ambigu, ne pas annuler un paiement potentiellement lié ; attendre lecture et reconciliation.
9. Aucun `clientSecret` fourni en cas d'erreur du fournisseur, de revocation, de rollback ou de review.
10. Aucun endpoint Guest public, aucun live Stripe, aucune modification des guards OIDC, builds Stores ou DB de production.

## Persistance

La table `da_guest_payment_intent_creation` introduite en P5-C est étendue par :
`migrations/20261009_guest_intent_recovery.sql`.

États possibles : `creating`, `bound`, `cancelled`, `review_required`.
Les transitions terminales conservent le lien `order_id`, éventuellement `stripe_intent_id`, et une raison codée non personnelle. Les états finaux ne libèrent jamais une commande métier d'eux-mêmes.

## Frontières encore non garanties

- Après remise du clientSecret, une révocation peut survenir : le worker de surveillance Stripe/Webhook + annulation/remboursement est indispensable, **pas encore livré**.
- Les états REVIEW_REQUIRED doivent être remontés à Ops avec une procédure auditée; pas encore de console/alerte.
- L'adaptateur Stripe ne doit pas être un mock pour le déploiement; `cancelIntent` doit respecter délais, états, idempotence et erreur réseau de Stripe en **mode test réel**.
- Pas de P5-E Merchant/Courier, ni P5-F suivi client invité.
- Le code est test-only et inatteignable depuis les contrôleurs Nest publics.

## Preuve & chemins

Branche : `feature/client-guest-p5d-reconciliation-20261009`
Worktree : `/home/afripayadmin/worktrees/guest-p5d-reconciliation-20261009`
PostgreSQL laboratoire : `127.0.0.1:55440`
Gate : `scripts/da_guest_checkout_p5d_gate.sh`
Log : `/tmp/da_guest_p5d_gate_FINAL_20261009.log`
Résultat attendu : **82/82 tests**, API/Client TypeScript PASS.

Architecture principale : `DELISHAFRICA_ARCHITECTURE_PIN_COMBO22_LATEST.md`.
Roadbook P5-D : `docs/guest-checkout/ROADBOOK_P5D_20261009.md`.

**Client Guest Checkout prêt pour la production : NON.**
