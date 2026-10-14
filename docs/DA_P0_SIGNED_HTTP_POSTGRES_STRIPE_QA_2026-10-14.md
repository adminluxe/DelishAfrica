# DelishAfrica P0 — Parcours HTTP et PostgreSQL-first en QA

Date : 14 octobre 2026. **Candidat DRAFT uniquement ; aucune activation production.**

## Provenance et CI

Branche `security/p0-pg-first-signed-http-qa-20261014`, issue de DelishAfrica PR #49. Premier SHA vérifié : `a1c0202886f58b27036f042c855bd6659b2530be`.

[GitHub Actions #38631338425](https://github.com/adminluxe/DelishAfrica/actions/runs/38631338425) : **SUCCESS**, contrôles TypeScript, PostgreSQL 17 éphémère et **2 tests d'intégration réussis, 0 échec**. Journal : `QA_SIGNED_HTTP_PG_FIRST_E2E_SYNTHETIC=PASS`.

Fichiers candidats :
- `services/api-nest/test/p0-pg-first-signed-http.pg-qa.integration.cjs` ;
- `.github/workflows/p0-pg-first-checkout-ports-qa.yml`.

## Parcours exercé

Contrôleur NestJS isolé → JWT signé RSA et vérification du rôle Client → admission lue dans le registre PostgreSQL QA → devis calculé côté serveur → transaction SQL commande et panier immuable → réservation financière PostgreSQL → intention de paiement simulée avec clé d'idempotence stable → lecture du statut Client.

Vérifications observées : authentification invalide 401 ; absence d'admission ou rôle étranger 403 ; indisponibilité d'identité 503 ; commande SQL créée avant toute intention ; refus 409 d'identité de commande/devis discordants ; timeout simulé puis reprise de la même intention ; paiement non confirmé sans éligibilité Dispatch ; révocation PostgreSQL et mode production bloquants.

L'ensemble utilise un conteneur PostgreSQL 17 éphémère avec réseau isolé, des identités et preuves de vérification fictives, ainsi qu'un fournisseur simulé local. Aucun réseau fournisseur, aucun paiement réel, aucun déploiement.

## Limites et blocages maintenus

Ce succès ne constitue pas une homologation de Keycloak, des preuves e-mail/SMS réelles, du fournisseur de paiement officiel, des webhooks et remboursements de bout en bout ou des releases Apple. Le runtime VPS utilise encore la séquence antérieure : appel au fournisseur, puis enregistrement PostgreSQL. La PR #48 bloquante reste DRAFT et ne peut être déployée seule.

Restent impérativement interdits : merge non approuvé, migration persistante, mise à jour IAM production, paiement LIVE, payout, build payant, OTA et soumission Store.

## Étape de clôture

Rapprocher App Store Connect et SHA binaires des trois apps ; préparer une preuve QA unifiée de l'inbox webhook, de la réconciliation, de la gestion des remboursements et des droits Merchant/Courier avant tout arbitrage de promotion.
