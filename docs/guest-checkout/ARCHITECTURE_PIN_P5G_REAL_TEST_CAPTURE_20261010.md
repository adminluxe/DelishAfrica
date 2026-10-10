# DELISHAFRICA — ARCHITECTURE PIN P5-G / Financier TEST

**Date 10/10/2026. Aucun déploiement de production.**

## Chaîne laboratoire P5-G

Client Guest synthétique → token HMAC et session en Postgres isolé 55443 → devis signé → dossier AES-256-GCM → contrôle de couverture Merchant/Ops synthétique → réservation idempotente persistée → vrai Stripe TEST PaymentIntent (21,90 EUR) → confirmation avec `pm_card_visa` (méthode fictive officielle) → statut fournisseur `succeeded` et charge capturée en TEST.

Le finaliseur P3 vérifie **une nouvelle fois** les preuves depuis l'API Stripe, puis exécute sous transaction PostgreSQL : mise à jour session `committed` + une écriture `da_guest_verified_payments` + un `da_guest_financial_outbox` au statut `pending_fulfillment_data`.

## Frontières de confiance

- Stripe API TEST (réelle, sans carte réelle) ≠ paiement réel encaissé (0 EUR).
- Le test produit un webhook signé avec un secret **synthétique local** : il ne prouve pas la réception réseau des webhooks envoyés par Stripe.
- Une signature invalide est refusée.
- Un webhook local correctement signé porte uniquement un ID d'intention ; le backend récupère les preuves financières du fournisseur avant d'autoriser le commit.
- Le même événement rejoué ne crée pas de deuxième registre financier ni outbox.
- L'outbox n'est PAS le dispatch Courier : aucune commande Merchant ou livraison n'est déclenchée.
- Clé Stripe secrète test injectée en mémoire par un gate root, subprocess Node exécuté en non-root ; jamais de clé dans Git, log ou téléphone.
- Journal durable avant CREATE, jamais d'essai relancé silencieusement : une capture TEST existante ne doit pas être annulée comme si elle n'avait pas eu lieu.
- Toutes les tables de paiement se situent dans le PostgreSQL isolé `127.0.0.1:55443`. Rien dans la base de production.
- Le dépôt actif `/opt/delishafrica/monorepo` est préservé, sans cherry-pick, merge, restart, migration de production ou build.

## Périmètre non couvert

Flux réel webhook HTTP signé par Stripe et sécurité de l'endpoint ; refunds/disputes ; PaymentSheet physique iOS/Android ; autorisation de zones réelles ; RBAC Ops ; ordre métier Merchant/Courier ; Client Guest sans Keycloak ; contexte réglementaire du PSP.

**P5-G : test Stripe et finalisation P3 réussis en laboratoire. Aucun checkout public activé.**

Détails : `docs/guest-checkout/ROADBOOK_P5G_REAL_TEST_CAPTURE_20261010.md`.
