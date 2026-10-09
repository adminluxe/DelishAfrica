# DELISHAFRICA — PALIER 4, COFFRE LIVRAISON
Date : 09/10/2026. Statut : laboratoire isolé, non livré.

## Constat
Les informations destinées au restaurateur étaient transmises après paiement par l'application. Si le téléphone s'interrompait, la finalisation ne disposait pas toujours des éléments nécessaires.

## Réalisation
- Fichier complet : services/api-nest/src/guest-checkout/guest-delivery-vault.ts.
- Migration dédiée : migrations/20261009_guest_delivery_context.sql.
- Coordonnées validées, chiffrées AES-256-GCM et liées à une seule commande.
- Empreinte HMAC et clé de chiffrement séparées de la clé de session.
- Devis figé par transaction PostgreSQL, depuis les prix recalculés par le catalogue serveur.
- Aucun nom, adresse, numéro ou courriel conservé en clair dans la table.
- Une fois le devis fixé, les modifications concurrentes sont refusées.

## Preuves
Quatre tests sur PostgreSQL 16 isolé : chiffrement, isolation, montant autoritaire, rollback et reprise. Tous réussis. TypeScript API : PASS.
Base laboratoire : 127.0.0.1:55438. Migrations non appliquées en production.

## Interdictions et suite
- La connexion actuelle du Client n'a pas changé.
- Le coffre n'est pas encore relié à l'API publique, aux paiements ou à la livraison.
- Les contrôles Merchant/Courier/Ops sont conservés.
- Finaliser la liaison avec la création de paiement sur le serveur, les commandes, la restitution au restaurateur et l'interface mobile.
- Vérifier les protections anti-abus et la politique de conservation avant toute publication.

Verdict : PALIER 4 — CHIFFREMENT VALIDÉ EN LABORATOIRE ; CHECKOUT CLIENT SANS COMPTE NON ENCORE LIVRÉ.
