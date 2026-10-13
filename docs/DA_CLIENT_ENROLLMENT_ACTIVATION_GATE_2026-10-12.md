# DELISHAFRICA — POINT DE REPRISE EXÉCUTABLE — ACTIVATION CLIENT
**Date : 12 octobre 2026, après 00:24, Europe/Brussels.**
**Statut : GO code/CI ; NO-GO activation de comptes, production, Stripe LIVE et soumissions Store.**

## Preuve iPhone
- Capture reçue : écran `Votre compte, votre liberté` visible sur iPhone en QA Client DEV ; SMS et e-mail marqués « confirmé » et panier préservé.
- Texte « L'activation des comptes arrive bientôt » conforme au statut serveur, qui ne possède pas encore les routes d'enrôlement.
- Ceci **ne prouve pas une création de compte OIDC**, une authentification, un achat ou une livraison.

## AUDIT VPS en lecture seule — script appliqué avec hash vérifié
- Script officiel : `ops/client-enrollment/DA_CLIENT_ENROLLMENT_SAFE_GATE_V1.sh` (blob Git `b85fd00a6ce39febb380910205cfe79b14933b88`). Script Bash syntaxe OK et exécuté **par SSH depuis le Toshiba, sans modifier le VPS**.
- API 3010 et canary 3011 : GET `/api/v1/health` HTTP 200.
- API 3010/3011 : GET `/api/v1/client-enrollment/readiness` HTTP **404** ; nouveau module non déployé.
- Keycloak accessible depuis le conteneur API via `afritaste-keycloak:8080` : discovery OIDC HTTP 200.
- PostgreSQL live : `public.da_client_enrollments` **absente** ; migration uniquement testée sous `ROLLBACK` précédemment.
- Realm `afritaste` : `registration_allowed=false`, `reset_password_allowed=false`, `verify_email=false`, **0 configuration SMTP**, **rôle de realm `client` présent**, **0 client technique `delishafrica-client-enrollment`**.
- Dans le conteneur API, `DATABASE_URL` présente ; tous les drapeaux, credentials et paramètres d'enrôlement spécifiques à cette nouvelle fonction absents ; inscription OFF.
- Existing provider bridge : API `identity-proof/health` et `provider-bridge/health` HTTP 200 ; `emailProvider=postmark`, `emailReady=true`, `externalCallsEnabled=true` (la validation du code e-mail ne remplace PAS la récupération Keycloak).
- API live `delish-api` image `delishafrica-api:p0f-20261001`, canary `delish-api-routes-canary` image `p0g-routes-20261003`. Repo VPS `/opt/delishafrica/monorepo` sur une branche d'innovation avec **modifications non commitées**. Ne jamais y faire de `git reset --hard`, `git checkout` ou de déploiement en écrasant le code en place. Disque VPS : 88 % utilisé, 26 Go libres.

## Correction sécurité apportée aujourd'hui dans la PR #35 DRAFT
- Un défaut d'ordre de validation existait dans le candidat : une identité Keycloak était activée avant la réussite du commit du registre PostgreSQL. Une panne DB aurait pu laisser un compte actif avec une inscription non finalisée.
- `ClientEnrollmentKeycloak.createClientIdentity()` **crée et vérifie seulement un compte désactivé**. La méthode `activateClientIdentity()` recontrôle le rôle, active ensuite l'identité et vérifie le nouvel état. `disableClientIdentity()` offre une compensation.
- `ClientEnrollmentService.register()` appelle : vérification serveur des deux preuves → réservation HMAC anti-rejeu → création désactivée/rôle client → COMMIT PostgreSQL → activation et relecture Keycloak → réponse au mobile. Si une étape échoue, désactivation best-effort et statut `needs_review`, aucun paiement.
- `ClientEnrollmentRepository.flagForReview()` couvre `reserved` **et** `ready` si l'activation échoue après commit.
- Le client PostgreSQL vendored est chargé **à la première opération DB seulement**, pour laisser l'API démarrer sans ce module lorsque la fonction est désactivée.
- Tests automatisés : DB commit en panne **n'active jamais** le compte ; activation Keycloak en panne déclenche désactivation/revue ; test succès garantit ordre `stage_disabled → ledger_ready → activated`; contrôle du rôle client strict. CI GitHub #35 **SUCCESS** sur commit `0e6365616fe744f64c558da8934f91ffef115901` : API, trois applications, tests identité/Keycloak, thème FR/EN, script d'audit et config iOS.
- Limite résiduelle explicitement ouverte : une coupure réseau pendant activation/désactivation peut rendre l'état du service tiers ambigu ; prévoir une tâche de rapprochement manuelle avant ouverture publique.

## Suite imposée, avec preuves de chaque palier
1. **Coffre, sauvegarde et récupération Keycloak** : vérification de la seconde voie de déchiffrement, snapshot de la base Keycloak et plan de retour arrière. Configurer l'e-mail de récupération depuis le compte/serveur Postmark déjà fonctionnel (sans afficher, logger, copier ni commiter ses tokens), idéalement via secret/vault ; vérifier un mail de récupération effectif vers un compte QA contrôlé, URL de retour et thème FR/EN. Le bouton « Mot de passe oublié ? » doit réellement fonctionner ; ne pas activer la récupération tant que l'e-mail n'arrive pas.
2. **Service account de moindre privilège** : créer `delishafrica-client-enrollment` via l'administration Keycloak avec permissions minimales effectives et négatifs prouvés : pas d'administration du realm, pas de création de rôles, pas de modification de comptes Merchant/Courier, pas d'attribution d'autres rôles. Si FGAP n'assure pas cette granularité, **NO-GO**, pas de contournement par `realm-admin` ou `manage-users` global. Ne pas activer l'auto-inscription globale.
3. **Déploiement QA isolé** : build reproductible depuis la PR sans écraser les modifications du monorepo VPS ni remplacer `3010/3011`; vérifier `GET readiness` HTTP 200 `enabled:false`, `POST register` refusé en 503, santé des APIs/Keycloak et absence de mutations. Exécuter ensuite la migration additive sous sauvegarde chiffrée et test restauration, puis configurer la canary avec le secret dédié protégé. Aucun secret dans Git, chat ou log.
4. **Pilotage contrôlé seulement** : utiliser une cible QA isolée ou une allowlist forte avant d'ouvrir `DA_CLIENT_ENROLLMENT_ENABLED` ; création Client depuis iPhone autorisé, deux preuves reçues, rôle OIDC `client` unique, `/auth/client/me` conforme et rôles Merchant/Courier rejetés. Le panier doit être conservé même après sortie de l'authentification. La sortie de login n'exécute jamais Stripe automatiquement.
5. **Verticale complète TEST** : un nouveau panier → paiement Stripe en mode TEST par geste explicite → Merchant accepte/prépare → Courier prend en charge, GPS/ETA → remise → Client reçoit le statut, même identifiant commande partout ; relecture des stats/caches. Android ensuite. En cas d'échec, clôture NO-GO ; aucun Store push ni Stripe LIVE.

### Chemins à conserver
- QA iPhone Client : `http://192.168.1.5:8095`, Metro Asus séparé ; ports historiques `8081/8082/8083` et QA `8091/8093` intouchés.
- Asus QA : `C:\Users\Valérie\Documents\DA_CLIENT_ENROLL_QA_20261011\workspace`
- Toshiba script d'audit : `/home/tontoncestcarre/work/DA_CLIENT_ENROLL_QA_20261012/DA_CLIENT_ENROLLMENT_SAFE_GATE_V1.sh`
- Toshiba/VPS : exécuter depuis le Toshiba `ssh -o BatchMode=yes purplecrm-vps bash -s < /home/tontoncestcarre/work/DA_CLIENT_ENROLL_QA_20261012/DA_CLIENT_ENROLLMENT_SAFE_GATE_V1.sh`
- Rapport de restauration Asus : `C:\Users\Valérie\Documents\POG_SECURE_RESTORE_TEST_20261011\POG_RESTORE_AND_STATUS_2026-10-11.md`
- Rapport de restauration Toshiba USB : `/mnt/usb/workspace/POG_RESCUE_SECURE_2026-10-11/POG_RESTORE_AND_STATUS_2026-10-11.md`

**Liens :** [PR #35](https://github.com/adminluxe/DelishAfrica/pull/35), [Issue #33](https://github.com/adminluxe/DelishAfrica/issues/33), [CI](https://github.com/adminluxe/DelishAfrica/actions/runs/38181325581/job/114594318612).

## REPRISE ACTIVE — QA ISOLÉE, SAUVEGARDES CHIFFRÉES, DOUBLE GATE (12 OCT 2026)

### API Client en QA effectivement mise en service (aucun impact prod)
- Création d'un **worktree Git séparé** : `/home/afripayadmin/DA_WORKTREES/da-client-enrollment-qa-20261012`, commit initial `db286700f1220caad651c1a58234d734694dc641`, compilation TypeScript réussie. Le monorepo VPS `/opt/delishafrica/monorepo` avec modifications non commitées n'a pas été touché.
- Bootstrap QA exclusivement `ClientEnrollmentModule`, fichier local non commité `services/api-nest/src/qa-enrollment-only.ts`, ne charge **ni commandes, ni paiements, ni Merchant, ni Courier** ; écoute uniquement `127.0.0.1:3095` (VPS, non exposé à Internet).
- Preuve fonctionnelle : GET `http://127.0.0.1:3095/api/v1/client-enrollment/readiness` retourne **HTTP 200**, `enabled:false`, `paymentAuthority:none`; POST `/api/v1/client-enrollment/register` retourne **HTTP 503**, code `client_enrollment_not_ready`, comme attendu avec les inscriptions OFF.
- API officielles `3010/3011`, Expo Asus `8081/8082/8083/8091/8093/8095` et realm Keycloak live intacts. Aucun token de service ou secret d'enrôlement injecté dans le nouveau processus.

### Sauvegarde Keycloak & API du VPS — deux destinataires de déchiffrement
- Exports PostgreSQL `pg_dump -Fc --no-owner --no-acl -Z 6` **streamés directement vers age**, sans fichier SQL en clair.
- Fichiers chiffrés sous `/mnt/usb/workspace/POG_RESCUE_SECURE_2026-10-12_VPS_DB/` :
  - `afritaste_keycloak_20261012.pgdump.age`, **234443 octets chiffrés**, SHA-256 `49b5687791fe706414a05a659adc908fffdb7db38f90eb92f0fafff76215e29b`.
  - `delish_api_20261012.pgdump.age`, **87980 octets chiffrés**, SHA-256 `6155f36ec7ceab9b363f2ce181b56b24782f4b07cca02d8584165cdeb7aa3054`.
- Chiffrés simultanément pour deux clés publiques SSH-Ed25519 distinctes : Asus `id_ed25519`, fingerprint `SHA256:6my7DgwT0smOIcbwA/peZ+Gdw/E+3GNUXqbeOkhROcs` ; Toshiba `purplecrm_vps_ed25519_v2`, fingerprint `SHA256:HqMtOiYjj75wmDNUfxaDGhZimZcCU/i5Wt1Us4Nq6I8`. Clés privées jamais déplacées ou exposées.
- Test de déchiffrement par la clé Toshiba : **PASS**, et lecture intégrale en mémoire de chaque archive avec validation de l'en-tête `PGDMP` : Keycloak **234073 octets**, Delish API **87642 octets**. Les fichiers age sont authentifiés ; **test de restauration complète sur PostgreSQL encore PENDING**. La copie chiffrée sur l'Asus n'a pas été achevée : une seule copie physique de ces deux exports existe sur l'USB Toshiba.
- Aucun dump en clair et aucune mutation de base n'ont été écrits sur le VPS ou le Toshiba.

### Contrôle des prérequis SMTP et autorisations
- API ↔ Keycloak OIDC sur réseau Docker privé : HTTP 200. `smtp.postmarkapp.com` joignable depuis le VPS par TCP **587 et 2525** ; Postmark provider bridge actuel affiche emailReady=true. **Le SMTP du realm Keycloak n'est pas configuré**, et l'envoi d'e-mail de récupération n'est **pas** testé.
- Règles supplémentaires dans `ClientEnrollmentPolicy` : `DA_CLIENT_ENROLLMENT_RECOVERY_GATE=SMTP_RESET_TESTED` **et** `DA_CLIENT_ENROLLMENT_AUTHZ_GATE=FGAP_NEGATIVE_TESTS_PASSED`, en plus du flag de mise en service et du security gate initial. Un simple accès à Keycloak/Postgres ne peut ouvrir les inscriptions.
- Contrôle strict supplémentaire dans le provisionneur Keycloak : relecture des **rôles composites effectifs** (pas seulement les rôles directs), rôle `client` exigé et seuls `default-roles-afritaste`, `offline_access`, `uma_authorization` autorisés en complément. Avant activation : compte doit être encore désactivé, e-mail vérifié et marqueur `delishafrica_enrollment_version=client-v1` présent. Tests négatifs Merchant/composite et identité non reconnue : **PASS**.
- Dernière CI ayant validé ces contrôles : `cb4c7d945e139120b5003733979d9a66cf5a5b1d`, [GitHub Actions](https://github.com/adminluxe/DelishAfrica/actions/runs/38182746301/job/114598582311) : **SUCCESS**, TypeScript API + 3 apps et tous les tests (mockés, pas un compte Keycloak créé).
- **ATTENTION : création effective d'un Keycloak QA séparé avec ses propres droits reportée, suite au refus des contrôles de sécurité de l'outil d'exécuter le script de provisionnement de conteneurs.** Ne pas compenser en configurant les privilèges d'administration sur le realm de production.

### NO-GO restant
- Restaurer réellement l'export Keycloak dans une base indépendante et vérifier les tables essentielles avant toute modification de l'instance live.
- Créer et évaluer dans une infrastructure QA autorisée le service account avec *least privilege* et les échecs des opérations hors rôle Client. Si FGAP ne permet pas cette restriction, reconsidérer l'isolation du realm Client, **jamais accorder aveuglément `manage-users` sur tous les comptes**.
- Prouver une vraie récupération e-mail Keycloak puis seulement envisager l'inscription QA réelle sur iPhone, la transition du panier, Stripe TEST et la livraison surveillée.
- Déploiement public et paiements LIVE : **INTERDITS**. Pas de build EAS/Store, pas de changement dans les paramètres du realm partagé.

## 12 OCT 2026 — Correctif concurrentiel du quota d'inscription (PR #35 DRAFT)

- Analyse du code : le quota PostgreSQL de 5 réservations/heure par origine comptait les transactions après un verrou **par e-mail** ; plusieurs e-mails concurrents partageant la même origine pouvaient contourner ce contrôle.
- Correction candidate : verrou transactionnel de l'origine HMAC **avant** la lecture du compteur, puis verrou e-mail, dans un ordre déterministe. Le test de régression lance six réservations concurrentes avec un même requester et six e-mails distincts, avec base fictive et verrous simulés ; cinq admissions et un refus sont attendus.
- Ce test isolé ne démontre ni la protection contre les abus à l'edge/proxy réel ni les permissions Keycloak ; exige une QA PostgreSQL réelle ainsi qu'un test ingress Cloudflare avant tout passage en production.
- Aucune donnée live, inscription, Keycloak, Stripe ou store modifié par ce commit. L'inscription reste **OFF / NO-GO**.
