# DELISHAFRICA — ROADBOOK GUEST CHECKOUT : PALIER 4
**Date :** 09 octobre 2026, Europe/Brussels
**Statut :** laboratoire en branche de développement, aucun paiement ni déploiement production
**Branche :** feature/client-guest-checkout-secure-20261009
**Point de départ :** P3 au commit 93a2d168e9adf85f11a5b8a0a5dd7840d1fe9aeb

## Objectif P4
Remplacer l'obligation de maintenir le téléphone ouvert après Stripe par une préparation de commande durable côté serveur, sans stocker en clair les coordonnées personnelles. Préparer les données nécessaires aux interfaces professionnelles sans les y publier prématurément.

## Analyse du système existant
Le client utilise actuellement `checkout-preflight.tsx` et `daOrdersFetch` avec un principal OIDC, puis envoie les coordonnées et un récapitulatif dans `POST /orders/demo/create` après paiement. Le stockage existant `orders.demo.store.ts` écrit aussi des fichiers JSON de démonstration ; un module financier PostgreSQL non committé les réplique dans `da_orders_state`.
**Ne pas copier des dossiers d'invités dans ces structures directement** tant que leur autorisation et leur chiffrement n'ont pas été réconciliés.

## Ce qui est codé
1. `migrations/20261009_guest_fulfillment_vault.sql`
   - table `da_guest_fulfillment_vault` : blob AES-256-GCM, nonce aléatoire, tag de 16 octets, MAC et clé versionnée ; aucune colonne portant adresse, e-mail, téléphone, allergies ou mot de passe en clair.
   - table `da_guest_fulfillment_prepared` : préparation de l'ordre payé, liaison unique avec identifiant Stripe ; **ne constitue pas une publication Merchant ni un dispatch Courier**.
   - fonction + trigger PostgreSQL `da_guest_payment_fulfillment_gate` : interdit toute transition vers payment_pending/paid/committed sans dossier chiffré scellé correspondant au même devis. L'obstacle reste actif même si un futur code HTTP oublie le contrôle.
   - migration **appliquée uniquement au PostgreSQL lab 127.0.0.1:55438**, jamais à production.
2. `services/api-nest/src/guest-checkout/guest-private-fulfillment-vault.ts`
   - contrôle du devis canonique serveur (items, prix, somme, partenaire, empreinte), des coordonnées nécessaires à la livraison et du consentement.
   - exige un résultat d'éligibilité de livraison fourni par un validateur serveur autorisé. **Un validateur réel reste à brancher ; aucun endpoint public ne peut fournir ce booléen.**
   - scelle les informations dans AES-256-GCM à clé séparée de la signature guest, AAD incluant ordre et empreinte du devis ; empreinte du jeton et non jeton brut stockée dans DB ; prise en charge prévue de rotation de clé par key ID.
   - la seconde soumission identique est idempotente ; un dossier modifié est rejeté.
   - le déchiffrement est limité à un appel interne du serveur, non relié aux routes Client ni Merchant.
3. `services/api-nest/src/guest-checkout/guest-paid-fulfillment-preparer.ts`
   - relit sous verrou PostgreSQL le paiement *déjà confirmé* par P3 ainsi que le dossier chiffré.
   - compare l'identité de commande, le montant/devise/empreinte, déchiffre et contrôle le paquet complet.
   - crée `da_guest_fulfillment_prepared` et passe une outbox financière du statut `pending_fulfillment_data` à `ready` dans une transaction unique ; rollback intégral en cas de panne.
   - ne renvoie que des identifiants/états non personnels et ne déclenche aucun transport ni commande professionnelle.
4. `services/api-nest/test/guest-fulfillment.postgres.test.cjs`
   - 9 scénarios réels PostgreSQL avec paiement Stripe simulé : protection PII, refus consentement/adresse non vérifiée/prix incohérent, nécessité de paiement confirmé, huit préparations concurrentes, altération du chiffré, panne + rollback, session expirée, sessions croisées, interdiction DB d'Intent sans dossier.
5. `services/api-nest/test/guest-stripe-finalizer.postgres.test.cjs`
   - fichier **complet mis à jour** pour sceller une livraison de laboratoire avant de lier chaque paiement ; les six tests P3 restent verts avec le trigger P4.
6. `scripts/da_guest_checkout_stage4_gate.sh`
   - vérification globale P1/P2/P3/P4, Postgres isolé, guards existants conservés, absence de branchement HTTP public, TypeScript API + Client.

## Vérifications
- P1 : 7/7 PASS.
- P2 : 5/5 PASS.
- P3 : 6/6 PASS après introduction du trigger P4.
- P4 : 9/9 PASS.
- Total attendu dans le gate : **27/27**.
- PostgreSQL réellement exécuté en laboratoire; **Stripe simulé**; aucune requête live de paiement.
- Les anciennes migrations, ordres marchands et consoles Stores ne sont pas modifiés.

## Prochain verrou (P5)
- Créer la passerelle canonique `CatalogOrderPolicyService` + calcul serveur des zones de livraison + anti-abus partagé.
- Créer Stripe Guest PaymentIntent avec idempotence, figer le dossier AVANT ouverture de paiement, enregistrer l'intention, gérer Intent orphelin si panne.
- Brancher la vérification webhook signée et reconciliation durable sur le vrai runtime API, en évitant l'ancien handler de démo.
- Déterminer projection sécurisée Merchant/Courier des commandes invitées, sous autorisation professionnelle existante, sans contourner leurs guards, et sans double création dans `orders.demo.store`.
- Protéger l'accès au suivi de commande via token distinct, rotation/expiration et récupération.
- Rendre `Mon espace` suffisant côté mobile Client seulement lorsque tous les appels de paiement/ordre sans Keycloak disposent d'une voie serveur autorisée.
- Tests réel Stripe en **mode test** uniquement, E2E Client/Merchant/Courier, crash et retries, RGPD, accessibilité, store review.
- Ne pas activer d'OTA, de migration production ou de build payant avant gate P5.

**Décision à ce stade : P4 fondation technique validable, checkout invité FINI = NON.**
