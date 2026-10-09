# DELISHAFRICA — DECISION D'INTEGRATION : DEUX COFFRES P4
Date : 09 octobre 2026, après audit des commits 1427703 et 2dc2bc7.
**Important : les deux implémentations sont en laboratoire et ne sont exposées par aucune route publique.**

## Chevauchement constaté
Le commit `1427703`, développé dans le worktree
`/home/afripayadmin/worktrees/guest-client-ux-20261009`, a ajouté :
- `guest-delivery-vault.ts` : calcul du devis via une politique serveur et chiffrement du contact + stockage atomique dans `da_guest_order_context`.
- `20261009_guest_delivery_context.sql` : table isolée d'enregistrement.
- `guest-delivery-vault.postgres.test.cjs` : quatre tests sur PostgreSQL isolé.
Ce code, indépendant, ne lie pas directement un paiement ni Merchant/Courier ; sa conservation apporte un précieux outil de qualification de devis.
Le commit `2dc2bc7` a apporté :
- `guest-private-fulfillment-vault.ts` : chiffrage **du dossier complet** (devis canonique, éléments, client, adresse, allergies/consignes, vérification zone, consentement), key ID et contrôle AEAD.
- `20261009_guest_fulfillment_vault.sql` : registre protégé + trigger DB interdisant PAYMENT_PENDING sans dossier complet.
- `guest-paid-fulfillment-preparer.ts` : création transactionnelle de la préparation après capture, sans diffusion Merchant.
- `guest-fulfillment.postgres.test.cjs` : neuf tests Postgres.

## DECISION CANONIQUE POUR P5
**Chemin canonique à brancher à l'API :**
1. `CatalogOrderPolicyService.quote(cart)` : valide prix, quantité, jour, restaurant.
2. Vérification véritable côté serveur de la zone d'adresse (service à développer; ne jamais accepter un simple booléen donné par le client).
3. `GuestCheckoutLedger.issue()` et `attachVerifiedQuote()` : met la session en QUOTED avec montant et fingerprint figés.
4. `GuestPrivateFulfillmentVault.seal()` : attache le dossier COMPLET chiffré (pas seulement le contact) et permet reprise idempotente.
5. Le trigger PostgreSQL empêche `PAYMENT_PENDING` sans ce scellement.
6. Une fois Stripe confirmé par P3, `GuestPaidFulfillmentPreparer.preparePaidOrder()` prépare sous transaction, mais la publication Merchant/Courier reste un P5 à implémenter.

**Chemin `GuestCheckoutQuoteContext` (`guest-delivery-vault.ts`) :**
- **conservé comme alternative de laboratoire et preuve historique** ; tests à maintenir.
- NON ACTIVÉ dans le parcours API canonique pour éviter double stockage PII, ambiguïté des clés et divergence des fingerprints.
- Son principe de calcul de devis serveur et transaction atomique sert de référence lors de l'écriture du futur orchestrateur canonique; ne pas dupliquer les tables.

## Sauvegarde de l'historique
Les notes du commit 1427703 ont été restaurées intégralement sans les écraser :
- `docs/guest-checkout/history/ROADBOOK_P4_ATOMIC_DELIVERY_CONTEXT_1427703.md`.
- `docs/guest-checkout/history/ARCHITECTURE_PIN_P4_ATOMIC_DELIVERY_CONTEXT_1427703.md`.

## Vérifications et risques résiduels
- P1: 7 tests.
- P2: 5 tests.
- P3: 6 tests après scellement.
- P4 canonique: 9 tests.
- P4 alternatif: 4 tests après adaptation du TRUNCATE aux nouveaux FK du laboratoire.
- Total attendu : **31/31 tests** dans le gate P4 consolidé.
- Aucun déclencheur de débit, aucune persistance production, aucune route de suivi invité ni émission Merchant/Courier autorisée.
- Le chiffrement du dossier ne dispense pas d'une politique de rétention, rotation des clés, effacement RGPD et gestion du droit de suivi.
- Le service de validation géographique doit être réellement implémenté avant paiement : une simple déclaration Client ou booléen transmis par le téléphone ne suffit pas.
- Avant toute publication, introduire un adaptateur sécurisé vers le registre des commandes métier, et vérifier sur appareils iOS/Android la commande sans connexion Keycloak.

**Règle : UNE commande, UN devis canonique, UN dossier PII chiffré, UN PaymentIntent, UN commit financier, UNE préparation, UNE transmission autorisée.**
