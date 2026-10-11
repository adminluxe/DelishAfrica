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