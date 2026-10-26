# DELISHAFRICA R6G — FGAP CLIENT-ONLY — 26 OCT 2026

## Exécuté
- Accès Toshiba→VPS, ASUS en ligne ; production API et DB opérationnelles.
- Keycloak production 26.4.7 inchangé ; inscription Client production toujours désactivée. Aucune création de compte en production, aucune élévation globale, aucun paiement ni publication Store.
- Image Keycloak 26.8.1 récupérée et laboratoire dédié créé : conteneur da-r6g-keycloak-qa, base H2 QA, port hôte 127.0.0.1:18180. Aucun port public. Realm synthétique afritaste et rôles distincts Client/Merchant/Courier/Ops.
- Service account QA delishafrica-client-enrollment sans manage-users, realm-admin ni view-users global. FGAP v2 sur le groupe /da-clients-enrollment-v1 : vue, vue des membres, gestion des membres, gestion des appartenances.
- Tests live contre Keycloak QA 26.8.1 : POST Client groupé HTTP 201, création désactivée, rôle Client hérité seul ; activation HTTP 204 ; compensation HTTP 204.
- Tests négatifs : lecture Merchant 403, modification Merchant 403, affectation groupe Merchant 403 ; lecture de tous utilisateurs 403. Ajout de view-members limité à Client permet GET Client, GET groupes Client, GET rôles composites Client HTTP 200, tout en refusant Merchant HTTP 403. PREUVES QA : /home/afripayadmin/DA_EXPORTS/DA_R6G_FGAP_GROUP_QA_AFRT_20261026.json et DA_R6G_FGAP_VIEW_MEMBERS_AFRT_20261026.json.
- Code complet Keycloak Client Enrollment corrigé dans worktree QA : /home/afripayadmin/DA_WORKTREES/da-client-enrollment-qa-20261012/services/api-nest/src/client-enrollment/client-enrollment.keycloak.ts. Modification majeure : affectation au groupe FGAP au POST, plus d'attribution directe realm-role ; vérification effective roles/composite et groupes ; provenance et état avant/après activation ; compensation refusée hors périmètre.
- Politique production gate ajoute exigence AUTHZ=PROD_KC2681_FGAP_GROUP_CLIENT_ONLY_PASS et RECOVERY=EMAIL_PASSWORD_RECOVERY_LIVE_VERIFIED ; l'inscription reste fail closed.
- QA régression : 14/14 PASS, Nest TypeScript 0 erreur, Client TypeScript 0 erreur. Sauvegardes /home/afripayadmin/DA_BACKUPS_R6G/CLIENT_ENROLLMENT_KC_20261026.
- Branche QA qa/r6c-client-simplified-20261026, PR #75 DRAFT ; aucun merge sur main, aucun déploiement prod.

## Verrous restants
1. Keycloak production tourne en 26.4.7 : ne pas transposer les preuves FGAP QA 26.8.1 ; préparer migration testée avec sauvegarde/restauration puis fenêtre de changement et tests sans interruption. Ne jamais activer de compte technique en production avant preuve négative sur les identités professionnelles.
2. E-mail de récupération du compte et vérification du domaine transactionnel non validés sur ce laboratoire.
3. Tests smartphone physiques Client, iOS/Android, et transaction Stripe TEST bout-en-bout Merchant/Courier manquent encore.
4. Captures et statuts Stores ne correspondent pas encore au nouveau code QA.
5. Le laboratoire utilise Keycloak start-dev et est strictement non-production ; ne pas réutiliser sa base ou ses secrets.

## Preuves export natives R6G
- Export Hermes iOS QA : PASS : /home/afripayadmin/DA_EXPORTS/DA_R6G_CLIENT_IOS_QA_20261026.log
- Export Hermes Android QA : PASS : /home/afripayadmin/DA_EXPORTS/DA_R6G_CLIENT_ANDROID_QA_20261026.log
- Export web non certifie (Stripe React Native native-only) ; sans incidence sur les bundles mobiles.
