# DELISHAFRICA® — PASSATION F4I / ATTESTATEUR FINANCIER ISOLÉ / QA

**Date : 13 octobre 2026 · PR #41 DRAFT · Statut : CERTIFICATION CODE F4I QA ACQUISE, autorités réelles NO-GO**

> Toutes les identités Keycloak utilisées ici sont **jetables et fictives** ; les montants financiers et données KYB/KYC également. Le serveur Keycloak 26.4.7 et PostgreSQL 17 sont de vrais logiciels exécutés dans des conteneurs, sans accès au réseau externe. Aucune production, aucun Stripe, aucun payout.

## 1. Références immuables et protection du chantier

- Dépôt : adminluxe/DelishAfrica.
- F4D QA parent : SHA `cd0ba578401d087f9f42c4303e5501704d6bbf94`, PR #35 et #36 DRAFT, flux de caisse synthétique et réconciliation en PG17.
- F4E : PR #37 DRAFT, SHA `ae90656dfe3b25ac69a9b1b32f1ebaec5725822d` : interdiction des lectures par slug arbitraire et des mutations non attestées, ticket SQL lié au backend.
- F4F : PR #38 DRAFT, SHA `7c55cccd1cbce32b2ffb7d604ecf8f16f9202ca5` : liaison Bearer OIDC validé, session et registre.
- F4G : PR #39 DRAFT, SHA `dd68f146218c126c126ce42bd8e80f6510da7036` : logiciel Keycloak 26.4.7 réellement exécuté en QA, JWT RS256 signés, introspection réelle.
- F4H : PR #40 DRAFT, SHA `2033f761b7848ab93b8a7f8367dd275727eefb52`, trois CI SUCCESS sur le même SHA : [Keycloak et PG17](https://github.com/adminluxe/DelishAfrica/actions/runs/38331278280), [API + 3 apps](https://github.com/adminluxe/DelishAfrica/actions/runs/38331278288), [finance et concurrence PG17](https://github.com/adminluxe/DelishAfrica/actions/runs/38331278300). Le schéma Merchant du code et un registre Courier synthétique deviennent des conditions d'autorisation.
- F4I : branche `feat/f4i-isolated-finance-attestor-qa-20261013`, [PR #41](https://github.com/adminluxe/DelishAfrica/pull/41) DRAFT, base F4H. **Interdit de fusionner ou déployer sans nouvelle preuve et validation.**
- Worktree Toshiba préservé : `/home/tontoncestcarre/work/DA_STRIPE_RECON_QA_20261012`.
- Apps réelles du VPS non modifiées : `/opt/delishafrica/monorepo/apps/{client,merchant,courier}`.

## 2. Pourquoi F4I est nécessaire

F4H prouvait les autorisations métier, mais le runner utilisait provisoirement PostgreSQL `POSTGRES_HOST_AUTH_METHOD=trust` et l'attesteur + la requête applicative vivaient dans le même processus. La **séparation des secrets** n'était donc pas authentifiée par PostgreSQL : un processus pouvant ouvrir une connexion locale dans le runner pouvait se présenter comme un autre rôle. Ce constat concerne **le laboratoire F4H**, et n'établit pas que la production utilise `trust`.

F4I introduit une frontière de processus et d'authentification de base de données. Après l'initialisation jetable, les connexions **TCP host** PostgreSQL doivent utiliser `SCRAM-SHA-256`, et seuls les rôles disposant du secret adéquat peuvent ouvrir leur connexion. La socket Unix PostgreSQL réservée à la maintenance reste dans le conteneur PG, jamais exposée au conteneur applicatif.

## 3. Architecture F4I QA

```text
Mobile/API fictive sans secret d'attestation (UID 1000)
         |
         | JWT Bearer déjà détenu par le partenaire QA
         | Unix socket local partagé, permissions restreintes
         v
Attesteur privé F4I, processus Docker séparé (UID 1001)
  - Secret d'introspection Keycloak QA
  - Vrai vérificateur RS256/JWKS de l'API + introspection active
  - Session signée sid/jti stockée sous hash SQL 011 et révocable
  - Autorité catalogue Merchant + registre Courier F4H 012
  - Connexion SQL 013 d'attestation distincte, aucun superuser
  - SQL de lecture Merchant et Courier avec comptes propres
         |
         v
SQL 010 challenge backend + attestation sur issuer/sub/org/territoire
         |
         v
Ticket mono-usage associé à backend PID + backend start + session_user
         |
         v
Ledger synthétique 009, journal équilibré non modifiable
         |
         v
Retour uniquement du portefeuille autorisé, jamais de capacité payout
```

Le seul processus pouvant émettre des tickets a le secret du rôle `da_qa_wallet_attestor_isolated_013`, dont les privilèges SQL sont limités. L'ancien rôle `da_qa_wallet_attestor_010` perd ce droit après migration 013. Les comptes applicatifs n'ont pas de mot de passe d'attestation. Le runner GitHub sépare les fichiers `attestor.env` et `client.env`, avec des secrets aléatoires jamais journalisés.

Le service est monté exclusivement dans un conteneur QA rootless et n'écoute **aucun port HTTP publié**. Le socket partagé ne confère aucun droit financier : chaque demande doit être acceptée par Keycloak, son introspection, les registres, les scopes SQL et le ticket. Les routes réelles de l'AppModule de production et les apps Expo ne sont pas modifiées.

## 4. Changements candidats

- Migration additive `services/api-nest/migrations/client-commerce/20261013_013_separate_wallet_attestor_qa_only.sql` ; elle ne doit s'exécuter que dans le PG17 jetable, **après** 001–012.
- Adaptation strictement QA `services/api-nest/src/client-commerce/merchant-courier-wallet-signed-session.pg-qa.bridge.ts` pour contrôler explicitement le login SQL F4I privé.
- Initialiseur de test `services/api-nest/test/merchant-courier-wallet-isolated-attestor.setup.cjs`, détruit avant tout test non privilégié.
- Service isolé `services/api-nest/test/merchant-courier-wallet-isolated-attestor.pg-qa.service.cjs`.
- Test du client de confiance minimale `services/api-nest/test/merchant-courier-wallet-isolated-attestor.client.pg-qa.integration.cjs`.
- Workflow `.github/workflows/f4i-isolated-wallet-attestor-qa.yml` pour Docker Keycloak/PG, TLS éphémère, hba SCRAM, rôles distincts, socket, scenarii adversariaux.
- CI API et trois applications dans `.github/workflows/client-enrollment-gate.yml` ; CI finance PG historique toujours exécutée en parallèle.

## 5. Preuves attendues

- Interdiction pour l'application de `SET ROLE` vers l'attesteur, de lire le roster ou le registre de sessions, et de se connecter au rôle isolé avec un mot de passe d'application.
- Clés d'introspection et de base de données privées non montées dans le conteneur applicatif.
- Le conteneur attesteur UID 1001 possède seul le secret financier et le socket ; le client UID 1000 ne peut pas détruire le socket.
- Merchant A lit 1 840 centimes de test en retenue, Merchant B 0, Courier A/B 0 faute d'offre attribuée à leurs identités signées QA ; aucune vue croisée.
- Modification de la charge utile JWT, faux JWT, paramètre `merchantSlug` supplémentaire, rôle inter-application, session Merchant révoquée, roster Courier suspendu : refus, sans fuite d'identité ni donnée sensible.
- Anciennes fonctions de mutation Merchant/Dispatch/Courier toujours refusées après SQL 010, aucun appel Stripe ni transfert.
- Les pipelines doivent être tous SUCCESS **sur le SHA final**, et non sur un ancêtre intermédiaire.

## 6. Risques ouverts (NO-GO réel)

1. Les identités Keycloak sont artificielles : l'authentification mobile Authorization Code + PKCE réelle, les règles IAM du realm public, les journaux de révocation distribués, la rotation des clés et les audits d'incident restent à certifier.
2. Les contrats, KYB/KYC, organisations et registre Courier sont des lignes **synthétiques** même lorsque le schéma Merchant est le vrai schéma de l'API.
3. L'attesteur F4I conserve plusieurs identifiants SQL financiers dans un même processus privé ; en production, une nouvelle revue d'architecture et du moindre privilège est obligatoire.
4. Une révocation survenant **entre** l'interrogation de l'autorité F4H et la consommation du ticket SQL 010 n'est pas encore démontrée comme linéarisable par une même transaction dans la source métier. Risque de course restant à résoudre.
5. Les mutations Merchant/Courier/Dispatch ne disposent pas encore de capacités signées équivalentes ; les anciennes fonctions sont révoquées. Ne pas les rouvrir sans laboratoire séparé.
6. Manquent encore la dimension juridique multidevise et multiterritoire du ledger, les PSP, le settlement, les frais et taxes, les chargebacks, la reconciliation Stripe TEST officielle et l'activation des versements.

**Règles :** `withdrawableMinor=0`, `payoutEnabled=false`, argent synthétique ; aucun Stripe TEST officiel ni LIVE, aucun VPS, aucune fusion, aucun EAS payant, aucune soumission Store sans batterie G0–G7, preuves exactes et validation humaine. Papy Toshiba reste hors du laboratoire.

**Signature provisoire : F4I-QA-ISOLATION-CANDIDATE / FINAL-CI-NOT-YET-CERTIFIED / REAL-IDENTITY-NO-GO / ZERO-PAYOUT / NO-PRODUCTION / DRAFT.**

---

## 7. Certificat provisoire sur code QA F4I

**SHA code `e7c58aee812b555030e2c06c987e3d8e716a4785` : TROIS CI SUCCESS sur le même SHA, avant consolidation documentaire :**

1. [#38353167968](https://github.com/adminluxe/DelishAfrica/actions/runs/38353167968) — vrai Keycloak 26.4.7 isolé + PostgreSQL 17, migration 013, SCRAM effectif, socket et service privé F4I ; success.
2. [#38353167959](https://github.com/adminluxe/DelishAfrica/actions/runs/38353167959) — TypeScript API et Client/Merchant/Courier et vérification de non-enregistrement en production ; success.
3. [#38353167869](https://github.com/adminluxe/DelishAfrica/actions/runs/38353167869) — tests financiers PostgreSQL 17 historiques, réconciliation et concurrence ; success.

**Marqueurs réellement constatés :** `QA_F4I_SQL_EXCLUSIVE_ATTESTOR_ROLE_013=INSTALLED`, `QA_F4I_PG17_ALL_HOST_ROLES_REQUIRE_SCRAM=PASS`, `QA_F4I_PRIVATE_SOCKET_FILE_ONLY=PASS`, `QA_F4I_APP_CANNOT_ASSUME_ATTESTOR_OR_READ_REGISTRY=PASS`, `QA_F4I_REAL_SIGNED_JWT_TO_SEPARATE_PROCESS_WALLET=PASS`, `QA_F4I_FORGED_JWT_AND_CALLER_SLUG=DENIED`, `QA_F4I_DURABLE_MERCHANT_SESSION_REVOKED_WITH_VALID_JWT=DENIED`, `QA_F4I_COURIER_ROSTER_SUSPENDED_WITH_VALID_JWT=DENIED`, `QA_F4I_PRIVATE_PROCESS_LIVE_IDENTITY_SQL_SPLIT=PASS`, `QA_F4I_NO_STRIPE_NO_BANK_NO_PAYOUT=PASS`, `QA_F4I_EPHEMERAL_CLEANUP=PASS`.

**Échecs intermédiaires non effacés :** dossier de fixtures chiffrées au mauvais UID (premier échec), mot de passe d'un rôle 013 non installé (migration non encore exécutée à ce point dans la séquence), puis suppression finale des fichiers temporaires refusée au runner non propriétaire. Le banc a été corrigé en conservant les protections (nouvelle migration appliquée avant attribution de secret ; transfert Unix via propriétaire explicite ; nettoyage sous contrôle du chemin runner et du propriétaire). Aucune de ces corrections ne désactive SCRAM, les privilèges SQL, les vérifications Keycloak ou les tests d'attaque. Le code SHA e7c58aee a effectivement passé la phase finale de nettoyage.

**Ne pas sur-interpréter :** cette preuve n'affirme ni la vérification d'une entreprise réelle, ni la robustesse d'une infrastructure d'attestation de production multi-régions, ni l'absence de course entre une révocation métier et la consommation de ticket. Le service privé F4I garde des connexions de lecture des wallets ; prochaine revue de privilèges requise avant toute exposition. L'ancien service de mutation 007 reste bloqué.

**SHA documentaire final :** les trois pipelines seront relus sur le HEAD exact après mises à jour de cette passation, du roadbook financier et de l'architecture. Ne signer la version finale qu'une fois les trois SUCCESS synchronisés.

**État de passage : F4I-CODE-QA-3CI-GREEN / TRUE-KEYCLOAK-BINARY-SYNTHETIC-USERS / OFFICIAL-LEGAL-NO-GO / NO-PAYOUT / NO-MERGE / NO-PROD.**
