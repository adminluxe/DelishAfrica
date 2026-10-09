# DELISHAFRICA — ARCHITECTURE PIN : GUEST CHECKOUT
Date : 9 octobre 2026. Statut : palier 1 en laboratoire, non déployé.

## Décision produit
Client peut découvrir, commander et payer sans compte obligatoire à terme. Son profil « Mon espace » reste utile. Comptes durables et synchronisation multi-appareils facultatifs. Authentification pro Merchant/Courier/Ops intacte.

## Circuit cible
1. Profil local + panier Client.
2. API crée une identité invitée à usage unique et un ordre identifié côté serveur.
3. Validation du catalogue, des disponibilités, de l'adresse et des montants par le backend.
4. Stripe PaymentIntent avec idempotence, lié au même ordre et à la même session.
5. Confirmation serveur du paiement et création durable de l'ordre, résistant à fermeture de l'app.
6. Accès au suivi via une autorisation limitée à cet ordre, avec récupération adaptée.

## Ce qui est codé au 09/10 (palier 1)
- API : nouveau module guest-checkout avec contrôle de santé et prévisualisation limitée au développement.
- Jeton HMAC SHA-256 v1, expiration 4 h, orderId et mutationId générés sur le serveur, aucune PII dans le jeton.
- La prévisualisation est toujours refusée en environnement production, même si une clé est présente.
- Le jeton ne permet pour l'instant aucune action PaymentIntent ou Orders.
- Guards Keycloak des paiements et commandes inchangés.
- Radar : clarifie le statut des restaurants ouverts à la commande et des adresses en veille ; son emplacement reste inchangé.

## Frontières P0
- N'ouvrir aucun endpoint de paiement sans contrôle serveur du prix, identité propre à un seul ordre et anti-rejeu.
- Interdire à l'invité toute action dans Merchant/Courier/Ops et toute commande autre que la sienne.
- Ajouter stockage persistant des sessions et limites partagées ; le rate-limiter de prévisualisation ne suffit pas en production.
- Garantir la création durable de la commande après paiement Stripe confirmé, même en cas de fermeture mobile.
- Tester concurrence, double tentative, remboursement, annulation, panne, expiration et récupération d'accès.
- Ne jamais remplacer le système d'identité par une simple adresse e-mail ou un ID mobile déclaré.
- Ne pas modifier les builds iOS/Android actuellement examinés.

## Réconciliation indispensable
Dépôt actif : /opt/delishafrica/monorepo ; changements financiers Postgres non committés.
Worktree propre : /home/afripayadmin/worktrees/guest-checkout-secure-20261009.
Avant intégration, revoir les écarts de la persistance orders/payments : ne pas écraser les travaux actifs.

## Documents
Voir docs/guest-checkout/ROADBOOK_GUEST_CHECKOUT_20261009.md pour les gates détaillés.
