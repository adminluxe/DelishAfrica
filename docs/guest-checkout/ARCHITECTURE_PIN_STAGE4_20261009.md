# DELISHAFRICA — ARCHITECTURE PIN / P4 GUEST CHECKOUT
**Date :** 9 octobre 2026 • **Phase :** laboratoire, aucune route publique guest active

## Le parcours cible
```text
Client « Mon espace » [profil/adresse + consentement]
    │
    ├─> Serveur : éligibilité réelle à la livraison + devis catalogue
    │
    ├─> Guest Capability P1 : jeton HMAC valable 4h, scope une commande
    │
    ├─> Postgres P2 : ISSUED -> QUOTED
    │
    ├─> P4 coffre : chiffrement AES-256-GCM du dossier de livraison
    │                    + empreinte du devis + MAC + contrôle consentement
    │                    + trigger SQL obligatoire AVANT PAYMENT_PENDING
    │
    ├─> [P5 NON IMPLÉMENTÉ] : PaymentIntent Stripe Guest idempotent
    │
    ├─> P3 : webhook signé + GET Stripe PaymentIntent/Charge
    │                    + contrôles capture/montant/devise/métadonnées
    │                    + transaction financière et outbox
    │
    ├─> P4 : sous verrou DB, vérifier paiement, déchiffrer et préparer
    │                    + outbox financière READY (sans dispatch)
    │
    └─> [P5 NON IMPLÉMENTÉ] :
           commande Merchant/Courier autorisée + suivi Client scoped
```

## Systèmes et frontières
| Composant | Ce qu'il protège | Etat réel |
| --- | --- | --- |
| P1 HMAC | Droit temporaire à un seul ordre | Codé/testé, preview dev uniquement |
| P2 Ledger PG | Conflits/rejeu/association devis-Intent | Codé/testé, non branché |
| P3 Financial Finalizer | Signature, capture Stripe, transaction paiement/outbox | Codé/testé en lab avec Stripe simulé |
| P4 Private Vault | AES-GCM sur coordonnées, instructions et allergènes | Codé/testé en lab, non branché |
| P4 Prepared Order | Préparation privée après capture | Codé/testé en lab, non distribué |
| P5 API Guest + Stripe | Paiement sans Keycloak réellement utilisable | NON |
| P5 Merchant/Courier | Publication et livraison privées sous droits pro | NON |
| P5 Client tracking | Suivi de l'ordre invité et récupération | NON |

## Invariants absolus
1. L'e-mail ou le numéro de téléphone saisi ne devient jamais une autorisation de lire un ordre.
2. Aucun prix mobile ne fait autorité : devis CatalogOrderPolicyService + validation livraison côté serveur.
3. Aucun Intent n'est lié si le dossier complet n'a pas été chiffré et persisté (trigger de DB).
4. Aucun paiement « paid » sans lecture Stripe, montant capturé et métadonnées concordantes.
5. Aucune notification Merchant/Courier avant construction d'une commande autorisée et persistante.
6. Pas de plaintext PII dans colonnes SQL, journaux, URLs, événements réseau ou jeton invité.
7. Garder les anciens clés de déchiffrement disponibles après rotation, sans les exposer dans Git.
8. Résilience sous concurrence et panne par transaction PostgreSQL atomique.
9. Aucune ouverture des guards Keycloak Ops, Merchant et Courier.
10. Aucun changement sur production, stores, API ou builds en examen pendant les gates laboratoire.

## Techniques
- Module : `services/api-nest/src/guest-checkout`.
- Migration : `migrations/20261009_guest_fulfillment_vault.sql`.
- Base lab : `127.0.0.1:55438`, PostgreSQL indépendant de production.
- Scripts : `scripts/da_guest_checkout_stage4_gate.sh`.
- Source de vérité : `docs/guest-checkout/ROADBOOK_GUEST_CHECKOUT_STAGE4_20261009.md`.
- Dépôt feature : `/home/afripayadmin/worktrees/guest-checkout-secure-20261009`.
- Dépôt actif : `/opt/delishafrica/monorepo` (ne pas toucher, modifications financières locales non committées).

**Statut : validation chiffrée en lab, pas encore solution guest à livrer au Client.**

## CANONICAL P5 STORAGE DECISION — 2026-10-09
- L'adaptateur GuestCheckoutQuoteContext, branché sur da_guest_order_context, demeure une variante EXPERIMENTALE non utilisée en P5.
- Le flux production proposé associera CatalogOrderPolicyService + vérification territoriale autoritaire + GuestCheckoutLedger + GuestPrivateFulfillmentVault + GuestPaidFulfillmentPreparer.
- Un seul chemin de chiffrement de coordonnées devra devenir source de vérité à l'intégration.
- Consulter docs/guest-checkout/CONSOLIDATION_P4_DEUX_COFFRES.md et docs/guest-checkout/history/.
