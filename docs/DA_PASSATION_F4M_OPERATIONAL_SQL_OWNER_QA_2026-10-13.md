# DELISHAFRICA® — PASSATION F4M / PROPRIÉTAIRES SQL SANS SUPERUSER

**13 octobre 2026 | PR #45 DRAFT | QA GitHub Actions éphémère | STRICTEMENT NON-PRODUCTION**

> Toutes les personnes, organisations, commandes, comptes, montants, KYB/KYC, contrats et autorisations dans les tests sont **synthétiques**. PostgreSQL 17 et Keycloak 26.4.7 sont des logiciels réellement exécutés dans des conteneurs temporaires ; ils ne représentent pas les instances officielles de DelishAfrica®.

## 1. Source de vérité / reprise

- Dépôt : `adminluxe/DelishAfrica`.
- Parent **F4L certifié** : [PR #44 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/44) ; SHA `27faa871e3f18df0f3ca2e254de484352b8d93c9`.
- Trois CI SUCCESS sur le **même SHA F4L documentaire** : [Machine Dispatch Keycloak+PG17 #38370470863](https://github.com/adminluxe/DelishAfrica/actions/runs/38370470863), [API + Client + Merchant + Courier #38370470733](https://github.com/adminluxe/DelishAfrica/actions/runs/38370470733), [PostgreSQL régressions financières #38370470829](https://github.com/adminluxe/DelishAfrica/actions/runs/38370470829).
- **F4M :** branche `feat/f4m-nonsuperuser-operational-sql-qa-20261013` créée exactement sur F4L ; [PR #45 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/45), aucune fusion.
- Worktree Toshiba `/home/tontoncestcarre/work/DA_STRIPE_RECON_QA_20261012` **non touché**.
- Apps utilisées réellement sur VPS `/opt/delishafrica/monorepo/apps/{client,merchant,courier}` et API correspondante **non touchées**.

## 2. Défaut P0 encore présent après F4L

Le chemin Dispatch F4L est protégé par un OIDC machine Keycloak, un attesteur privé et une fonction de contrôle SQL 016 appartenant à un rôle `NOLOGIN/NOSUPERUSER`. Toutefois les cinq fonctions historiques 007 et le prédicat d'éligibilité financière 004 utilisaient encore leur propriétaire initial, issu du runner SQL privilégié, sous `SECURITY DEFINER`. Une mutation 007 pouvait alors exécuter les contrôles en héritant d'une autorité SQL trop large. Les applications n'avaient déjà **aucun droit direct 007** ; F4M retire le privilège au niveau de **la fonction elle-même**, sans rouvrir son API.

## 3. Migration 017 — séparation des fonctions, sans changement de logique métier

Fichier : `services/api-nest/migrations/client-commerce/20261013_017_nonsuperuser_operational_definers_qa_only.sql`.

| Propriétaire SQL NOLOGIN / NOSUPERUSER | Fonctions couvertes | Permissions accordées |
|---|---|---|
| `da_qa_f4m_finance_gate_owner_017` | `da_qa_commerce_order_dispatch_eligible(uuid)` (004) | SELECT seulement sur commandes, autorités de paiement, reçus et retenues financières |
| `da_qa_f4m_ops_reader_owner_017` | `da_qa_merchant_visible_paid_orders`, `da_qa_courier_assigned_offers` (007) | SELECT limité aux commandes, snapshots, preuve de capture/hold, état Merchant et offres Courier |
| `da_qa_f4m_ops_writer_owner_017` | `da_qa_merchant_transition`, `da_qa_dispatch_assign_offer`, `da_qa_courier_transition` (007) | SELECT opérationnel, INSERT limité à l'état Merchant et aux offres Courier, UPDATE limité aux colonnes nécessaires et aux clés immuables exigées par `FOR UPDATE` |

Les trois propriétaires interdisent LOGIN, SUPERUSER, CREATEDB, CREATEROLE, REPLICATION, BYPASSRLS et INHERIT. Aucun membre de ces rôles n'est accordé à un compte mobile ou machine. `search_path` des six fonctions épinglé à `pg_catalog,public,pg_temp` (schéma temporaire placé en dernier). Les anciennes ACL applicatives 007 restent révoquées. Les seuls wrappers métiers autorisés demeurent les autorités attestées F4K/015 et F4L/016.

**Important :** même cette migration renforcée est une **preuve QA seulement**, non une migration prête à appliquer sur un cluster réel. Les autres fonctions historiques et l'identité/contrat juridiquement vérifiés demanderont des audits séparés avant production.

## 4. Laboratoire réel, enchaînement transactionnel

Workflow : `.github/workflows/f4m-nonsuperuser-operational-qa.yml`.

1. Démarrer un nouveau Keycloak 26.4.7 réel et PostgreSQL 17 jetables, sans réseau Internet de conteneurs ni port publié, secrets de test éphémères.
2. Installer les migrations historiques 001–015. **Insérer 017 immédiatement après 015**, avant les transitions F4K. Auditer propriétaires, membres, `SECURITY DEFINER`, `search_path`, SQL 007 et privilèges DML.
3. Rejouer les transitions Merchant/Courier F4K avec vrai JWT de Keycloak de test, reçus immuables 015 et six pulses financiers.
4. Installer et rejouer l'autorité machine Dispatch F4L/016 et ses tests : client_credentials, RSA/JWKS, introspection, attesteur privé, frontières SQL, concurrence 7→1, replays, territoires, révocations et impossibilité de réattribuer une offre.
5. Rejouer les deux ordres de concurrence Dispatch↔refund sous verrou PostgreSQL `FOR UPDATE` ; tester l'acceptation Courier après remboursement.
6. Vérifier l'absence de droits hors périmètre et la bonne propriété SQL 017 **à nouveau après F4L** ; vérifier le journal financier, les reçus opérationnels et l'absence de payout.
7. Exécuter séparément la CI Nest/API + trois apps et les régressions financières PostgreSQL historiques sur **le même SHA**.

Script d'audit : `services/api-nest/test/f4m-nonsuperuser-operational-owners.pg-qa.sql`.

### Contrats de certification (et non résultats présumés)

- `QA_F4M_SIX_SECURITY_DEFINERS_NOLOGIN_NOSUPERUSER=PASS`
- `QA_F4M_READ_WRITE_FINANCE_ROLES_NO_MEMBERSHIP=PASS`
- `QA_F4M_SQL_007_APP_BYPASS_AND_CROSS_DOMAIN_DML=DENIED`
- `QA_F4M_F4K_AND_F4L_WRAPPER_GRANTS_PRESERVED=PASS`
- `QA_F4M_F4K_F4L_PG17_SYNTHETIC_OPERATIONS_UNDER_NOLOGIN_OWNERS=PASS`
- Les marqueurs F4K/F4L antérieurs : 35 reçus opérationnels cumulés, 6 reçus Dispatch immuables, 16 allocations et 64 postings signés dont la somme est 0.
- `withdrawableMinor=0`, `payoutEnabled=false`, aucun appel Stripe réel.

**Une suite ne devient certifiée que si les trois CI ont conclu SUCCESS sur le HEAD final contenant aussi les documents.** Le SHA exact, les URL des runs et les résultats seront consignés **dans un commentaire de la PR #45 après les CI**, afin de ne pas modifier le HEAD par auto-référence.

## 5. Limites et conditions de promotion

**NO-GO absolu :** aucun paiement Stripe TEST officiel ni LIVE, aucune opération bancaire/payout, aucune migration VPS, aucune modification du Toshiba, aucune fusion PR, aucun build EAS payant ni Store sans accord explicite. La politique de **20 %** dans les fixtures reste un paramètre d'essai exclusivement synthétique, pas une commission contractuelle.

F4M ne certifie pas de vrais contrats, parties prenantes KYB/KYC, registre Courier, isolation réseau de production, mTLS, atomicité Keycloak externe↔PG, politique multijuridictionnelle/devise/fiscale ou intégration des véritables applications mobiles à cette autorité.

**Étape suivante éventuelle :** cartographier les autres fonctions `SECURITY DEFINER` et leurs propriétaires (paiement, ledger, registre, wallets), isoler les secrets et préparer un connecteur Nest Dispatch auditant les autorisations et rejeux, puis les gates G0–G7 avant toute promotion.
