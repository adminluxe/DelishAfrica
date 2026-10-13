# DelishAfrica® — Passation F4G : Keycloak éphémère réel → portefeuilles QA PG17

**13 octobre 2026 | PR #39 DRAFT | Certificat réel financier : NO-GO**

> Le logiciel Keycloak 26.4.7 tourne réellement en conteneur isolé ; ses clients, utilisateurs, sessions, certificats et jetons sont **fictifs, entièrement jetables**. PostgreSQL 17 effectue de vraies transactions SQL sur des données financières **synthétiques**. Cette distinction est non négociable.

## Chaîne de branches et preuves antérieures

- Dépôt : `adminluxe/DelishAfrica`.
- F4D : `cd0ba578401d087f9f42c4303e5501704d6bbf94`, deux CI SUCCESS, PR #35 et #36 DRAFT.
- F4E : `ae90656dfe3b25ac69a9b1b32f1ebaec5725822d` ; [PR #37 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/37), CI PG17 `38327446269` et API/3 apps `38327445964` SUCCESS.
- F4F : `7c55cccd1cbce32b2ffb7d604ecf8f16f9202ca5` ; [PR #38 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/38), CI PG17 `38328525983` et API/3 apps `38328525990` SUCCESS.
- Nouvelle branche : `feat/f4g-real-keycloak-partner-session-qa-20261013` ; [PR #39 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/39) empilée sur #38. Aucun merge.
- Worktree Toshiba ancien : `/home/tontoncestcarre/work/DA_STRIPE_RECON_QA_20261012` non écrasé ; VPS `/opt/delishafrica/monorepo/apps/{client,merchant,courier}` **non touché**.

## Pourquoi F4G est nécessaire

F4F testait des signatures RSA fabriquées par le test sur clé locale. F4G exploite un **véritable serveur Keycloak 26.4.7**, un TLS éphémère validé par CA, la découverte OIDC HTTPS et un JWKS réellement publié par le Keycloak du laboratoire, puis l'implémentation `ExternalJwksVerifierService` de l'API. La différence est le comportement de Keycloak réel, **pas** une connexion aux véritables utilisateurs du projet.

Le domaine Keycloak public `keycloak.afritaste.delishafrica.me` n'est jamais interrogé. Une seule origine locale `https://127.0.0.1`, réseau Docker `--network none`, aucun port hôte publié. Les secrets sont générés dans GitHub Actions puis détruits à la fin de l'exécution.

## Livrables QA et frontières

1. `services/api-nest/migrations/client-commerce/20261013_011_partner_session_qa_only.sql` : table d'autorité de session **persistante uniquement pendant le runner éphémère**, hachage SHA-256 du couple `issuer/sub/sid/jti` (aucune valeur brute `sid/jti` stockée), date d'expiration/révocation, propriétaire SQL sans login et `SELECT` seulement pour l'attesteur. Aucun rôle Merchant/Courier ne peut la lire ni l'écrire.
2. `services/api-nest/test/merchant-courier-keycloak-real-wallet.pg-qa.integration.cjs` : quatre comptes test (deux marchands, deux coursiers), rôles et audiences distinctes, mots de passe créés et oubliés par le processus ; vrais JWT RS256 du Keycloak local ; récupération HTTPS des vraies clés JWKS ; introspection des sessions via client confidentiel uniquement QA ; tests des propriétaires d'un wallet PG17, vol de sujet, tentative d'identité inter-application, révocation session/contrat/roster, clés/permissions SQL.
3. `services/api-nest/src/client-commerce/merchant-courier-wallet-signed-session.pg-qa.bridge.ts` : format `jti` Keycloak 26 de type `tr:<identifiant opaque>` accepté de manière bornée ; `sid` et `jti` toujours nécessaires, pas de token arbitraire.
4. `.github/workflows/f4g-keycloak-merchant-courier-wallet-qa.yml` : Keycloak 26.4.7 + PG17, réseaux et TLS isolés, test 009 puis migration/test 010, migration 011 et test réel de Keycloak, nettoyage automatique.
5. `.github/workflows/client-enrollment-gate.yml` : code source F4G contrôlé dans le même passage API TypeScript + les trois apps.

Pour accélérer le contrôle du backend, les clients OAuth **jetables du laboratoire** autorisent exceptionnellement le grant password. Cela **ne certifie pas** la connexion interactive native Authorization Code + PKCE, qui doit être évaluée dans G0–G7.

## Observations contrôlées jusqu'au jalon

- Les anciens tests PostgreSQL 009 et 010 ont réussi dans le nouveau runner ; le schéma 011 a été installé en PostgreSQL isolé.
- Keycloak 26.4.7 a réellement répondu, ses JWT Merchant/Courier ont été signés et vérifiés via JWKS, avec introspection du fournisseur.
- Les premières tentatives ont échoué de façon fermée : contrôle de sécurité statique auto-déclenché puis profil utilisateur QA incomplet et format `jti`/pont à ajuster. Les runs FAILED restent traçables ; aucune certification F4G ne peut être réclamée avant deux CI vertes sur un SHA identique.
- Le test exige que Merchant A puisse lire seulement les **1 840 centimes synthétiques** déjà gelés par l'historique 009, Merchant B zéro, Courier A/B zéro faute d'offre correspondant à leur identité Keycloak ; ne pas confondre ce zéro avec un test de versement réel.
- `withdrawableMinor=0`, `payoutEnabled=false` et `STRIPE_PROVIDER_CALLS=ZERO` obligatoires.

## Validation P0 réelle toujours manquante

- Aucune lecture des identités Keycloak public, aucun véritable contrat ni KYB, aucune véritable liste d'habilitation Courier, aucun espace financier réel ne sont certifiés.
- `AuthService` ne dispose actuellement que d'une révocation Redis explicitement codée pour Client ; le registre QA 011 et le logout Keycloak éphémère ne remplacent pas un service de révocation persistant Merchant/Courier en production.
- L'attesteur et sa clé/confidentialité doivent être **véritablement séparés** de l'API publique et bornés en droits SQL ; le port de test se sert de faux registres et d'un compte PostgreSQL de maintenance pour les injecter.
- Le modèle 009 n'a pas encore toutes les dimensions entité juridique, territoire, devise, régime fiscal, réserves contractuelles, remboursements partiels, chargebacks et settlement.
- Les mutations Merchant/Dispatch/Courier historiques 007 restent interdites après le verrou 010 : rétablissement seulement après attestation d'écriture et tests adversariaux.
- Ni Stripe TEST officiel, ni Stripe LIVE, ni migration VPS, ni fusion, ni builds payants, ni Store, ni payout sans approbation et G0–G7.

**Statut : F4G QA VALIDÉ SUR CODE SHA 21cd567d / identités réelles de production NO-GO ; flux financiers réels = ZÉRO.**

---

## H. Certification du premier SHA F4G avec Keycloak réellement exécuté

**Code SHA `21cd567d07ef31a91ed199df299c8bce3c24fd4a`, triple CI SUCCESS :**

- [Keycloak 26.4.7 réel + PG17 + wallets Merchant/Courier — #38329914958](https://github.com/adminluxe/DelishAfrica/actions/runs/38329914958) — **SUCCESS**.
- [API TypeScript + Client/Merchant/Courier — #38329914989](https://github.com/adminluxe/DelishAfrica/actions/runs/38329914989) — **SUCCESS**.
- [Laboratoire PostgreSQL 17 complet, finance et concurrence — #38329915018](https://github.com/adminluxe/DelishAfrica/actions/runs/38329915018) — **SUCCESS**.

Marqueurs consultés dans la CI Keycloak : `QA_F4G_LOCAL_KEYCLOAK_REAL_HTTPS_JWKS=PASS`, `QA_F4G_FOUR_REAL_KEYCLOAK_SIGNED_PARTNER_JWTS_AND_INTROSPECTION=PASS`, `QA_F4G_REAL_KEYCLOAK_MERCHANT_A_B_PG17_SEPARATION=PASS`, `QA_F4G_KEYCLOAK_REAL_COURIER_UNASSIGNED_ZERO_EARNINGS=PASS`, `QA_F4G_TAMPERED_RSA_AND_KEYCLOAK_CROSS_ROLE=DENIED`, `QA_F4G_SIGNED_JWT_BUT_DURABLE_PG_SESSION_REVOKED=DENIED`, `QA_F4G_REAL_KEYCLOAK_LOGOUT_INTROSPECTION_INACTIVE=PASS`, `QA_F4G_SIGNED_JWT_KYB_CONTRACT_ROSTER_REVOCATION=DENIED`, `QA_F4G_ATTESTOR_AND_APP_LEAST_PRIVILEGE=PASS`, `QA_F4G_STRIPE_CALLS=ZERO_PAYOUTS=ZERO`.

**Renseignement nouveau issu des vrais JWT Keycloak 26 :** `sid` satisfait une forme bornée simple ; `jti` est une valeur opaque signée de 43 caractères incluant `:`. La lecture précédente échouait à tort sur ce format ; le bridge ne l'accepte désormais que sous une expression rationnelle bornée de caractères imprimables autorisés et le hache avant recherche SQL paramétrée. Aucun jeton, `jti`, `sid` ou secret en clair n'a été journalisé.

La certification F4G porte sur un **Keycloak réel dans un environnement fictif entièrement isolé**, des contrats/KYB et le registre Courier **toujours synthétiques**, une table session 011 **éphémère**, et des soldes d'essai qui **ne peuvent pas être retirés**. Le prestataire de paiement réel, le Keycloak public et le registre juridique officiel ne sont pas raccordés.

**Important :** les correctifs ultérieurs (notamment l'échappement explicite `\/` dans la grammaire `jti`, puis les commits documentaires) doivent repasser en CI sur le SHA final pour signer le HEAD de PR #39. Les échecs intermédiaires du laboratoire restent archivés. Aucune fusion et aucun déploiement.
