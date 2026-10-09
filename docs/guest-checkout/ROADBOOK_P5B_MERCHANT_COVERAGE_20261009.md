# DELISHAFRICA — ROADBOOK P5-B / COUVERTURE LIVRAISON RESTAURATEUR
Date : 9 octobre 2026, Europe/Brussels.
Statut : LABORATOIRE — paiement guest et commandes réelles non disponibles.
Base Git : bd4485c (P5-A, 39 tests), branche isolée `feature/client-guest-coverage-strict-20261009`.
Worktree VPS : `/home/afripayadmin/worktrees/guest-coverage-strict-20261009`.

## Pourquoi cette étape
Le catalogue publié connaît le restaurant et peut annoncer « Bruxelles / Ixelles », des prix et des frais de livraison. Mais aucun champ de zone géographique approuvée ne garantissait un rayon effectivement couvert par **ce restaurateur**. Une adresse Google confirmée n'est pas une garantie de livraison.

## P5-B livré dans la branche seulement
`services/api-nest/src/guest-checkout/guest-merchant-coverage-strict.ts` :
- Lit uniquement le partenaire publié via `CatalogFoundationService.findPublishedBySlug(partnerSlug, [])` (aucun fallback local).
- Exige le partenaire actif, livraison activée, et une configuration explicite `delivery.guestCheckoutCoverage`.
- Configuration v1 : `enabled:true`, `approvedByMerchant:true`, `approvedByOps:true`, zones géographiques avec code, pays, codes postaux, centre GPS et rayon maximum en mètres.
- Le pays, le code postal ET le rayon géographique doivent correspondre à l'adresse résolue serveur.
- Aucun périmètre par défaut; toute absence de configuration, validation ou donnée malformée donne `allowed:false`.
- Protection contre des rayons absents, trop grands, coordonnées incorrectes, défaillance des formats et zones fausses.
- Aucune route API n'est ouverte ni branchée aux paiements réels.

**EXEMPLE DE SCHÉMA À RENSEIGNER PAR LE CATALOGUE APRÈS APPROBATION** (fictif, ne constitue aucune zone réelle) :
```json
{
  "delivery": {
    "enabled": true,
    "guestCheckoutCoverage": {
      "version": 1,
      "enabled": true,
      "approvedByMerchant": true,
      "approvedByOps": true,
      "zones": [{
        "enabled": true,
        "code": "be-merchant-zone-one",
        "countryCode": "BE",
        "postalCodes": ["1050"],
        "center": { "latitude": 50.83, "longitude": 4.37 },
        "maxDistanceMeters": 2500
      }]
    }
  }
}
```
**Cet exemple ne doit PAS être utilisé comme autorisation de production sans validation de la zone réelle du restaurant.**

## Contrôles
- Tests individuels du nouveau validateur : 6/6 PASS.
- TypeScript API : PASS.
- Gate combiné `scripts/da_guest_checkout_p5b_coverage_gate.sh` : rejoue la chaîne P1/P2/P3/P4/P5-A et P5-B sur PostgreSQL isolé + fournisseurs simulés.
- Résultat final attendu : 45/45 tests ; remplir le statut après exécution effective.
- Aucune migration SQL de production, aucun appel bancaire réel, aucune requête Google facturable, aucun rebuild EAS.

## Restant bloquant pour la fluidité demandée
- Configuration approuvée des zones pour les restaurants réels dans la source de vérité catalogue.
- Orchestrateur d'Intent Stripe guest (mode test) avec résilience aux pannes réseau et idempotency key unique.
- Webhook Stripe sur la route réelle, suivi d'une transaction ordre + outbox exploitable par Merchant/Courier.
- Livraison des coordonnées professionnelles sous droits OIDC, sans exposition par ID public.
- Client UI : Mon espace -> Payer -> Suivre, aucune connexion externe imposée, reprises iOS/Android.
- Tests end-to-end et validation RGPD/PCI (les données carte restent exclusivement Stripe).

**Aucun code de production/Store modifié; la couverture test n'est pas une autorisation commerciale réelle.**
