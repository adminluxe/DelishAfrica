# DELISHAFRICA — ARCHITECTURE PIN : CLIENT GUEST RECOVERY SDK
Branche : feature/client-guest-ux-preview-20261009.
Aucune activation de paiement sans compte ni route Guest en production.

## Découpage technique
SecureStore iOS/Android : jeton temporaire et identification de commande, sans PII.
GuestCheckoutDraftVault : vérification structurelle locale, progression monotone et interdiction de remplacer silencieusement un paiement en attente.
Backend sécurisé : seule autorité pour valider la signature réelle, Stripe et l'accès aux commandes.
Session expirée après paiement : conservation locale du contexte minimal pour une réconciliation par le serveur ; jamais considérer l'identifiant de commande comme un droit d'accès.

## Invariants
- SecureStore protégé sur l'appareil, pas de bearer dans URL/logs.
- Version, ordre et mutation liée doivent correspondre ; durée maximale de 4h.
- Idempotence du paiement externe et reprise après fermeture obligatoires.
- Drapeau de fonctionnalité OFF tant que la chaîne de commandes et l'API guest n'ont pas leur gate.
- Les comptes Merchant/Courier/Ops et l'expérience déjà publiée restent inchangés.
