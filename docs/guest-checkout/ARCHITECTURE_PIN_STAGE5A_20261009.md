# DELISHAFRICA — ARCHITECTURE PIN P5-A / DEVIS ET TERRITOIRE
09/10/2026 • Feature `feature/client-guest-checkout-p5-20261009`
**Laboratoire uniquement, pas de paiement ni de commande réelle.**

## Nouveau point d'entrée métier interne
```text
[Mobile Client: Mon espace + panier]
             |
[Jeton guest signé P1 déjà créé par serveur, hash DB P2]
             |
[GuestCanonicalCheckoutStager.prepare()]
  |-- vérifie guest actif AVANT Google
  |-- extrait partnerSlug, ID produits, quantités uniquement
  |-- CatalogOrderPolicyService.quote() : prix réel / catalogue
  |-- LocationTrustService.resolve(Place ID) : Google Places lu côté API
  |-- exige BE + code postal zone pilote Bruxelles + adresse de précision forte
  |-- ServerCoveragePolicy.verifyCoverage(partner + coordonnées)
  |-- substitue l'adresse fournie par Google à celle déclarée par l'app
             |
[GuestCheckoutLedger.attachVerifiedQuote()]
             |
[GuestPrivateFulfillmentVault.seal()]
             |
[Postgres trigger: PAYMENT_PENDING interdit sans dossier chiffré]
             |
[PAIEMENT NON BRANCHÉ EN P5-A]
```

## Séparation autorités
- App : sélection produits, contact, consentement, Place ID. **Aucune autorité sur le prix ou la desserte.**
- Catalogue API : prix, horaires, quantités, minimum, disponibilité.
- Google Places (via service LocationTrust du backend) : géocodage et preuve de bâtiment.
- Politique réelle de desserte Merchant : à implémenter pour chaque restaurant (aucun droit via simple code postal).
- PostgreSQL : devis figé, dossier privé chiffré, jeton haché, trigger de livraison.
- Stripe : seulement après branchement contrôlé P5-B et tests du webhook P3.
- Pro : rôle OIDC Merchant/Courier/Ops toujours requis.

## Cas limites et sécurité
- Si Google Places ne répond pas, ne pas retomber silencieusement sur une adresse libre déclarée par le téléphone.
- Si le devis ou les données personnelles sont modifiés après scellement, rejeter et demander un nouveau panier/session.
- Si l'app s'arrête après QUOTED et avant le coffre, permettre retry idempotent ; le trigger interdit toute capture sans coffre.
- Ne pas confondre `verifiedByServer` (type interne) avec une preuve venue du mobile.
- Le périmètre Bruxelles est un garde-fou pilote, pas une promesse commerciale générale ni un modèle mondial.
- Ne pas conserver deux copies PII des modules P4 concurrents (voir `CONSOLIDATION_P4_DEUX_COFFRES.md`).

## État
Source : `services/api-nest/src/guest-checkout/guest-canonical-checkout-stager.ts`.
Tests : `services/api-nest/test/guest-canonical-checkout.postgres.test.cjs`.
Gate : `scripts/da_guest_checkout_stage5_gate.sh`.
Roadbook : `docs/guest-checkout/ROADBOOK_GUEST_CHECKOUT_STAGE5A_20261009.md`.
Aucun test du vrai provider Google n'a été lancé dans cette phase, les clients de test injectés sont simulés.
