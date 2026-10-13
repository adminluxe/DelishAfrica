# DELISHAFRICA® — PASSATION F4H — Autorité financière Merchant/Courier PostgreSQL

**13 octobre 2026 | PR #40 DRAFT | Laboratoire QA isolé | CERTIFICATION F4H EN COURS**

## 1. Héritage certifié et frontière

- Dépôt : `adminluxe/DelishAfrica`.
- F4D `cd0ba578401d087f9f42c4303e5501704d6bbf94` ; PR #35/#36 DRAFT ; PG17 et API + apps certifiés.
- F4E `ae90656dfe3b25ac69a9b1b32f1ebaec5725822d` ; PR #37 DRAFT : séparation des rôles SQL, tickets 010 mono-usage, interdiction des anciennes fonctions ayant des paramètres d'identité non attestés.
- F4F `7c55cccd1cbce32b2ffb7d604ecf8f16f9202ca5` ; PR #38 DRAFT : signature de JWT partenaire, vérification de session, ticket financier.
- F4G `dd68f146218c126c126ce42bd8e80f6510da7036` ; PR #39 DRAFT ; [Keycloak 26.4.7 + PG17 38330127934](https://github.com/adminluxe/DelishAfrica/actions/runs/38330127934), [API + Client/Merchant/Courier 38330127919](https://github.com/adminluxe/DelishAfrica/actions/runs/38330127919), [PG finance 38330127921](https://github.com/adminluxe/DelishAfrica/actions/runs/38330127921), tous SUCCESS sur le même SHA F4G.
- **F4H :** `feat/f4h-finance-authority-registry-qa-20261013`, [PR #40 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/40), empilée sur #39. Les preuves F4G **ne certifient pas** les changements F4H.

Toshiba `/home/tontoncestcarre/work/DA_STRIPE_RECON_QA_20261012` conservé. Aucun checkout/reset ni tâche Docker sur Toshiba. VPS réel `/opt/delishafrica/monorepo/apps/{client,merchant,courier}` totalement non touché.

## 2. Constat P0 et source de vérité

Le catalogue officiel du code possède déjà les tables PostgreSQL `da_identity_subjects`, `da_catalog_partners`, `da_merchant_memberships` avec `issuer/subject`, rôle, statut, contrat actif, KYB vérifié, révocation et fenêtres de validité. En revanche le service historique `courier-platform.service.ts` répond encore avec des données **de démonstration** ; il ne peut servir d'autorité de portefeuille.

**L'étape F4H réutilise la structure Merchant réellement implémentée dans notre API**, mais ses lignes d'essai demeurent synthétiques. Elle crée un registre SQL Courier indépendant durable **pendant la vie éphémère du runner**. Aucune de ces preuves ne constitue un vrai KYB/KYC légal, contrat exécuté ou lien à une entité immatriculée.

## 3. Éléments livrés en QA

1. `services/api-nest/migrations/client-commerce/20261013_012_finance_authority_registry_qa_only.sql` : migration additive exécutée après le catalogue `34b4b5b2a5a2_001` et les migrations de finance 001–011, **uniquement** dans PG17 sans réseau externe.
   - `da_qa_finance_legal_entities_012` : `organization_id`, territoire ISO, statut, KYB fictif, retenue de paiement, dates et révocation.
   - `da_qa_finance_partner_entities_012` : lien entre `da_catalog_partners.partner_id` **existant** et organisation/territoire.
   - `da_qa_finance_courier_roster_012` : référence FK à `da_identity_subjects(issuer,subject)`, organisation/territoire, accord, KYC, actif/suspendu/révoqué, dates.
   - Propriétaire séparé `NOLOGIN NOSUPERUSER`. Lecteur SQL `da_qa_finance_registry_reader_012` : SELECT seulement sur les tables requises. Pas d'accès direct Merchant/Courier applicatif ni de l'attesteur F4E au nouveau registre.
2. `services/api-nest/src/client-commerce/merchant-courier-finance-authority.pg-qa.adapter.ts` : adaptateur strictement QA, non monté dans AppModule, requêtes SQL paramétrées sur `issuer + subject`. Le parcours Merchant croise **5 tables** de catalogue+autorité ; le parcours Courier vérifie l'identité, le roster et l'entité légale. Aucun slug, sujet, territoire ou organisation n'est pris dans un body mobile.
3. `services/api-nest/test/merchant-courier-finance-authority-keycloak.pg-qa.integration.cjs` : quatre véritables JWT RSA émis par Keycloak 26.4.7 éphémère, introspection et révocation session PostgreSQL 011, lecture via ticket de même backend 010, registre Merchant/Courier 012 et ledger 009 synthétiques.
4. `.github/workflows/f4h-keycloak-finance-authority-qa.yml` et `.github/workflows/client-enrollment-gate.yml` : laboratoire sans ports exposés, données/identifiants jetables, typage API + trois applications.

## 4. Menaces explicitement testées

- Merchant A (restaurant BE, gains 1 840 centimes **synthétiques en retenue**) et Merchant B (restaurant FR, zéro) : séparation des wallets, organisation/territoire et issuer.
- Courier A et B (aucune offre comptabilisée au nom de leurs sujets Keycloak QA) : aucun gain inventé.
- Détournement JWT signé, application partenaire étrangère, session PostgreSQL 011 révoquée, logout Keycloak et token introspecté inactif : refus.
- Membership Merchant rétrogradé vers `kitchen`, contrat suspendu, partenaire dépublié et double appartenance financière : refus, y compris pour JWT valide.
- Entité légale KYB fictif expiré : Merchant et Courier liés refusés.
- Changement illégitime d'organisation/territoire Merchant dans le nouveau registre : incohérence avec l'autorité wallet 010, attestation refusée.
- Registre Courier 012 suspendu ou identité révoquée : refus, même si le registre wallet 010 reste actif.
- Tentative d'UPDATE de memberships ou du registre Courier par le login de lecture : refus ; consultation directe du roster par les rôles app et attestor : refus.
- Tous les refus renvoient un motif générique à la surface wallet, sans divulguer identité, pièces, secrets ou données interpartenaires.
- Aucun retrait ni versement : `withdrawableMinor=0` et `payoutEnabled=false`.

## 5. Règles de promotion : blocages

Le **logiciel** Keycloak du test est réel ; ses **identités, rôles, contrats, KYB/KYC, entités et ledger sont fictifs**. Le connecteur d'attestation n'est toujours pas un service indépendant en production ; son credential ne doit jamais se trouver dans l'API publique. Le registre Courier officiel, les attestations contractuelles vérifiables, les habilitations métier multi-régions, l'administration d'entités, la sécurité multi-realm et la gestion du retrait/settlement n'existent pas encore au niveau de garantie exigé.

Les mutations Merchant/Dispatch/Courier historiques restent désactivées après SQL 010. Aucun Stripe TEST officiel, Stripe LIVE, transfert financier, migration VPS, fusion PR, build payant, soumission Store ou lancement G0–G7 n'est autorisé ici.

**Prochain verrou :** véritable service d'autorité métier indépendant (Merchant contractuel/KYB et roster Courier officiel) raccordé en QA autorisée, puis attestation des mutations et politique pays/devise/PSP. Ensuite seulement Stripe TEST officiel avec secrets dédiés et revue d'approbation.

**Signature provisoire : F4H-SYNTHETIC-DURABLE-SCHEMA-QA-CANDIDATE / REAL-PARTNER-ENTITLEMENTS-NOT-CERTIFIED / NO-STRIPE / NO-PAYOUT / NO-PROD / NO-MERGE / NO-STORE.**
