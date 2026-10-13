# DELISHAFRICA® — PASSATION F4K / MUTATIONS OPÉRATIONNELLES ATTESTÉES MERCHANT & COURIER

**13 octobre 2026 | PR #43 DRAFT | Environnement QA éphémère | Aucun flux financier réel**

> **Périmètre strict :** véritable logiciel PostgreSQL 17 et Keycloak 26.4.7 en conteneurs déconnectés, mais identités, contrats, KYB/KYC, commandes et argent **100 % synthétiques**. Le Dispatch est injecté uniquement par un initialiseur privilégié du runner QA ; aucun droit Dispatch applicatif n'a été ouvert. Il ne s'agit ni d'un connecteur de production ni de Stripe TEST officiel.

## 1. Point de reprise et cohérence du dépôt

- Dépôt : `adminluxe/DelishAfrica`.
- Worktree Toshiba connu : `/home/tontoncestcarre/work/DA_STRIPE_RECON_QA_20261012` **non touché** ; Toshiba ménagé.
- Applications Expo exécutées réellement sur VPS : `/opt/delishafrica/monorepo/apps/{client,merchant,courier}` **non touchées**.
- F4D initial, PR #35–#36 DRAFT : SHA `cd0ba578401d087f9f42c4303e5501704d6bbf94` ; commandes et journal synthétiques.
- F4E #37, F4F #38, F4G #39, F4H #40, F4I #41 : tous QA en PR DRAFT, aucun merge, portées documentées dans la passation F4J.
- **F4J parent certifié** : SHA `bd16132217712dcf3087b55bec13068e28464464`, [SQL/session Keycloak #38356595209](https://github.com/adminluxe/DelishAfrica/actions/runs/38356595209), [API et apps #38356595201](https://github.com/adminluxe/DelishAfrica/actions/runs/38356595201), [PG finance #38356595272](https://github.com/adminluxe/DelishAfrica/actions/runs/38356595272), trois SUCCESS. Révocation PG17 sérialisée avec lecture.
- **F4K candidate** : branche `feat/f4k-attested-merchant-courier-ops-qa-20261013` ; [PR #43 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/43) empilée sur #42. Zéro merge, migration VPS, EAS payant ou Store.

## 2. Risque P0 identifié

Les fonctions historiques `da_qa_merchant_transition`, `da_qa_courier_transition` et `da_qa_dispatch_assign_offer` (migration 007) verrouillent les commandes et contrôlent le paiement/les retenues, mais prennent `merchantSlug` ou `issuer/subject` en paramètres. Leur exécution par les logins applicatifs a été révoquée depuis 010 pour empêcher l'usurpation d'un partenaire.

**F4K ne restaure aucune exécution directe de ces anciennes fonctions pour les applications.** Le droit d'agir est construit à partir du JWT réellement signé par Keycloak dans le laboratoire, réintrospecté, de la session 011 révocable, des contrats/KYB/roster PostgreSQL 012, et d'un **ticket unique 010** lié à la connexion de base de données qui exécutera l'action. Les sources métier sont de vraies structures de code mais uniquement des données de test.

## 3. Architecture F4K QA

```text
Jeton JWT Merchant ou Courier de Keycloak 26.4.7 ÉPHÉMÈRE
        |
        v
Contrôle externe RSA/JWKS + issuer/aud/azp/role + introspection
        |
        v
App QA non privilégiée / sans secret d'attestation
        |
   socket Unix protégé / aucun port public
        |
        v
Processus F4K PRIVÉ distinct, UID 1001, SQL SCRAM
   - revalidation des droits du portefeuille F4J
   - création d'un NOUVEAU challenge 010 par backend PG
   - ticket one-use par attesteur isolé SQL 013
        |
        v
SQL 015 SECURITY DEFINER, propriétaire NOLOGIN :
  * contrôle ticket + session hash lié au JWT signé
  * SQL 014 session, rôle, contrat, KYB, org, territoire verrouillés
  * SQL 007 commande, finance et retenues vérifiées sous row-lock
  * INSERT immuable reçu de transition (ordre, acteur, action, état)
        |
        v
Consultation du ledger 009 (gains synthétiques uniquement)
       withdrawableMinor=0 / payoutEnabled=false
```

Les trois couches d'autorisation (Keycloak, registres, SQL ticket/ligne de commande) demeurent indépendantes. Une mutation d'état opérationnel et sa preuve de réception sont commités dans **la même transaction PostgreSQL 17**. La projection du portefeuille est dérivée du ledger et des étapes opérationnelles ; elle n'autorise aucun payout.

## 4. Fichiers changés

1. `services/api-nest/migrations/client-commerce/20261013_015_attested_merchant_courier_transitions_qa_only.sql` — nouvelle fonction `da_qa_partner_transition_attested_015(ticket,session_sha256,order,next)` ; rôle `da_qa_fulfillment_writer_015` **NOLOGIN/NOSUPERUSER**, droit d'EXECUTE limité sur fonctions F4J et anciens processus 007 sans accès direct aux applications ; Dispatch non accordé ; table `da_qa_fulfillment_receipt_015` avec PK `order_id/actor_role/operation` et trigger immuable.
2. `services/api-nest/src/client-commerce/merchant-courier-wallet-signed-session.pg-qa.bridge.ts` — méthode `transition` QA : authentification complète Keycloak et wallet, revalidation signée, ticket frais puis appel SQL 015 ; aucune identité dans la charge utile autre que JWT, `orderId` et `next`. Aucun branchement AppModule production.
3. `services/api-nest/test/merchant-courier-attested-transition-private.pg-qa.service.cjs` — **service de mutation séparé** de F4I, socket `/qa-ipc/finance-transition.sock`, UID 1001, aucun port publié.
4. `services/api-nest/test/merchant-courier-attested-transition-client.pg-qa.integration.cjs` — app UID 1000 avec seulement credentials applicatifs, pas de secret Keycloak admin, attesteur, registre ou Stripe.
5. `services/api-nest/test/merchant-courier-attested-transition-order-seed.pg-qa.cjs` — deux commandes canoniques artificielles créées via le vrai code client, puis captures et allocations SQL **synthétiques** réalisées uniquement dans PG17 QA.
6. `services/api-nest/test/merchant-courier-attested-financial-pulse.pg-qa.sql` — test par stade, soldes exacts, commissions, journal zéro-somme, retenues, interdiction de modifier les reçus.
7. `.github/workflows/f4k-attested-merchant-courier-transitions-qa.yml` — réexécute F4D–F4J, installe migration 015, vérifie transitions, rejets, coûts et pulses financiers, nettoyage des secrets.
8. `.github/workflows/client-enrollment-gate.yml` et `.github/workflows/native-client-commerce-authority-postgres-qa.yml` — validation API et trois apps, régression finance historique.
9. Cette passation, roadbook financier et architecture épinglée — suivis dans la PR DRAFT.

## 5. Événements F4K exécutés et preuves de sécurité

- Merchant A peut accepter puis préparer ses deux commandes de test. Répéter une opération est accepté seulement comme replay idempotent : aucune seconde ligne de reçu. Merchant B ne peut pas s'approprier une commande Merchant A.
- Courier B ne peut pas accepter les offres attribuées à Courier A. Courier A peut accepter, enlever puis livrer sa première commande dans l'ordre. Impossible de passer directement de `offered` à `delivered`.
- Le scénario Dispatch dans le test **n'est PAS une fonction client activée** : l'initialiseur superuser QA attribue deux offres à un Courier QA officiellement fictif, uniquement après que le restaurateur est prêt. L'accès à `da_qa_dispatch_assign_offer` reste refusé au rôle applicatif.
- La seconde commande est remboursée de façon synthétique après acceptation Courier mais avant enlèvement. Le prochain enlèvement est refusé ; une nouvelle action Merchant sur la commande retenue est refusée.
- Après suspension du contrat Merchant ou du roster Courier dans PostgreSQL, un JWT encore signé ne permet plus une transition. Un JWT modifié, une identité étrangère ou un `merchantSlug` supplémentaire sont refusés.
- Le rôle applicatif ne peut ni emprunter le rôle SQL d'écriture `015`, ni exécuter directement `007`, ni lire les reçus 015 bruts, ni connaître les secrets de l'attesteur.
- Huit reçus pour huit étapes réellement committées, immuables sous trigger SQL ; aucune mutation des postings 009 ni véritable transfert d'argent.

## 6. Pulses de portefeuille certifiés — données entièrement synthétiques

Les valeurs ci-dessous incluent **un ancien montant Merchant de 18,40 € déjà retenu** par l'ancienne fixture F4D/F4I ; F4K ajoute deux commandes canoniques de 26,90 € chacune.

| Moment vérifié | Merchant A (acquis / attente / disponible / retenu) | Courier A (acquis / attente / disponible / retenu) |
|---|---|---|
| 2 captures nouvelles | 55,20 / 36,80 / 0 / 18,40 € | 0 / 0 / 0 / 0 € |
| 2 commandes prêtes | 55,20 / 0 / 36,80 / 18,40 € | 0 / 0 / 0 / 0 € |
| 2 offres au Courier | 55,20 / 0 / 36,80 / 18,40 € | 7,80 / 7,80 / 0 / 0 € |
| 1 livraison + 1 acceptation | 55,20 / 0 / 36,80 / 18,40 € | 7,80 / 3,90 / 3,90 / 0 € |
| Remboursement de la seconde | 55,20 / 0 / 18,40 / 36,80 € | 7,80 / 0 / 3,90 / 3,90 € |
| Contrat/roster suspendus | Montants historiques inchangés, accès refusé | Montants historiques inchangés, accès refusé |

**Commission de test seulement** : chaque panier de 26,90 € inclut 23,00 € de menu et 3,90 € de livraison. La politique QA `QA_FIXTURE_EUR_V1` prélève 20 % fictifs sur le menu, soit 4,60 €, laissant 18,40 € au Merchant et réservant 3,90 € au Courier. La commission et le schéma **ne constituent ni offre commerciale ni règlement fiscal**.

Le laboratoire constate trois allocations équilibrées (12 lignes comptables) : somme des postings = **0**, politiques immuables, soldes non retirable, aucune remise à zéro ou duplication au replay, `withdrawableMinor=0`, `payoutEnabled=false`.

## 7. Premières certifications de code sur SHA identique

**Code `c2e67a7e17d6ed65ea30964610c521f307f560b3`, trois SUCCESS :**
- [F4K Keycloak réel éphémère + PostgreSQL 17 + SCRAM + mutations + six pulses financiers #38362829428](https://github.com/adminluxe/DelishAfrica/actions/runs/38362829428).
- [API et trois applications TypeScript #38362829434](https://github.com/adminluxe/DelishAfrica/actions/runs/38362829434).
- [PostgreSQL 17 finance historique, concurrence et journal #38362829468](https://github.com/adminluxe/DelishAfrica/actions/runs/38362829468).

Journaux observés : `QA_F4K_SQL_OPS_ATTESTATION_015=INSTALLED`, `QA_F4K_PRIVATE_MUTATION_SOCKET=PASS`, `QA_F4K_SIGNED_MERCHANT_ACCEPT_READY_IDEMPOTENT=PASS`, `QA_F4K_SIGNED_COURIER_ACCEPT_PICKUP_DELIVER_IDEMPOTENT=PASS`, `QA_F4K_REFUND_HOLD_BLOCKS_PICKUP_AND_MERCHANT=PASS`, `QA_F4K_REVOKED_CONTRACT_ROSTER_VALID_JWT=DENIED`, `QA_F4K_IMMUTABLE_OPERATION_RECEIPTS=8`, `QA_F4K_FINANCE_PULSE_captured=PASS`, `QA_F4K_FINANCE_PULSE_merchant_ready=PASS`, `QA_F4K_FINANCE_PULSE_offered=PASS`, `QA_F4K_FINANCE_PULSE_courier_progress=PASS`, `QA_F4K_FINANCE_PULSE_refund_held=PASS`, `QA_F4K_FINANCE_PULSE_revoked=PASS`, `QA_F4I_EPHEMERAL_CLEANUP=PASS`, et zéro test en échec.

**Incident de banc d'essai archivé** : première création de captures échouée sur `qa_finance_provider_identity_invalid`, car `acct_QA015_SAFEFIXTURE` ne respectait pas la contrainte de format `^acct_[A-Za-z0-9]{6,120}$`. Seule la fixture a été corrigée (identifiant conforme, aucune baisse de protection). La suite est repassée vert.

Les mises à jour documentaires changent le HEAD de la PR. **Ne signer la PR finale qu'après trois nouvelles CI SUCCESS sur son SHA documentaire final**.

## 8. Points NO-GO / suite

**Production strictement interdite** : la version F4K ne certifie pas l'existence de véritables inscrits OIDC, contrats, actes KYB, KYC ou roster juridique Courier, ni les permissions d'affectation d'un service Dispatch officiel. L'authentification mobile interactive Authorization Code + PKCE, l'atomicité entre logout Keycloak externe et SQL, les permissions par pays/devise/entité, les chargebacks et la séparation financière internationale restent ouverts.

**Prochain laboratoire F4L suggéré** : identité de service Dispatch vérifiable (mTLS/OIDC service account et permissions exactes), affectation/annulation sous verrou de paiement et de roster, changement d'organisation ou de région, tests simultanés Merchant/Courier/Dispatch/hold ; sans jamais rendre les anciennes fonctions 007 accessibles aux applications. Une autre tranche préparera la conformité légale et Stripe TEST officiel avec secrets dédiés.

Toujours **0€ réel**, aucune opération Stripe TEST officielle ni Stripe LIVE, aucun payout/settlement, aucune migration VPS, aucune fusion, aucun EAS payant ou soumission Store. Toute promotion G0–G7 requiert des preuves actualisées et une validation expresse.

**Signature intermédiaire : F4K-MERCHANT-COURIER-ATTESTED-WRITE-SYNTHETIC-QA-3CI-SUCCESS / DISPATCH-FIXTURE-ONLY / OFFICIAL-IDENTITIES-NO-GO / ZERO-PAYOUT / NO-PROD / PR-DRAFT.**
