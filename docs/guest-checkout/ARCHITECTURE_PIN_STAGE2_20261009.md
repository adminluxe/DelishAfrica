# DELISHAFRICA — ARCHITECTURE PIN P2 / CHECKOUT INVITÉ
Date : 9 octobre 2026 ; pas en production.

## Séparation de responsabilité
Client mobile : adresse/profil local, panier ; aucune preuve d'identité commerciale ou financière fondée sur la seule saisie de ces champs.
Guest session P1 : jeton court HMAC signé, avec scope checkout:single-order, issuer/audience spécifiques.
Guest ledger P2 : PostgreSQL préparé (migration NON exécutée), hash SHA-256 du jeton uniquement, indices uniques et transitions atomiques par UPDATE conditionnel.
Catalog policy existant : seul fournisseur autorisé du devis/résumé de panier avant QUOTED.
Stripe existant : futurs PaymentIntent attachés à un checkout UNIQUE par ordre + idempotency stable.
Orders + dispatch existants : clients Keycloak conservés et non affectés, nouveaux invités NON ENCORE AUTORISÉS.
P3 serveur à créer : webhook Stripe validé, statut payé, commande enregistrée durablement et événement dispatch dans UNE transaction/ou outbox atomique.

## Diagramme de confiance
```
[Client: informations livraison] ----> [profil local, cart]
      |
      +------ HTTPS ------> [Guest API, serveur]
                                   |-- Signed scoped token, no PII
                                   |-- PostgreSQL da_guest_checkout_sessions
                                   |   ISSUED -> QUOTED -> PAYMENT_PENDING
                                   |-- Catalogue authoritative quote
                                   |
                    [P3, NON BRANCHÉ] Stripe payment intent + confirmation
                                   |-- Verified webhook + Stripe GET
                                   |-- Postgres atomic order/outbox
                                   +-> scoped tracking token (NOT built yet)
```

## Garanties Stage2 démontrées
- Aucune exposition de l'adaptateur guest ledger aux controllers REST publics.
- Seul un token signé, non expiré et correspondant au hash stocké permet lookup.
- Recalcul réel de prix, action Stripe et statut PAID **non implémentés** dans ce palier.
- Liaisons devis et PaymentIntent prévues par CAS DB, refus changement de valeurs après écriture, retry identique accepté.
- Identifiants de session/commande uniques, et index paiement unique en SQL.
- Aucun mot de passe, nom, e-mail, numéro de téléphone ni adresse enregistrés dans la table.

## Garde-barrières non encore prouvés
- SQL réellement exécuté sur Postgres de staging isolé.
- Résilience multi-instance réelle contre la concurrence, idempotence Stripe côté API, gestion de reprise après crash.
- Stockage chiffré des détails nécessaires à l'expédition et consentements.
- Finalisation serveur indépendante du mobile ; relecture d'un ordre invité sans lien secret exposé.
- Conflits du module finance Postgres actif, actuellement non committé, à résoudre sans écraser.
- Tests sur appareils iOS/Android sans écran Keycloak.

Dépôt branche feature : /home/afripayadmin/worktrees/guest-checkout-secure-20261009
Snapshot finance courant : /home/afripayadmin/guest-checkout-evidence-20261009/finance-snapshot-current-20261009
Migration prête : migrations/20261009_guest_checkout_ledger.sql
Readback : docs/guest-checkout/ROADBOOK_GUEST_CHECKOUT_STAGE2_20261009.md

**NE JAMAIS confondre Stage2 PASS (préparation structurée) avec paiement invité autorisé.**
