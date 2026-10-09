# DELISHAFRICA — ARCHITECTURE PIN / P5-B COUVERTURE RESTAURANT
Date : 09/10/2026 • Laboratoire uniquement, pas de paiement invité activé.
Source : `services/api-nest/src/guest-checkout/guest-merchant-coverage-strict.ts`
Branche : `feature/client-guest-coverage-strict-20261009`.

## Frontière de confiance
```text
App Client (panier, Place ID, contact) --sans montant autoritaire-->
    CatalogOrderPolicyService : prix et disponibilité
    LocationTrustService.resolve() : adresse géocodée server-side
    GuestMerchantCoverageStrict : PARTENAIRE PUBLIE + ACTIF
        └── delivery.enabled = true
        └── delivery.guestCheckoutCoverage.version = 1
        └── enabled + approvedByMerchant + approvedByOps = true
        └── zone.enabled + countryCode + postalCodes + centre GPS
        └── distance réelle ≤ maxDistanceMeters [100, 25000]
                 └── REJET PAR DEFAUT SANS REGLE APPROUVEE
    GuestCheckoutLedger.attachVerifiedQuote()
    GuestPrivateFulfillmentVault.seal() AES-256-GCM
    [P5-C NON BRANCHE] Stripe PaymentIntent
    [P3] Webhook signé / capture / transaction PG
    [P4] Order privé préparé
    [P5-D NON BRANCHE] projection Merchant/Courier
    [P5-E NON BRANCHE] suivi privé Client
```

## Autorisations
Le libellé marketing « Bruxelles / Ixelles », des frais de livraison, un code postal Google confirmé, ou une localisation approximative ne suffisent JAMAIS.
L'accès est accordé uniquement depuis le *catalogue de partenaires publiés* et une zone explicite approuvée à la fois par le restaurant et les opérations.
Le schéma de zone est prévu, mais **aucune autorisation concrète n'a été créée ou déployée**. Sans zone renseignée, le système refuse le Guest Checkout.

## Preuves
6 tests ciblés couvrant zone approvée, absence de règle, statut suspendu, approbation manquante, rayon dépassé, données malformées, injections de champs.
Gate P5B cumulatif : `FINAL_DA_GUEST_P5B_COVERAGE_GATE=PASS` ; 45/45 tests, TypeScript API et Client conformes.
Les épreuves P3/P4/P5-A utilisent PostgreSQL 16 isolé et Stripe/Google simulés.
Production, API, stores, compte bancaire et déploiements inchangés.

## Critère de la prochaine phase
Mettre en place la saisie validée des zones professionnelles dans le catalogue, sous les permissions Merchant + Ops, avant tout déclenchement d'un paiement.
Le service strict n'autorise aucune livraison de lui-même sans configuration métier.
