# DELISHAFRICA — ROADBOOK CANONIQUE GUEST CHECKOUT P5-B
Date: 9 octobre 2026. Lab uniquement, aucune activation d'un parcours public.

## Branche source / coordination
- Branche dédiée: feature/client-guest-checkout-p5b-coverage-20261009
- Worktree: /home/afripayadmin/worktrees/guest-checkout-p5b-20261009
- Base P5-A: bd4485c (39/39 gate sur la préparation canonique du devis)
- Root PROD à préserver: /opt/delishafrica/monorepo (baseline Confluence et finances non committées)

## Nouveau composant
1. `migrations/20261009_guest_merchant_coverage.sql`:
   - table `da_guest_merchant_coverage` tenant des zones de desserte explicites, par partenaire et code postal, avec un rectangle de coordonnées.
   - statuts pending/approved/suspended/revoked; approbation Ops, approbateur, fenêtre de validité, révision; requêtes de recherche indexées.
   - aucun enregistrement Ops publié pour les vraies applications; migration uniquement sur PostgreSQL **lab** 127.0.0.1:55438.
2. `services/api-nest/src/guest-checkout/guest-published-partner-coverage.ts`:
   - `PublishedPartnerCoveragePolicy` implémente `ServerCoveragePolicy` attendu par P5-A.
   - refuse sans partenaire publié, actif et explicitement disponible à la livraison dans le catalogue persistant.
   - refuse toute zone absente, non approuvée, suspendue, révoquée ou expirée.
   - impose correspondance partenaire, pays BE, code postal exact et coordonnées dans rectangle approuvé.
   - aucun fallback statique, pas d'autorisation basée sur un booléen du téléphone; échec de la DB => rejet.
3. `services/api-nest/test/guest-published-partner-coverage.postgres.test.cjs`:
   - 8 nouveaux tests sur PostgreSQL isolé : approbation, absente, expirée, suspendue/révoquée, pays/code/coordonnées, autre partenaire, restaurant désactivé, indisponibilité DB et intégration réelle P5-A (Google Places toujours simulé).
4. `scripts/da_guest_checkout_stage5b_gate.sh` :
   - replay P1 (7), P2 (5), P3 (6), P4 canonique (9), P4 historique (4), P5-A (8), P5-B (8).
   - Total attendu 47/47, typescript Client/API, présence trigger DB et guards OIDC conservés, aucune route guest paiement publique.

## Risques et frontières
- Ne pas présenter le tableau de zones de laboratoire comme des couvertures réelles.
- Approbations Ops et permissions SQL en production doivent être gérées par rôle DB et service audité, **encore à implémenter**. Le fait de stocker approved_by en DB seul n'est pas une preuve d'autorisation.
- Validation Google Places vérifie seulement l'adresse ; la politique de couverture métier est indispensable.
- Belgique/Bruxelles : pilote prudent, pas un blocage définitif international. Les autres pays devront disposer d'authorités de zones spécifiques.
- Stripe Guest createIntent, terminal webhook / projection Merchant & Courier, suivi Client sécurisé restent non branchés.
- Aucune migration ni build en production; aucune transaction Stripe réelle.

## Prochaine étape
P5-C : Stripe Guest PaymentIntent en MODE TEST, idempotence stable, gestion des Intent orphelines sous panne, association ledger P2 + coffre P4 + service couverture, anti-abus multi-instance, puis finalisation P3 sur runtime contrôlé.
P5-D : commandes professionelles durables et suivi invité sous permission, tests de régression 3 apps.
P5-E : UX sans écran Keycloak et QA iOS/Android; aucun build avant gate des paiements et du suivi.

**Vérité : P5-B prouve un contrôle d'éligibilité restaurant en laboratoire, mais n'ouvre PAS les paiements Guest.**
