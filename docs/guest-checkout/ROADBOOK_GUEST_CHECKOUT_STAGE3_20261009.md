# DELISHAFRICA — ROADBOOK GUEST CHECKOUT P3 : FINALISATION FINANCIÈRE LAB
Date : 09/10/2026. Statut : CODE TESTÉ EN ENVIRONNEMENT ISOLÉ — NON BRANCHÉ, NON PUBLIÉ.
Branche officielle : feature/client-guest-checkout-secure-20261009.
Base préalable : 0d89260714aae1756a5be545ec15eb74692452e1 (P1/P2).

## Mission
Garantir qu'un paiement invité ne dépend pas du téléphone pour sa réception côté serveur. **Conserver** tous les contrôles Stripe et les restrictions Merchant/Courier/Ops. Préserver les versions iOS/Android en examen.

## Contrats étudiés
- `services/api-nest/src/payments/payments.service.ts` : récupère Stripe PaymentIntent + latest_charge, vérifie montant, métadonnées et charge capturée, non remboursée/non disputée.
- `services/api-nest/src/stripe/stripe-webhook.controller.ts` : transmet au handler Stripe existant une requête signée. Ce handler conserve l'événement mais ne crée pas automatiquement une commande.
- `services/api-nest/src/orders/orders.access.service.ts` : `secureCreateInput` exige aujourd'hui le principal Keycloak et la preuve de paiement. Protections NON modifiées.
- Module `financial-state` PostgreSQL actif non commité : préservé, snapshot déjà scellé par P2 (voir roadbook P2).

## Codé en P3 (hors production)
1. `services/api-nest/src/guest-checkout/guest-stripe-financial-finalizer.ts` :
   - exige un corps de webhook Stripe brut et une signature HMAC SHA-256 récente (tolérance 5 min, comparaison constante).
   - ignore les événements non pertinents ; ne fait jamais confiance au montant du webhook.
   - redemande au serveur Stripe le PaymentIntent avec sa charge étendue ; compare ID, montant, devise, capture complète, absence de remboursement/dispute, statut succeeded, environnement test/live et toutes les métadonnées de liaison avec la session guest.
   - verrouille la session par `SELECT ... FOR UPDATE`, écrit l'enregistrement financier et une outbox minimaliste dans une **transaction PostgreSQL** ; rollback en cas d'erreur.
   - supporte répétitions et concurrence : une seule écriture, un seul événement outbox ; permet une réconciliation interne si le webhook est manqué, même après expiration du jeton mobile.
   - ne met aucune commande en livraison et n'appelle aucun contrôleur HTTP en P3.
2. `migrations/20261009_guest_verified_payment.sql` :
   - tables additives `da_guest_verified_payments` et `da_guest_financial_outbox`, uniques par commande ; aucune PII.
   - état explicite `confirmed_fulfillment_pending` / `pending_fulfillment_data` : **paiement confirmé NE SIGNIFIE PAS commande expédiable**.
   - migration appliquée seulement à la base de laboratoire créée pour les tests. **Jamais appliquée à la base de production**.
3. `services/api-nest/test/guest-stripe-finalizer.postgres.test.cjs` :
   - intégration sur **vrai PostgreSQL 16 isolé** et lecteur Stripe simulé, aucune requête bancaire réelle.
   - test de signature, métadonnées fausses, charge remboursée, sous-capture, huit webhooks concurrents, rollback transactionnel et reprise après app/session expirée.
4. `scripts/da_guest_checkout_stage3_gate.sh` :
   - rejoue P1/P2, tests P3 sur base isolée, typechecks et contrôle que le finalizer n'est pas branché aux endpoints publics.

## Incident et résolution du test
Le premier test d'expiration a échoué car le test modifiait `expires_at` vers une date antérieure à `created_at`, en violation d'une contrainte de sécurité valide. Corrigé en vieillissant conjointement `created_at` et `expires_at`. Aucun affaiblissement SQL.

## Résultat technique vérifié
- Tests P1 = 7/7 PASS.
- Tests P2 = 5/5 PASS (simulation SQL).
- P3 = 6/6 PASS sur PostgreSQL isolé, après correction du scénario d'expiration.
- API TypeScript : PASS.
- Environnement : base test locale dédiée `127.0.0.1:55438`, cluster séparé `/home/afripayadmin/guest-checkout-evidence-20261009/pg-lab-p3`. NE PAS utiliser la connexion de production.
- Important : les tests Stripe utilisent **des réponses simulées**, pas de vrai débit ni de vraie requête vers Stripe. Le code n'est pas encore connecté au webhook d'API de production.

## Porte P4/P5 indispensable
- Véritable session client + devis catalogué + PaymentIntent guest générés par le serveur (aucun prix reçu du téléphone comme autorité).
- Capture du panier et coordonnées de livraison dans un stockage chiffré, sans fuite dans le jeton.
- Passage vers les tables de commandes réelles et notification Merchant/dispatch UNIQUEMENT quand les données de livraison fiables sont disponibles ; transaction d'outbox ou orchestration durable.
- Ajout dans Nest des handlers guest explicitement séparés, anti-abus distribué, authentification pro inchangée.
- Intégration mobile Client : panier -> Mon Espace -> invité -> Stripe -> suivi, sans Keycloak forcé.
- Tests avec vrai Stripe **mode test**, puis QA 3 apps, tests négatifs P0, puis validation de publication. Aucune activation en production avant cela.

**ÉTAT VRAI : sécurité de finalisation FINANCIÈRE simulée et transaction PostgreSQL réelle prouvée ; Guest Checkout côté client PAS ENCORE DISPONIBLE.**
