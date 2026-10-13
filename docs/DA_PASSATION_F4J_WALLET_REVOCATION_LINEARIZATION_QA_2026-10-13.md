# DELISHAFRICA® — PASSATION F4J / CONSOMMATION ATOMIQUE DU TICKET FINANCIER

**13 octobre 2026 | PR #42 DRAFT | Laboratoire QA isolé | Tranche de sécurité PostgreSQL locale uniquement**

> Ne jamais interpréter un test réussi comme un vrai paiement. Keycloak 26.4.7 et PostgreSQL 17 sont réellement exécutés dans des conteneurs déconnectés, mais les sujets, entreprises, accords KYB/KYC, territoires et montants sont **entièrement synthétiques**. Aucun prestataire PSP, compte bancaire, Store, build payant ou VPS n'est sollicité.

## 1. Chaîne de références, état de reprise exact

- Dépôt : `adminluxe/DelishAfrica`.
- F4D de base : `cd0ba578401d087f9f42c4303e5501704d6bbf94` ; PR #35 et #36 toujours DRAFT.
- F4E : `ae90656dfe3b25ac69a9b1b32f1ebaec5725822d`, [PR #37 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/37) — contrôle d'identité SQL et anciens ports d'écriture fermés.
- F4F : `7c55cccd1cbce32b2ffb7d604ecf8f16f9202ca5`, [PR #38 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/38) — Bearer signé, session et wallet synthétique.
- F4G : `dd68f146218c126c126ce42bd8e80f6510da7036`, [PR #39 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/39) — vrai binaire Keycloak isolé et JWKS.
- F4H : `2033f761b7848ab93b8a7f8367dd275727eefb52`, [PR #40 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/40) — schéma réel du catalogue Merchant et registre Courier QA synthétique.
- F4I : `80f512c03c902bcc3d2656839863ebaad4dc0eff`, [PR #41 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/41), trois CI SUCCESS — séparation du processus attestateur et authentification PostgreSQL SCRAM.
- **F4J** : branche `feat/f4j-wallet-revocation-linearization-qa-20261013`, [PR #42 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/42) basée sur #41. Aucun merge.
- Worktree Toshiba F4D `/home/tontoncestcarre/work/DA_STRIPE_RECON_QA_20261012` : **non modifié**. VPS réel `/opt/delishafrica/monorepo/apps/{client,merchant,courier}` : **non modifié**.

## 2. Défaut de concurrence audité : TOCTOU inter-registres

La frontière F4I vérifiait déjà Keycloak, l'introspection, la session SQL 011, les contrats/adhésions Merchant, le KYB QA 012 et les habilitations Courier **avant** d'émettre un ticket F4E. Cependant, la fonction d'**utilisation** du ticket 010 ne revérifiait directement que les anciens scopes-wallet synthétiques 010. Une révocation valide dans la source métier 012 ou dans `da_merchant_memberships` pouvait donc intervenir après la vérification de l'attesteur mais avant la projection financière.

**Correction F4J** : le consommateur SQL 014 revérifie la session hachée 011, l'identité, les memberships Merchant, les partenaires, entités juridiques et registres Courier 012. Il maintient des verrous `FOR SHARE` ou `FOR UPDATE` jusqu'à la lecture du ledger 009 **dans la même transaction PostgreSQL**. Ainsi, une mise à jour concurrente des lignes vérifiées ne peut pas être validée à mi-parcours.

## 3. Architecture et permissions

**Migration additive :** `services/api-nest/migrations/client-commerce/20261013_014_wallet_business_revocation_linearized_qa_only.sql`, exécutée après les migrations QA 001–013 et le catalogue Merchant, dans le seul conteneur PG17 éphémère.

- Rôle propriétaire `da_qa_wallet_linear_owner_014` : **NOLOGIN / NOSUPERUSER / NOINHERIT**, avec SELECT sur les seules tables d'autorité et UPDATE limité aux colonnes identifiantes nécessaires aux verrous ligne. Il ne reçoit aucun droit de payout ni de mutation de statut financier.
- `REVOKE EXECUTE` de l'ancienne fonction `da_qa_wallet_read_attested_010(uuid,integer)` pour les comptes Merchant/Courier applicatifs. Elle n'est plus appelée directement que par le propriétaire de la fonction 014.
- Nouvelle fonction `da_qa_wallet_read_linearized_014(ticket,limit,session_sha256)`, `SECURITY DEFINER` et `search_path` fixé, refuse les rôles inattendus, tickets invalides, sessions expirées/révoquées, identités hors rôle, contrats, KYB, pays ou listes d'habilitation incohérents.
- Scope Merchant : tous les memberships d'un sujet sont inspectés et les memberships finance valides doivent résoudre **vers exactement un seul portefeuille**. La double appartenance non représentable dans le ledger actuel reste fail-closed.
- Scope Courier : roster officiel **simulé** en SQL 012, contrat, KYC, organisation, territoire et autorité juridique QA actifs, revérifiés avant le ledger.
- Le hash d'une session est calculé côté service privé F4I à partir des **claims vérifiés** `issuer/sub/sid/jti`, jamais fourni par l'app mobile. Il est confronté au ticket lié au backend et à la session 011.
- `QaWalletVerifiedSessionBridge` appelle la fonction 014 uniquement avec `QA_F4J_ATOMIC_SQL=YES` et `QA_F4I_PRIVATE_SERVICE=YES`. Aucun changement de l'AppModule public, aucun droit ancien réactivé.
- **L'ancienne mutation Merchant/Courier/Dispatch reste BLOQUÉE** depuis 010. F4J ne crée aucune fonction nouvelle de mutation ni aucun transfert bancaire.

## 4. Matrice adversariale déterministe

Fichier : `services/api-nest/test/merchant-courier-wallet-revocation-linearized.pg-qa.integration.cjs`.

La matrice installe les fixtures précédentes avec un vrai Keycloak 26.4.7 jetable, utilise les sessions vérifiées et exécute deux ordres de transaction contrôlés grâce à `pg_stat_activity.wait_event_type='Lock'` :

1. Révocation du contrat/membership Merchant dans la transaction A ; lecture F4J dans B **attend** le verrou ; A valide ; B reçoit **DENIED**.
2. Lecture Merchant B avec verrous sur le KYB légal dans A ; révocation KYB dans B **attend** ; A termine sa lecture ; B peut ensuite valider ; nouvelle lecture reçoit **DENIED**.
3. Suspension du roster Courier dans A ; lecture dans B attend, puis **DENIED** après COMMIT de A.
4. Lecture Merchant avec session 011 verrouillée dans A ; modification `revoked_at` dans B attend ; après COMMIT de A, B valide et les lectures suivantes sont **DENIED**.
5. Hash d'une session d'un autre partenaire associé à un ticket valide : **DENIED** ; lecture directe 010 sans fonction F4J : **permission denied**.

Les deux sens sont nécessaires : un échec au mauvais ordre ne suffit pas à démontrer que le verrou protège la lecture. Les jeux sont restaurés dans les conteneurs jetables avant les tests F4I de socket et de révocation.

### Premières CI sur le SHA de CODE F4J

**`1bc1f770f83edb908a3e6b38debcce8246859d7e` :**

- [F4J / Keycloak 26.4.7 + PostgreSQL 17, revocations SQL + attesteur privé, #38356090975](https://github.com/adminluxe/DelishAfrica/actions/runs/38356090975) — **SUCCESS**.
- [API + Client + Merchant + Courier, #38356090898](https://github.com/adminluxe/DelishAfrica/actions/runs/38356090898) — **SUCCESS**.
- [Réconciliation finance PostgreSQL 17 + concurrence historique, #38356091032](https://github.com/adminluxe/DelishAfrica/actions/runs/38356091032) — **SUCCESS**.

Marqueurs F4J observés dans les journaux : `QA_F4J_SQL_REVOCATION_LINEARIZED_014=INSTALLED`, `QA_F4J_OLD_WALLET_ENTRYPOINT=REVOKED`, `QA_F4J_REVOKE_COMMIT_BEFORE_WALLET_MERCHANT_CONTRACT=DENIED`, `QA_F4J_READ_COMMITTED_BEFORE_REVOKE_ENTITY_KYB=SERIALIZED`, `QA_F4J_REVOKE_COMMIT_BEFORE_WALLET_COURIER_ROSTER=DENIED`, `QA_F4J_READ_COMMITTED_BEFORE_REVOKE_HASHED_SESSION=SERIALIZED`, `QA_F4J_CROSS_PARTNER_SESSION_DIGEST=DENIED`, `QA_F4J_COMMIT_ORDER_SESSION_MEMBERSHIP_KYB_ROSTER=PASS`, `QA_F4I_PG17_ALL_HOST_ROLES_REQUIRE_SCRAM=PASS`, `QA_F4I_EPHEMERAL_CLEANUP=PASS`, `QA_F4J_STRIPE_CALLS=ZERO_PAYOUTS=ZERO`.

**Important :** les modifications documentaires et de workflow ultérieures changent le HEAD. Il faut trois nouvelles preuves SUCCESS sur **le même SHA final** avant clôture de ce jalon. Les pipelines précédents ne prouvent pas le HEAD futur.

## 5. Garanties non démontrées et portes NO-GO

- **Keycloak externe** : le logout ou la révocation d'une session chez le fournisseur OIDC ne participent PAS à la transaction SQL 014. Un contrôle d'introspection juste avant une lecture réduit la fenêtre, mais ne produit pas une garantie de linéarisation distribuée Keycloak↔PostgreSQL.
- **Autorité légale** : le logiciel Keycloak est réellement exécuté en QA, mais ses quatre comptes, les contrats, statuts KYB/KYC, organisations et habilitations Courier demeurent **synthétiques**. Aucune pièce officielle, preuve de licence ou identité réelle n'est certifiée.
- **Mutation opérationnelle** : le module 007 garde ses accès anciens révoqués. Il faut un laboratoire distinct de mutations signées et de résolution des courses paiement/remboursement/livraison avant un vrai flux de gains opérationnels.
- **Modèle international** : le ledger 009 ne possède pas encore les dimensions complètes personne morale/territoire/devise/taxation/conversion PSP. L'exemple de commission 20 % est fictif, pas une politique commerciale.
- **Production** : service attestateur encore prototype QA en conteneur, plusieurs secrets SQL dans un même processus, gestion des attaques d'opérateur à approfondir. Les tests ne certifient pas une architecture bancaire autorisée.
- **Aucun Stripe TEST officiel ni LIVE, aucun transfert, settlement ou payout.** `withdrawableMinor=0`, `payoutEnabled=false`. Aucune migration VPS, fusion, build EAS payant, soumission Store ou publication sans G0–G7, preuves à jour et validation humaine explicite.

**Prochaine étape de sécurité F4K** : mutations Merchant/Courier/Dispatch attestées, avec transaction financée, concurrence capturé/remboursé/enlevé/livré, idempotence et aucune comptabilisation anticipée ; la preuve Keycloak/révocation externe réelle demeurera un gate indépendant.

**Signature provisoire F4J-POSTGRES-LOCAL-REVOCATION-QA-CODE-3CI-SUCCESS / REAL-KEYCLOAK-PRODUCTION-NO-GO / NO-PAYOUT / NO-MERGE / NO-VPS.**
