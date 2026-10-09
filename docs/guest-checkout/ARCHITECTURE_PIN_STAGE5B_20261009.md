# DELISHAFRICA — ARCHITECTURE PIN P5-B / COUVERTURE RESTAURATEUR
9 octobre 2026. Laboratoire. Non connectée aux contrôleurs publics.

## Frontière de confiance
- Google Places valide que l'adresse correspond à une entrée précise, mais ne garantit PAS la desserte.
- Catalogue publié valide que le restaurant est actif et delivery.enabled vaut true.
- Ops Coverage Ledger garde les autorisations territoriales approuvées pour chaque restaurant, avec révision, validité et bornes géographiques.
- ServerCoveragePolicy ne lit QUE ces deux sources serveur, jamais un booléen de l'application.
- Si l'une de ces sources est absente, invalide ou indisponible : refusal par défaut.
- La liaison backend vers GuestCanonicalCheckoutStager est démontrée avec PostgreSQL et fournisseurs simulés, mais pas encore branchée au module NestJS en production.

## Flux P5-A + P5-B
```text
Client (panier + Place ID + Mon espace)
 -> Guest capability signed
 -> CatalogOrderPolicyService.quote(cart) (server)
 -> LocationTrustService.resolve(placeId) (server Google Places)
 -> PublishedPartnerCoveragePolicy.verifyCoverage()
      |-- published partner active AND delivery.enabled=true
      |-- approved zone (OPS) in da_guest_merchant_coverage
      |-- partner/country/postcode/lat/lng match, approval not expired/revoked
 -> GuestCheckoutLedger.attachVerifiedQuote()
 -> GuestPrivateFulfillmentVault.seal()
 -> Trigger DB demands encrypted packet before payment
 -> [P5-C Stripe GuestIntent not implemented]
 -> [P5-D Merchant/Courier and secure tracking not implemented]
```

## Approbation Ops (bloquant production)
L'existence d'un champ `approved_by` dans PostgreSQL ne suffit PAS. La future administration des zones doit vérifier les rôles Ops, journaliser les approbations, séparer le droit en écriture du compte applicatif de lecture et contrôler les suspensions.

## Données sensibles
- Code postal et coordonnées envoyés à la policy uniquement pour comparaison, sans conservation dans le ledger des zones.
- Adresses et contact chiffrés séparément dans le coffre GuestPrivateFulfillmentVault.
- Aucun secret Stripe/Places/PG dans Git ni le roadbook.

## QA
8 scénarios P5-B sur PostgreSQL réel : approbation, absence, suspension, révocation, expiration, position hors zone, compte marchand inactif, outage DB, et intégration P5-A.
Gate P5B total 47/47 tests ; TypeScript API et Client conformes.
Prototype laboratoire `127.0.0.1:55438`. Aucun déplacement de zone ni ajout de testeur/transaction réels.

## Suivi
Roadbook: docs/guest-checkout/ROADBOOK_GUEST_CHECKOUT_STAGE5B_20261009.md
Schema: migrations/20261009_guest_merchant_coverage.sql
Policy: services/api-nest/src/guest-checkout/guest-published-partner-coverage.ts
Gate: scripts/da_guest_checkout_stage5b_gate.sh
Branche: feature/client-guest-checkout-p5b-coverage-20261009

### Statut
P5-B lab PASS, paiement Client sans Keycloak NON.
