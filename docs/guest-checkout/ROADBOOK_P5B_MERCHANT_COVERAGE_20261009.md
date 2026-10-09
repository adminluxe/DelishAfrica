# DELISHAFRICA — ROADBOOK P5-B : COUVERTURE RESTAURANT ET APPROBATION OPS INDÉPENDANTE

**Date :** 9 octobre 2026 (Europe/Brussels)
**État :** SÉCURITÉ P5-B VALIDÉE EN LABORATOIRE • GUEST CHECKOUT NON LIVRÉ
**Branche :** `feature/client-guest-coverage-strict-20261009`
**Worktree VPS :** `/home/afripayadmin/worktrees/guest-coverage-strict-20261009`
**Base P5-A :** `bd4485c` — 39 tests préexistants.

## 1. Problème traité

Une adresse géocodée par Google Places et l'intitulé marketing « Bruxelles / Ixelles » ne garantissent pas que **le restaurateur concerné peut effectivement livrer**. De plus, un champ `approvedByOps: true` dans un objet de catalogue potentiellement éditable par le marchand n'est PAS une preuve d'approbation par les opérations.

La règle est désormais : **aucune commande invitée n'est autorisée sans zone active, approuvée par le restaurant ET attestée par un registre Ops indépendant.**

## 2. Fichiers complets ajoutés ou corrigés

- `services/api-nest/src/guest-checkout/guest-merchant-coverage-strict.ts` : vérifie le partenaire publié et actif, livraison activée, contrat de zone v1/révision, pays, code postal, centre GPS, rayon, et empreinte d'approbation Ops.
- `services/api-nest/src/guest-checkout/guest-coverage-ops-approval-pg.ts` : lecteur PostgreSQL **lecture seule**, aucun endpoint de création/révocation.
- `migrations/20261009_guest_coverage_ops_approvals.sql` : table Ops privée `da_guest_coverage_ops_approvals`, couple `partner_slug + coverage_sha256`, date limite et révocation.
- `services/api-nest/test/guest-merchant-coverage-strict.test.cjs` : 8 tests du validateur.
- `services/api-nest/test/guest-coverage-ops-approval.postgres.test.cjs` : 5 tests réels PostgreSQL sur approbation, modification du périmètre, révocation et expiration.
- `scripts/da_guest_checkout_p5b_coverage_gate.sh` : script consolidé P1 → P5-B et vérifications API/Client.

## 3. Contrat de couverture v1

Une zone proposée par un restaurant contient, dans `delivery.guestCheckoutCoverage`, `version=1`, une `revision` positive, `enabled=true`, `approvedByMerchant=true`, et des zones avec `code`, `countryCode`, `postalCodes`, `center.latitude/longitude`, `maxDistanceMeters`, `enabled`.

L'empreinte SHA-256 porte sur **le partenaire, la révision et toutes les règles de la couverture normalisée**. Toute variation entraîne une empreinte différente. Le booléen `approvedByOps` éventuellement présent dans le catalogue est **ignoré comme preuve d'autorisation**.

Une seconde source de vérité, non modifiable par le marchand, doit avoir inscrit cette empreinte, autorisée par un compte Ops réellement authentifié, non révoquée et non expirée.

L'absence de configuration ou de preuve Ops entraîne un refus, même si le restaurant paraît ouvert et si l'adresse est à Bruxelles.

## 4. Contrôle financier et sécurité

- Les montants du téléphone ne font jamais autorité ; prix et produits proviennent du catalogue serveur.
- Google Places confirme l'adresse, puis l'autorisation de desserte du restaurateur est évaluée séparément.
- Le client ne peut écrire aucune approbation Ops depuis un endpoint public.
- La base de production n'a reçu **aucune migration**. La table et les tests ont été exécutés exclusivement sur PostgreSQL 16 isolé `127.0.0.1:55438`.
- Avant déploiement : créer un workflow **Ops RBAC + journal d'audit**, rôles PostgreSQL distincts avec `SELECT` pour le checkout et `INSERT/UPDATE` uniquement pour le service Ops. L'inscription test en laboratoire ne vaut PAS une approbation réelle.
- Aucun Stripe réel, aucune requête Google facturable, aucun build EAS ni OTA.

## 5. Résultats d'exécution

- 12 tests P1/P2 : PASS.
- 6 tests P3 financière : PASS (vrai PostgreSQL, Stripe simulé).
- 9 tests P4 coffre canonique : PASS.
- 4 tests P4 coffre historique : PASS.
- 8 tests P5-A devis/adresse : PASS.
- 8 tests P5-B couverture stricte : PASS.
- 5 tests P5-B registre Ops indépendant PostgreSQL : PASS.

**Total : 52/52 tests.** Script : `FINAL_DA_GUEST_P5B_COVERAGE_GATE=PASS` avec code retour 0. TypeScript API/Client PASS, anciens guards OIDC Payments/Orders conservés. Log VPS : `/tmp/da_guest_p5b_coverage_gate_secure_20261009.log`.

## 6. Conditions manquantes avant tout checkout invité public

1. Zones et approbations réelles des restaurants, créées par un processus Ops indépendant et audité.
2. Couverture canonique branchée avec CatalogOrderPolicyService et LocationTrustService dans l'API.
3. Session invitée et anti-abus partagé entre serveurs.
4. PaymentIntent Stripe en **mode test** avec idempotence, récupérabilité après perte de connexion, webhook signé et réconciliation.
5. Persistance durable de la vraie commande, diffusion autorisée Merchant/Courier et suivi client privé, sans doublons.
6. Client : `Mon espace → Payer → Suivre` sans Keycloak obligatoire, puis tests sur appareils iOS/Android.
7. Audit de sécurité, RGPD, droits, alertes et stratégie de rollback avant mise en production.

**État exact : P5-B sécurité démontrée ; Guest Checkout final NON ENCORE DISPONIBLE.**
