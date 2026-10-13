# DelishAfrica® — F4E / P0 Wallet scope : passation de laboratoire QA
**13 octobre 2026 | CANDIDAT EN CERTIFICATION, NON DÉPLOYÉ | PR #37 DRAFT**

> Source de référence F4D certifiée : `cd0ba578401d087f9f42c4303e5501704d6bbf94`.
> Les tests F4D PostgreSQL17 [38325285489](https://github.com/adminluxe/DelishAfrica/actions/runs/38325285489) et API + trois applications [38325285497](https://github.com/adminluxe/DelishAfrica/actions/runs/38325285497) sont SUCCESS **sur ce SHA F4D**, pas sur les nouveaux patchs.
> F4E doit obtenir ses **propres CI vertes sur son SHA final**. Les échecs intermédiaires restent consignés et ne sont jamais assimilés à une certification.

## 1. Dépôts, frontières et mode opératoire

- Repo : `adminluxe/DelishAfrica`.
- Ancienne branche QA F4D **inchangée** : `feat/stripe-test-reconcile-pg-qa-20261012`, PR #36 DRAFT.
- **Nouvelle branche isolée** : `feat/f4e-wallet-scope-isolation-qa-20261013`, [PR #37 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/37) basée sur la précédente.
- Worktree Toshiba F4D : `/home/tontoncestcarre/work/DA_STRIPE_RECON_QA_20261012`, inspecté propre sur `cd0ba57`; aucun reset/checkout/patch requis sur cet arbre.
- Repo VPS d'applications distribuées : `/opt/delishafrica/monorepo/apps/{client,merchant,courier}`, **strictement non touché**.
- Migration 010 exécutée **uniquement après 001–009** dans conteneur CI PostgreSQL17 éphémère `--network none` sans port publié ni Stripe externe. Jamais appliquer cette migration sur VPS ou base existante.

## 2. P0 : faits confirmés par audit de sources

1. Les anciennes fonctions SQL de wallet 009 `SECURITY DEFINER` prennent `merchantSlug` ou `issuer/subject` choisis par le caller PostgreSQL. L'app valide auparavant le partenaire dans Nest, mais son rôle PG partagé peut théoriquement appeler les fonctions pour un tiers.
2. Les fonctions de lecture et mutation Merchant/Courier 007 disposent d'une vulnérabilité de principe semblable. L'absence de connexion de ces routes aux apps de production ne transforme pas leur contrat SQL en frontière cryptographique.
3. `ExternalJwksVerifierService` vérifie RS256, issuer, dates et rôles, mais la séparation stricte multi-audience/azp des JWT Merchant/Courier demandait un contrôle équivalent à celui du Client.
4. `AuthService` contrôle la révocation Redis des sessions Client ; une révocation globale effective pour les sessions Merchant/Courier et un vrai attestor séparé restent à démontrer.
5. Les memberships Merchant PostgreSQL comprennent statut actif, contrat, KYB, fenêtre de validité et révocation. Le port QA de registre Courier n'est encore qu'une frontière contractuelle simulée dans les tests HTTP.

## 3. Candidat F4E 010 / correction SQL fail-closed

Fichier : `services/api-nest/migrations/client-commerce/20261013_010_wallet_tenant_bound_scope_qa_only.sql`.

- Révoque les accès directs à l'ancien portefeuille par `merchantSlug/issuer/subject`, et bloque les anciennes mutations Merchant/Courier/Dispatch des rôles applicatifs. Toute écriture future devra être réintroduite par un port **attesté** distinct.
- Propriétaires des fonctions wallet de lecture et de finance : rôles séparés `NOLOGIN NOSUPERUSER`. Finance n'a que les droits nécessaires au journal + verrouillage des lignes d'autorité; pas de payout.
- L'observation de l'heure de début du backend PG est isolée dans un autre rôle `NOLOGIN` bénéficiant de `pg_read_all_stats`, dont la seule fonction autorisée retourne l'horodatage du **backend courant**. Ce privilège de monitoring demeure exceptionnel et devra faire l'objet d'une revue IAM avant production.
- Role d'attestation indépendant de l'app `da_qa_wallet_attestor_010` ; challenge aléatoire, `session_user`, PID et heure de démarrage du backend, durée 30 s ; ticket limité à 20 s, utilisé une seule fois.
- App role reçoit exclusivement la capacité `da_qa_wallet_read_attested_010(ticket,limit)`. Aucune entrée HTTP ou SQL de scope marchand/sujet n'est autorisée sur cette fonction.
- Validation à l'émission **puis à la consommation** : issuer+subject, membership actif, contrat actif, KYB vérifié, organisation, territoire, roster actif/non révoqué, dates valides.
- Registres 010 **100 % synthétiques** ; unique propriétaire de slug Merchant et un seul territoire autorisé par identifiant Courier, car le ledger 007–009 ne porte pas encore l'entité juridique et la géographie de chaque attribution.

**Limite explicite :** l'attestor 010 ne valide pas lui-même la signature JWT. Avant production, une identité cryptographiquement vérifiée doit lui être transmise par un service isolé avec contrôle de session/révocation/contrat/roster et preuve d'absence de substitution. Un rôle attestor compromis demeure un point de risque majeur.

## 4. Gate OIDC Merchant/Courier

Fichiers :
- `services/api-nest/src/auth/merchant-courier-token-isolation.ts`
- `services/api-nest/test/merchant-courier-oidc-isolation.qa.test.cjs`
- `services/api-nest/src/auth/external-jwks-verifier.service.ts` : appel du gate **après** validation de signature RSA.

Matrice négative : app audience étrangère, audiences mixtes, `azp` non conforme, rôles Client/Courier/Merchant/Ops mêlés, privilèges realm-management, subject non UUID. Le gate vérifie seulement les claims d'un jeton signé par l'amont ; les tests de claims synthétiques ne sont **pas** une certification d'une vraie session Keycloak Merchant/Courier de bout en bout.

## 5. Matrice adversariale PostgreSQL 17

Test : `services/api-nest/test/merchant-courier-wallet-tenant-scope.pg-qa.integration.cjs`.

- Deux commerçants dans organisations/territoires séparés ; le second ne doit jamais voir la créance du premier.
- Deux coursiers ; sujet identique sur **deux realms distincts** ; aucune fuite cross-realm.
- Appel direct de fonction historique en tant que rôle d'app : `permission denied`.
- Attestation uniquement par login distinct ; vol de ticket depuis une autre connexion de même rôle ou rôle différent : refus.
- Mauvais issuer, subject, merchantSlug, organisation ou territoire : refus.
- Revocation KYB et registre Courier après ticket émis : refus à la lecture.
- Non-superuser, NOLOGIN, somme synthétique du ledger, replay ticket interdit.
- Sortie : `withdrawableMinor=0`, `payoutEnabled=false`, **aucun mouvement Stripe ou banque**.

Exécution CI : [workflow PG17](https://github.com/adminluxe/DelishAfrica/actions/workflows/native-client-commerce-authority-postgres-qa.yml) et [gate API + 3 apps](https://github.com/adminluxe/DelishAfrica/actions/workflows/client-enrollment-gate.yml). Ne signer le palier qu'après double SUCCESS sur le même SHA final.

## 6. Traçabilité des incidents / blocages non dissimulés

- Premier F4E PostgreSQL17 `38326871118` : FAILED, `qa_scope_backend_missing` sous propriétaire `SECURITY DEFINER`. Les anciens tests 001–009 avaient PASS. Une correction a isolé `pg_read_all_stats` dans un propriétaire de fonction sans login.
- Second F4E PostgreSQL17 `38327037757` : FAILED pour le même contrôle de backend ; le rôle d'observation `NOINHERIT` ne recevait pas effectivement la capacité de lecture. Correction : observer `INHERIT`, sans privilège superuser.
- Les gates API + 3 apps ont obtenu SUCCESS sur plusieurs SHAs intermédiaires, mais il faut revérifier le **SHA final** avec le nouveau contrôle OIDC.
- Ce document n'affirme pas que le dernier SQL 010 passe déjà tant que sa CI propre n'est pas attestée.

## 7. Ce qui manque avant certificat **P0 réel**

- Attestor isolé relié à des **vrais** jetons Keycloak Merchant/Courier, signature/issuer/audience/azp, session et rotation/révocation contrôlés.
- Connecteur de preuve **durable** pour contrat, KYB, organisations et roster Courier (pas JSON ni mock).
- Menaces « rôle applicatif compromis » et « rôle attestor compromis », secrets courts, connexions poolées, replays, réaffectation de coursier, multi-org/multi-territoire/multi-realm.
- Port SQL de mutation Merchant/Dispatch/Courier sécurisé comme la lecture 010 puis tests d'ordre et de remboursement F4C inchangés.
- Politique par pays/devise/contrat/PSP, TVA, FX, frais, refunds partiels, disputes, settlement/payout avec fournisseur marketplace autorisé. Aucune politique QA 20 % ne devient contrat commercial automatiquement.
- Stripe TEST officiel et G0–G7 : toujours **NO-GO**. Aucun merge, VPS, build payant, soumission Store ou LIVE.

## 8. Expérience partenaire cible, non raccordée

Merchant : « capturé », « en attente », « disponible opérationnellement », « bloqué pour litige » ; commission détaillée par commande, devise et contrat. Courier : une ligne par course attribuée, gains réservés après offre, disponibles après livraison validée. Rechargement après événement **certifié par serveur** et dernière synchronisation visible hors ligne. Ne pas afficher un chiffre décoratif comme de l'argent véritable. `withdrawable=0` jusqu'au processus PSP/KYC/KYB légalement opérationnel.

**Signature opérationnelle provisoire : F4E-P0-QA-CANDIDATE / NON CERTIFIED REAL OIDC / ZERO_PAYOUT / NO_PRODUCTION / NO_MERGE / NO_STORE.**

---

## 9. Contrôles CI réalisés et source des identités mobiles

**Preuves sur le même SHA de code `f97567f3e7c89ae5f80e33261cd2da6a2045dfb8` :**

- [PostgreSQL17 et tests 010 #38327215358](https://github.com/adminluxe/DelishAfrica/actions/runs/38327215358) : `SUCCESS`, journal `QA_010_SQL_ROLE_SESSION_ISSUER_ORG_TERRITORY_ADVERSARIAL=PASS` ; `QA_010_KYB_REVOCATION_AFTER_TICKET=DENIED` ; `QA_010_COURIER_ROSTER_REVOCATION_AFTER_TICKET=DENIED` ; `QA_010_STRIPE_CALLS=ZERO_PAYOUTS=ZERO`.
- [API + Client/Merchant/Courier #38327215429](https://github.com/adminluxe/DelishAfrica/actions/runs/38327215429) : `SUCCESS`, matrice de claims partenaires et TypeScript incluse.

Autre constat d'audit de code : `apps/merchant/auth/daHf16RealOidc.ts` et `apps/courier/auth/daHf16RealOidc.ts` possèdent déjà un protocole QA de connexion OIDC Authorization Code + PKCE avec audiences et authorized party spécifiques, et testent `/auth/merchant/me`, `/auth/courier/me` et barrières cross-role depuis l'application. C'est un **point de raccordement à exploiter**, non une preuve que le rôle SQL 010 reçoit déjà ces vraies identités. Les configurations clientes ciblent le realm Keycloak `https://keycloak.afritaste.delishafrica.me/realms/afritaste`; les faux realms `qa.example.invalid` utilisés en 010 n'y sont pas connectés.

**Le gate F4E SQL + claim est vert ; le gate P0 d'identité complète reste rouge.** Avant la future intégration il faudra confronter la signature réelle et les audiences/azp renvoyées par Keycloak, vérifier le service de révocation des sessions Merchant/Courier et l'autorité juridique du registre, puis attester ces faits sur la même requête que la lecture SQL. Aucun service d'attestation réel n'a été activé par cette PR.
