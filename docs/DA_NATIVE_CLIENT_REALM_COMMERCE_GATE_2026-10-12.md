# DELISHAFRICA — PISTE CLIENT NATIF KEYCLOAK + ADMISSION COMMERCIALE
**12 octobre 2026 — PR #35 DRAFT — candidat QA seulement.**

## Verdict actuel
- **IAM synthétique prouvée** sur véritable Keycloak 26.4.7 isolé en CI : [POG Actions #38250282773](https://github.com/adminluxe/purple-orchid-group/actions/runs/38250282773). Inscription native realm fictif Client distinct → email capturé dans SMTP local → clic lien de validation → OIDC Authorization Code + **PKCE S256** → signatures RSA des deux JWT effectivement vérifiées avec JWKS du realm synthétique ; `iss`, `sub`, `exp`, `iat`, `aud`, `azp`, `nonce`, rôle `client` unique et refus de rejouer le code OAuth HTTP400.
- **Candidate de contrôle métier** ajoutée ici : `services/api-nest/src/auth/native-client-commerce.policy.ts` + matrice de tests `services/api-nest/test/native-client-commerce.policy.test.cjs`. CI [Client Enrollment V1](https://github.com/adminluxe/DelishAfrica/actions/runs/38251302272) SUCCESS sur commit `8b52355d979c875b046c18af041fc2b79cc4b831`. Testé uniquement en mémoire avec données synthétiques, sans accès à une vraie base, vrai SMS, Keycloak de production ou transaction.
- **AUCUN RACCORDEMENT aux routes `orders`, `checkout`, `payment` ni `app.module`** à ce stade : le code de production reste inchangé. La CI inclut explicitement un test pour éviter un branchement accidentel du candidat avant la revue de sécurité.
- **Décision : QA IAM limitée PASS ; END-TO-END CLIENT / SERVICE AUTH / PAIEMENT / STORE NO-GO.**

## Pourquoi deux verrous sont indispensables
1. **Authentification Keycloak** : l'utilisateur a une identité contrôlée. JWT d'accès vérifié cryptographiquement, issuer exact issu de la configuration revue, audience et `azp` Client, expiration, rôle `client` exclusif, `email_verified=true` du serveur. *Une simple carte « e-mail vérifié » dans l'app n'est pas une preuve.*
2. **Autorisation commerciale** : la même identité `sub` doit avoir **un dossier PostgreSQL durable** approuvé avec validation SMS du fournisseur pour ce numéro, la preuve d'e-mail liée au même utilisateur, une empreinte HMAC d'e-mail concordante et une transaction de validation commitée. Sans cette deuxième condition, un Client parfaitement connecté doit recevoir un refus de commander/payer.

Le module `evaluateNativeClientCommerce` est une fonction pure, conçue pour être appelée uniquement APRÈS vérification de la signature et depuis un service lisant sa DB en confiance. Les objets `signatureVerified` et `issuerKeysPinned` sont **des assertions internes du vérificateur**, jamais un champ accepté du corps HTTP. De même, `ledger.status=approved` ne doit jamais venir d'une réponse mobile, d'un cookie ou d'un cache non autoritatif. Le module n'est pas, en soi, un vérificateur JWT, un SMS provider, un commit PostgreSQL, un système d'autorisation de commande ni une certification.

## Risques réels trouvés dans le code existant
- `apps/client/auth/daOidcConfig.ts` pointe actuellement sur l'émetteur historique `https://keycloak.afritaste.delishafrica.me/realms/afritaste` et sur `clientId/audience=delishafrica-client`. L'expérience n'a créé qu'un realm fictif, **aucun realm Client réel**.
- `services/api-nest/src/auth/external-jwks-verifier.service.ts` contient une **configuration d'émetteur unique**, partagée avec les rôles Merchant/Courier/Ops. Une migration doit préserver les vérifications de signatures et audiences des identités historiques, en validant le nouvel issuer Client séparément et sans mélange de clés JWKS entre realms.
- `services/api-nest/src/auth/client-token-isolation.ts` autorise `default-roles-afritaste`; un nouveau realm nécessite une politique de rôles strictement propre à son émetteur. Jamais accepter plusieurs issuer par simple condition `includes()` ou utiliser les JWT d'un realm avec les JWKS d'un autre.
- `services/api-nest/src/identity-proof/identity-proof.service.ts` annonce aujourd'hui `persistence:false`, `memory_single_instance` et `proofExpiryDays:30`. La création de comptes internationaux ne peut pas dépendre d'un état volatile de preuve ni d'une preuve SMS non fraîche sans révalidation serveur/idempotence.
- Le provisionneur `services/api-nest/src/client-enrollment/client-enrollment.keycloak.ts` utilise encore un `REALM='afritaste'`. Le groupe de tests POG démontre que `realm-management.manage-users` confère des droits trop larges dans un même realm ; le laboratoire FGAP V2 sans ce rôle n'a pas prouvé une permission d'activation ciblée. **Ne jamais élargir ces privilèges en production pour obtenir un test vert.**

## Gates avant brancher l'iPhone réel
1. Création d'un **nouveau realm Client uniquement sur une QA isolée**, sans import de comptes historiques ni SMTP réel au premier essai. Le workflow synthétique déjà PASS sert de référence de régression.
2. Implémentation d'un **vérificateur JWT Client avec configuration JWKS/issuer séparée** et tests négatifs : fausses clés/algorithmes, tokens Merchant/Courier/Ops, nonce PKCE, aud/azp erronés, expiration, rôles composites, rotation de clé et suppression de session.
3. Création d'un registre **PostgreSQL indépendant** à contraintes d'intégrité et unicité, ne conservant que des hachés HMAC et IDs techniques : `sub` Keycloak Client, statut pending/approved/revoked, preuve e-mail serveur, SMS fournisseur et temps de vérification, empreinte SMS non rejouable, commit transactionnel durable. Anti-abus, concurrence/multi-instance et restaurabilité testés sur DB QA réelle.
4. Exécution de la matrice de refus en HTTP sur **le backend réellement câblé** : utilisateur connecté mais sans SMS → **403** ; absence de ledger → **403** ; autre `sub`, autre e-mail, SMS réutilisé/expiré, autre realm, token falsifié ou rôle `merchant` injecté → refus sans écriture commande ni Stripe. Ne jamais confondre test de pure fonction avec preuve de route active.
5. Validation sur iPhone QA `8095` avec vrai e-mail reçu et vrai SMS QA autorisé. Login OIDC sur l'application via clientId/issuer/redirect natifs, retour au panier guest inchangé, aucun paiement implicite. Android idem avant Store.
6. Stripe **TEST uniquement**, confirmation webhook/ledger commande idempotent, Merchant accepte/prépare, Courier prend en charge/livre, Client observe `delivered` avec un identifiant commun et erreurs/retry.
7. Revue G0–G7 du binaire **exact**, QA propriétaire + approbations humaines et sauvegardes testées avant toute soumission.

## Confinement des effets
- `/opt/delishafrica/monorepo` : branche VPS ancienne et **21 entrées locales modifiées/non suivies à préserver** ; aucune intervention.
- API publiques `3010` et `3011` en santé ; endpoint enrollment public HTTP404.
- QA `127.0.0.1:3095` readiness HTTP200 **enabled:false** ; Expo Client Asus `8095` répond HTTP200.
- Realm historique `afritaste`, identités Merchant/Courier, bases PostgreSQL live, Stripe LIVE, EAS, App Store et Google Play : **intacts**.
- PR DelishAfrica #35 et POG #35 **DRAFT**, pas de fusion, pas de déploiement.

**Preuves connexes** : [Rapport POG FGAP V2](https://github.com/adminluxe/purple-orchid-group/blob/audit/security-global-baseline-20261012/docs/security/POG_KEYCLOAK_FGAP_V2_REAL_HTTP_LAB_2026-10-12.md) · [rapport POG Keycloak native](https://github.com/adminluxe/purple-orchid-group/blob/audit/security-global-baseline-20261012/docs/security/POG_KEYCLOAK_NATIVE_CLIENT_QA_2026-10-12.md).

## Addendum — six jalons QA isolés, dernier contrôle cryptographique

**Keycloak natif réel — laboratoire synthétique :**
- [CI inscription + SMTP local #38249546756](https://github.com/adminluxe/purple-orchid-group/actions/runs/38249546756) : SUCCESS.
- [CI action-token e-mail #38249816999](https://github.com/adminluxe/purple-orchid-group/actions/runs/38249816999) : SUCCESS, `emailVerified:true` prouvé.
- [CI OIDC PKCE/JWKS #38250282773](https://github.com/adminluxe/purple-orchid-group/actions/runs/38250282773) : SUCCESS, échanges OAuth HTTP200, RSA/JWKS ID/access tokens réellement validés, nonce, audience, `azp`, rôle Client exclusif et code rejoué HTTP400.

**DelishAfrica branche PR #35 DRAFT :**
- [CI d'admission pure et compilations #38251302272](https://github.com/adminluxe/DelishAfrica/actions/runs/38251302272) : SUCCESS sur candidat non intégré aux routes.
- [PostgreSQL 17 QA isolé #38252079967](https://github.com/adminluxe/DelishAfrica/actions/runs/38252079967) : SUCCESS, 11 messages `QA_PASS` sur vraies contraintes/transactions Postgres ; aucun port hôte, réseau Docker `none`, conteneur détruit. Migration candidate `20261012_002_native_client_admission_qa_only.sql` : **NON APPLIQUÉE sur VPS**. Preuves : impossible d'approuver sans e-mail/SMS, empreinte SMS non rejouable sur autre sujet, `sub`/e-mail immuables, refus SMS ancien, révocation irréversible.
- [CI vérificateur Client distinct RSA/JWKS et registre #38252895810](https://github.com/adminluxe/DelishAfrica/actions/runs/38252895810) : SUCCESS sur SHA `a868f4dabf6ed2bc27bbb514e411806819c718a3`. Fichiers candidats `services/api-nest/src/auth/native-client-jwt-verifier.ts` et `test/native-client-jwt-verifier.test.cjs`. Test réel de signatures RSA éphémères ; mauvais issuer, JWKS d'autre realm, rôles/audiences prohibés et JWT trafiqués refusés. Le vérificateur ne fetch PAS les JWKS lui-même : **le résolveur HTTPS issuer-pinné est à créer puis à tester en QA**.

**IMPORTANT — aucune fausse certification :** le JWT RSA de cette dernière CI est fabriqué par le test, distinct du token effectivement généré par Keycloak dans l'autre laboratoire ; les deux composants ne sont pas encore reliés à la même API QA. Le résultat de la pure admission teste une **attestation SMS simulée**, et celui de PostgreSQL des preuves structurées synthétiques : le service réel doit lui-même confirmer les attestations du fournisseur, les lier au sujet OIDC et valider la transaction DB avant toute route sensible.

Le worktree d'exploitation `/opt/delishafrica/monorepo` avec 21 entrées locales préservées reste **inchangé** ; API 3010/3011 non modifiées, 3095 `enabled:false`, enrollment public HTTP404. Pas de LIVE, EAS, build ou Stores. Prochaine preuve bloquante : **intégration HTTP QA vérifiant un JWT issu de Keycloak isolé + registre PostgreSQL isolé + fausse attestation SMS, avec 401/403 sur toutes requêtes non approuvées, sans lien au VPS live**.

## Jalon réel de raccordement HTTP isolé : Keycloak → RSA/JWKS → SMS mock → PostgreSQL

**12/10/2026 — CI [#38267452006](https://github.com/adminluxe/DelishAfrica/actions/runs/38267452006) **SUCCESS**, SHA `a431fe56efbb4a6d07a7b894ea913a263d280b62`. Cette fois, les composants ne sont plus testés exclusivement de façon séparée : la QA a exécuté **un seul scénario HTTP multi-services réellement connecté**, avec véritables conteneurs **Keycloak 26.4.7** et **PostgreSQL 17** partageant un espace réseau Docker `--network none`, aucun port hôte publié. Toute ressource est jetable et supprimée au terme de la CI.

Fichiers de référence complets, PR DelishAfrica #35 DRAFT :
- `.github/workflows/native-client-full-stack-qa.yml`
- `services/api-nest/test/native-client-full-stack.qa.cjs`
- `services/api-nest/test/synthetic-keycloak-tls-proxy.qa.cjs`
- les composants réels candidats `src/auth/native-client-jwt-verifier.ts`, `native-client-commerce.policy.ts` compilés en CommonJS temporaire sans altérer le projet
- migration candidate `migrations/client-enrollment/20261012_002_native_client_admission_qa_only.sql` appliquée **uniquement** à la base PostgreSQL éphémère.

**TLS sans rabais sécuritaire :** certificat X.509 IP `127.0.0.1` et autorité racine éphémères pour une terminaison HTTPS locale port 443 ; Node valide le certificat via `NODE_EXTRA_CA_CERTS` et le vérificateur Client impose toujours l'issuer HTTPS strict `https://127.0.0.1/realms/da-native-client-qa`, sans port arbitraire, sans désactivation TLS. Le serveur Keycloak écoute uniquement la boucle locale de la même enclave réseau.

**Preuves positives et négatives réellement observées dans un seul job :**
- Inscription native Client fictive, tentative d'injection `merchant` sans effet, faux SMTP local recevant le courriel ; action-token validé, `emailVerified:true`.
- Authorization Code PKCE S256, `state`, `nonce`, vérification de la signature RSA des tokens réellement émis par Keycloak. Code OAuth rejoué : HTTP400.
- **Le véritable access token Keycloak**, jamais imprimé dans les journaux, est vérifié par **le fichier candidat DelishAfrica** `native-client-jwt-verifier.ts` : issuer HTTPS exact, découverte OIDC et URI JWKS concordants, signatures RS256, audience ajoutée explicitement à ce Client, `azp`, `sub`, `email_verified:true` et e-mail du compte identiques.
- Création de la ligne **pending** dans la vraie base PostgreSQL QA ; service HTTP de commerce en boucle locale **401** sans Bearer JWT, **401** avec JWT falsifié, **403** avec admission en attente / sans preuve SMS.
- Fournisseur SMS **simulé exclusivement dans l'enclave** : mauvais OTP, autre sujet et mauvais destinataire refusés ; challenge valide émet une empreinte fournisseur non rejouable, deuxième utilisation refusée **409**. Aucun SMS réel envoyé.
- Transaction PostgreSQL d'approbation avec e-mail issu de Keycloak, sujet identique et preuve SMS factice, persistée dans PostgreSQL : **HTTP 200** observé sur la route de test `/qa/commerce/check`.
- La même preuve SMS factice ne peut pas approuver un autre sujet (violation unicité PostgreSQL), la révocation du compte retourne immédiatement **HTTP403**, et la réactivation manuelle échoue via trigger.
- En fin de run : `QA_NATIVE_FULL_STACK_QA=PASS_REAL_KEYCLOAK_JWT_TLS_REAL_POSTGRES_FAKE_SMS_HTTP`, `QA_NATIVE_CLIENT_FULL_STACK=PASS_SYNTHETIC_ONLY`, `PRODUCTION_IMPACT=NONE`, `QA_EPHEMERAL_RESOURCES_DESTROYED=YES`.

**VERDICT : PASS pour le chemin d'intégration QA HTTP à services réels, avec SMS et SMTP fictifs. NO-GO pour le produit réel.** Le serveur HTTP testé est **un harnais Node QA**, non un véritable contrôleur Nest branché aux routes `orders`/`checkout`/`payments`. Les assertions et JWT sont construits et validés dans ce harnais ; aucun endpoint de production n'a été modifié ni validé par cette seule CI. Un token HTTPS local n'est pas un issuer de production. Il reste à intégrer et tester le **résolveur HTTPS JWKS avec pinning**, le vrai contrôleur Nest et ses refus 401/403, l'interface fournisseur SMS en mode sandbox avec attestations indépendantes, la persistance PostgreSQL cible multi-instance et la séparation de realm de l'app iPhone/Android. Ensuite : **Stripe TEST** et E2E Client → Merchant → Courier → livré, revue sécurité binaire G0–G7 avant tout push Stores.

**Confinement toujours strict** : realm historique `afritaste`, VPS `/opt/delishafrica/monorepo` (21 entrées locales préservées), clés live, terminaux SSH, bases live, domaines et stores **intacts**. Toute QA d'inscription publique réelle reste désactivée.

## Jalon suivant — VRAI guard NestJS alimenté par le VRAI access token Keycloak

**Preuve certifiée en QA isolée le 12/10/2026 : trois workflows SUCCESS sur le même commit `85f66fa37c4982c7a6fa6396553c649d10eb9cba` :**
- [GitHub Actions #38270870540](https://github.com/adminluxe/DelishAfrica/actions/runs/38270870540) **SUCCESS** : chaîne **Keycloak 26.4.7 réel → HTTPS local avec CA éphémère et certificat vérifié → inscription Client native et vérification e-mail via SMTP factice → OAuth Code PKCE S256 → access token réel signé Keycloak → détection issuer/JWKS/aud/azp/email_verified → VRAI guard `NativeClientNestCommerceGuard` dans un vrai serveur NestJS éphémère → lecture PostgreSQL 17 réelle → SMS provider MOCK exclusivement local → HTTP 200 après commit**. Aucun token, OTP ou secret de QA n'est imprimé dans les journaux.
- [GitHub Actions #38270870584](https://github.com/adminluxe/DelishAfrica/actions/runs/38270870584) **SUCCESS** : schéma PostgreSQL contraint, unicité preuve SMS, liaison identité, fraîcheur et révocation.
- [GitHub Actions #38270870578](https://github.com/adminluxe/DelishAfrica/actions/runs/38270870578) **SUCCESS** : compilation TypeScript API et trois applications, tests existants, matrice de contrôles et **test HTTP du vrai garde NestJS avec JWT RSA synthétique** `services/api-nest/test/native-client-nest-commerce.guard.test.cjs`.

**Assertions intégrées effectivement visibles dans la CI #38270870540** :
- `QA_PASS=nestjs_keycloak_missing_bearer_denied_http_401` et `nestjs_actual_keycloak_jwt_tamper_denied_http_401`.
- `QA_PASS=nestjs_actual_keycloak_jwt_pending_sms_denied_http_403`.
- `QA_PASS=nestjs_real_keycloak_jwt_real_pg_after_mock_sms_admitted_http_200`.
- `QA_PASS=nestjs_real_keycloak_jwt_revoked_pg_denied_http_403`.
- `QA_PASS=nestjs_pg_unavailable_fail_closed_http_503`, `nestjs_jwks_unavailable_fail_closed_http_503`.
- `QA_NATIVE_CLIENT_FULL_STACK=PASS_SYNTHETIC_ONLY`, `PRODUCTION_IMPACT=NONE`, `QA_EPHEMERAL_RESOURCES_DESTROYED=YES`.

**Fichiers complets de QA** : `services/api-nest/src/auth/native-client-nest-commerce.guard.ts` (candidat non enregistré dans AppModule), `services/api-nest/test/native-client-nest-commerce.guard.test.cjs`, `services/api-nest/test/native-client-full-stack.qa.cjs`, `services/api-nest/test/synthetic-keycloak-tls-proxy.qa.cjs`, `.github/workflows/native-client-full-stack-qa.yml`. Un serveur NestJS monté dynamiquement sur le loopback QA reçoit le même access token réellement émis par Keycloak ; sa dépendance de résolution JWKS refait la découverte OIDC et la récupération des clés en HTTPS local vérifié, puis le guard lit directement l'enregistrement PostgreSQL avec paramètres `issuer/sub` dérivés du JWT. Panne forcée JWKS ou PostgreSQL : 503 et aucun accès.

**VERDICT : GO preuve d'intégration IAM + contrôle d'admission dans NestJS, mais UNIQUEMENT dans une enclave CI jetable**. Les routes fonctionnelles `orders/create`, `payments/*` et `stripe/*` du vrai AppModule ne sont pas traversées et ce garde n'y est PAS enregistré ; les tests le vérifient. Le fournisseur SMS et le SMTP sont fictifs ; pas de transaction Stripe (même TEST), pas de compte Client réel, pas de build iOS/Android, pas de création de realm live. Le scénario ne prouve pas encore les contraintes de concurrence et d'idempotence appliquées aux routes réellement métier, l'accessibilité mobile, la compatibilité historique Merchant/Courier/Ops ni la restauration du ledger.

**Ordre des prochaines étapes sans régression** : introduire un adaptateur **configuré exclusivement par serveur** pour issuer+JWKS Client indépendant, un port repository PostgreSQL transactionnel relié à la vraie API, et une interface fournisseur SMS *sandbox* au cycle de vie idempotent. Protéger d'abord une route NestJS **QA isolée**, puis faire traverser un contrat `orders/create` et `payments` en staging avec garde 401/403 avant toute écriture et Stripe TEST uniquement. Préserver le parcours guest, les anciens tokens Merchant/Courier/Ops, le monorepo VPS et les 21 modifications locales. Exiger 100 % CI, QA appareil propriétaire et validation G0–G7 sur le binaire exact avant merge/release.

## Dernier verrou IAM synthétique — résolveur JWKS HTTPS vérifié et filtrage Keycloak multi-algorithme

**Révision 12/10/2026, SHA `ad987462073ea72eda04dea31270ed869593f829` — TRIPLE SUCCESS sur le même HEAD** :
- [CI vrai Keycloak 26.4.7 HTTPS + JWT signé → vrai Nest guard → vraie PG 17 + mock SMS #38272349220](https://github.com/adminluxe/DelishAfrica/actions/runs/38272349220) **SUCCESS**, et `QA_PASS=production_candidate_jwks_resolver_real_https_verified_and_cached`.
- [CI type-check API/3 apps, Nest + resolver JWKS tests adversariaux #38272349211](https://github.com/adminluxe/DelishAfrica/actions/runs/38272349211) **SUCCESS**.
- [CI PostgreSQL isolé et défense anti-rejeu #38272349261](https://github.com/adminluxe/DelishAfrica/actions/runs/38272349261) **SUCCESS**.

**Nouveau composant candidat** : `services/api-nest/src/auth/native-client-trusted-jwks.resolver.ts`, testé négativement par `services/api-nest/test/native-client-trusted-jwks.resolver.test.cjs`, et testé positivement contre le **véritable JWKS Keycloak** dans `services/api-nest/test/native-client-full-stack.qa.cjs`. Le guard NestJS utilise désormais le résolveur candidat dans ce laboratoire. Garanties démontrées dans les tests : seul issuer HTTPS fixe préconfiguré côté serveur, refus de HTTP/credentials/port/query/fragment/localhost hors QA synthétique; discovery `issuer` exact et `jwks_uri` prédéterminée, **aucune redirection**, timeout et taille limitée, aucun JWT `jku/x5u`, validation du jeu de clés, `kid` unique parmi les clés admissibles, uniquement **RSA RS256 signature**. Cache court, refresh `single-flight`, expiration sans recours silencieux aux vieilles clés si serveur en panne.

**Anomalie documentée et réparée** : le premier filtre était trop strict pour le JWKS réel qui peut présenter **à la fois des clés de signature et des clés de chiffrement ou d'autres algorithmes**. La CI négative était verte, mais l'intégration réelle retournait **503 plutôt que 401** pour un JWT altéré puisque tout le jeu JWKS était rejeté. Le diagnostic QA a identifié `native_client_jwks_key_invalid_or_duplicate`. Correctif : ne conserver que les clés compatibles RSA/RS256 de signature, **ignorer les autres usages légitimes**, tout en rejetant encore les clés privées, URL externes, doublons de `kid` admissible et absence de clé de signature acceptable. **Le vérificateur JWT reste limité à RS256, sans acceptation de HS256/none/ES256**. Ce comportement est désormais vérifié en test unitaire JWKS multi-algorithme ET avec Keycloak réel dans l'unique CI intégrée.

**HTTP réel Nest sur ce dernier commit** : sans Bearer JWT `401`, avec JWT réellement signé puis altéré `401`, registre en attente `403`, après validation SMS mock unique et approbation commit PostgreSQL `200`, révocation `403`, panne JWKS/PG `503`. `PRODUCTION_IMPACT=NONE` et `QA_EPHEMERAL_RESOURCES_DESTROYED=YES`.

**NO-GO produit inchangé** : code candidat NON enregistré dans le vrai AppModule ni placé sur commandes/paiements ; SMTP/SMS fictifs ; pas de domaine/certificat prod ni Keycloak Client prod; pas de PSP réel, iPhone/Android, Stripe TEST E2E ou lancement Stores. Les fournisseurs SMS sandbox et la DB métier devront produire les **preuves autoritatives**; aucun champ provenant d'un client ou du navigateur ne peut fabriquer `provenanceVerified` ni `ledger.approved`. Architecture à valider en staging avant tout déploiement. PR DelishAfrica #35 reste DRAFT.
