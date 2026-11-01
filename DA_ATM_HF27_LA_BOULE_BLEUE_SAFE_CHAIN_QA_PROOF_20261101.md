# HF27 — La Boule Bleue — Reprise contrôlée, chaîne HTTP QA et HOLD de production
**Date :** 2026-11-01 UTC / Bruxelles, suite à HF26. **QA ONLY** — aucune mutation de production, aucun paiement réel, aucun nouveau build EAS, aucune attribution IAM artificielle.

## Réalité observée en production : lecture seule VPS via Toshiba

- Partenaire : `la-boule-bleue` — fiche publique `GET /api/v1/partners/la-boule-bleue` HTTP 200 ; ville Ixelles.
- BD `da_catalog_partners` : `lifecycle_status=published`, `published_payload.status=pending_verification`, `acceptingOrders=false` ; 2 révisions publiées, aucun draft courant.
- Catalogue public : 46 références dans 6 catégories, prix renseignés pour 46/46 ; livraison paramétrée `enabled=true` en zone Bruxelles/Ixelles. **Delivery enabled ne signifie pas commande ouverte.**
- Ownership : 1 attribution `owner` active ; 1 membership lié au **même sujet** et à l'issuer Keycloak canonique ; aucune révocation/expiration détectée. **Statuts métier : membership=pending, contract=pending, kyb=pending**. Ce sont des conditions HOLD, non des permissions accordées.
- Production : **une commande du 2026-10-26**, `da_orders.status=pending`, `da_orders_state.status=pending`, un événement `pending`. Aucune consultation de son identifiant ni de coordonnées client; aucune mutation et aucune interprétation non prouvée de son origine.
- API OIDC et routes protégées : health 200 ; sans Bearer, `auth/merchant/me` et `merchant/catalog/me` 401 attendus.
- Emails d'onboarding vérifiés en lecture seule : demandes sortantes 2026-09-28 et 2026-10-21 de visuels/encodage/rencontre ; aucun contrat ou KYB signé prouvé par ces emails. La recherche dans les deux boîtes connectées ne permet pas de certifier qu'aucune réponse n'existe ailleurs. Aucun secret ni identité personnelle exporté.
- **DÉCISION OPÉRATIONNELLE : ne pas passer le partenaire à `active`, ne pas changer `acceptingOrders` ni le membership/contrat/KYB avant preuve d'habilitation et autorisation commerciale.** La demande de réactivation est prise en charge comme préparation en QA.

## Test HTTP QA HF27 — parcours unifié (identité synthétique, vrai code Nest)

- Fichier : `services/api-nest/test/hf27-la-boule-bleue-chain.qa.test.cjs`.
- Vraies classes serveur : `OrdersController`, `OrdersAuthGuard`, `OrdersAccessService`, `CatalogOrderPolicyService`, `OrdersDispatchService`, `CourierPresenceService`, `AuthService`, `ExternalJwksVerifierService`.
- Serveur HTTP sur `127.0.0.1:0`, JWT RS256 signés en mémoire avec RSA éphémère. Un seul identifiant QA aléatoire `HF27-QA-LBB-...` suivi sans perte d'identité/tenant.
- Catalogue/ownership et événements de test en mémoire et fichiers temporaires OS isolés, nettoyés à la fin. L'article de menu et le montant sont **synthétiques** ; **aucune** commande de production, livraison, donnée client, DB, Stripe ou OrchidPay. Paiement simulé explicitement par double QA et contrôle de révocation Redis doublé en QA : aucune certification de paiement ni de Redis LIVE.
- Négatifs : sans Bearer 401, rôle Merchant non autorisé à créer 403, partenaire `pending_verification` refusé 400, partenaire `active` mais `acceptingOrders=false` refusé 400, client étranger 404, Merchant étranger 403, coursier non assigné sans offre.
- Positifs QA : activation **uniquement en mémoire** pour ce test, création Client 201, réexécution idempotente sans doublon, lecture Merchant, transition `pending → accepted → ready`, présence Courier Ixelles/Bruxelles, offre système, acceptation, `picked_up → delivered`, puis même orderId/slug/état `delivered` vérifiés depuis les rôles Client/Merchant/Courier/Ops.
- Test du double verrou : **RED démontré** avant patch (`status=active`, `acceptingOrders=false` acceptait une création HTTP 201) ; correction QA `catalog-order-policy.service.ts` maintenant rejette `acceptingOrders === false` sans changer les partenaires legacy qui n'ont pas le champ. **GREEN** après patch. Aucune promotion du changement sur runtime.
- Compatibilité Windows : `orders.demo.store.ts` ouvrait le fichier temporaire en mode `r` puis `fsyncSync`, entraînant `EPERM` Windows; modification QA du handle `r+` avant fsync, conservant l'écriture atomique. Ce point n'est pas une preuve de panne de production Linux.
- `tsc -p services/api-nest/tsconfig.json --incremental false` EXIT 0, test ciblé HF27 **1/1 GREEN**. Suite intégrale backend à consigner à son achèvement.

## Gates à lever avant une vraie commande pilote

1. **Identité contractuelle** : preuve KYB vérifiée, contrat actif et autorisation du responsable légitime, membership relié au propriétaire actif; aucune élévation automatique dans le realm partagé.
2. **Commande historique** : résoudre explicitement la commande encore `pending` selon provenance et besoins du demandeur; ne pas la modifier dans le cadre de cette recette.
3. **QA runtime** : vérification HF25/HF27 dans Ataraxie isolée après revue; protéger le backend partagé. L'ancien code de sélection multi-audience est encore dans les runtimes.
4. **Appareils** : vérifier TestFlight XR 400017 et Android physique ; confirmer Client→Merchant→Courier→ATM avec un identifiant **réel** après disponibilité autorisée.
5. **Finances** : Shadow uniquement; aucune capture/payout/Stripe LIVE ou état simulé présenté comme attesté.
6. **Release** : pas de merge, pas de push Store, pas de build EAS supplémentaire, réserves POG #56/#57 OPEN.

**Verdict :** chaîne HTTP serveur intégrée QA prouvée et double verrou réparé localement ; La Boule Bleue est **préparée**, **pas réactivée publiquement**. Contrat, KYB, membership, authentification iPhone réelle, runtime QA et recette physique demeurent HOLD.
