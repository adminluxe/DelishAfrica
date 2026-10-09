# DELISHAFRICA — ARCHITECTURE PIN / LIVRAISON CHIFFRÉE P4
Statut : laboratoire, octobre 2026.

## Confiance et flux
Client -> session invitée P1 -> registre PostgreSQL P2 -> devis canonique serveur -> coffre AES-256-GCM P4 -> paiement serveur à brancher -> validation financière P3 -> commande et dispatch futurs.
La capacité invitée n'est pas une connexion professionnelle et ne donne aucun droit de gestion.

## Données
- Jeton de session HMAC signé limité à une commande et quatre heures.
- Empreinte du jeton seule en PostgreSQL.
- Nom, téléphone, adresse, consignes et allergies : chiffrés avant stockage.
- AAD du chiffrement lié à l'identifiant de commande ; aucune adresse en clair dans le registre.
- Devis et options produits du catalogue stockés sans données personnelles.

## États
P1 « issued », P4 « quoted », P2 « payment_pending », P3 « committed » (financièrement confirmé seulement).
Avant de considérer la commande exploitable par un restaurateur, les détails de livraison et autorisations devront être reconstitués par une opération serveur contrôlée.
Aucun accès Client, Merchant, Courier ou Ops au déchiffrement brut n'est prévu.

## Contraintes à lever
Gestion des clés, rotation, conservation légale, accès pro limité, sessions de suivi, contrôle des zones et de l'adresse, endpoints sécurisés et test multidevices.
Aucun déploiement ni modification des applications distribuées.
