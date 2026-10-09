# DELISHAFRICA — ARCHITECTURE PIN P5-B / AUTORISATION GEOGRAPHIQUE A DEUX NIVEAUX

**9 octobre 2026 — Laboratoire uniquement, fail closed, aucun paiement actif.**
Branche : `feature/client-guest-coverage-strict-20261009`
Sources : `guest-merchant-coverage-strict.ts`, `guest-coverage-ops-approval-pg.ts`.

## Contrat d'autorisation

```text
Client : panier, placeId, coordonnées et consentement
         |
Catalogue serveur : vrais prix, stock et horaires
         |
Google Places côté serveur : adresse précise et codes postaux
         |
GuestMerchantCoverageStrict
  ├─ partenaire PUBLIÉ et ACTIF, livraison enabled
  ├─ contrat v1 validé par marchand (revision positive)
  ├─ zone enabled, BE, code postal correspondant, GPS dans rayon autorisé
  ├─ empreinte SHA-256 {partnerSlug, revision, toutes les zones normalisées}
  └─ PostgresGuestCoverageOpsApprovals (SELECT seulement)
       └─ registre Ops SÉPARÉ : digest identique, non révoqué, non expiré
       └─ PAS de preuve : REFUS, aucune exception automatique
         |
GuestCheckoutLedger : devis immuable
         |
GuestPrivateFulfillmentVault : dossier AES-256-GCM complet
         |
DB trigger : jamais PAYMENT_PENDING sans dossier chiffré
         |
Stripe Guest PaymentIntent : NON BRANCHÉ EN P5-B
         |
Payment/Order commit, Merchant/Courier, suivi : NON BRANCHÉS
```

## Rôle de la preuve Ops indépendante

Un attribut `approvedByOps:true` dans un JSON modifiable par un marchand est insuffisant. La décision exige une entrée `da_guest_coverage_ops_approvals`, accessible en lecture seule au checkout. Un *vrai* administrateur Ops doit la signer par un workflow métier sous OIDC/RBAC et journalisation avant la production. Modifier le rayon, la révision ou les codes postaux entraîne un nouveau digest et invalide l'autorisation précédente.

Le service refuse également si la base Ops est indisponible, ou si une approbation est expirée/révoquée. Il n'existe aucun accès implicite basé sur un libellé marketing.

## Frontières techniques

- `PublishedCatalogReader.findPublishedBySlug(slug, [])` : aucun partenaire de démonstration de repli.
- `IndependentOpsCoverageApprovals.isApproved()` : contrat à deux clés `partnerSlug` et `coverageDigestSha256`.
- `PostgresGuestCoverageOpsApprovals` : SELECT parametré, aucun accès d'écriture exposé au client.
- `guestCheckoutCoverage` : seul contrat v1/révision, zone active, rayon de 100 à 25 000 mètres, pays BE, code postal et centre GPS valides.
- Le permis de livraison effectif est `merchant coverage ∧ separate Ops approval`.
- Aucun déploiement, aucun nouveau build, aucune migration de production.

## Preuves et jalon

Gate `scripts/da_guest_checkout_p5b_coverage_gate.sh` : **52/52 PASS**, API+Client TypeScript PASS, guards OIDC conservés. Base réelle **de laboratoire**, données Stripe/Google simulées. Preuve : `/tmp/da_guest_p5b_coverage_gate_secure_20261009.log`.

Roadbook : `docs/guest-checkout/ROADBOOK_P5B_MERCHANT_COVERAGE_20261009.md`.

**L'autorisation Ops réelle et la publication du Guest Checkout restent à réaliser dans les étapes ultérieures.**
