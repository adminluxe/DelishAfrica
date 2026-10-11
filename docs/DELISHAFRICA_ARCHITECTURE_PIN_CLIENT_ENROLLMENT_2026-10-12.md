# DELISHAFRICA — ARCHITECTURE DE RÉFÉRENCE : ENRÔLEMENT CLIENT
**Datation : 12 octobre 2026 — observation réelle + candidat PR #35, non publié.**

> Document architectural ADDITIF, complément aux architectures Combo22 déjà présentes sur machines. Ne prétend pas que l'inscription est activée. La branche VPS live n'est PAS égale à la PR #35.

## Canonical repos et surfaces
- Monorepo VPS utilisé par les applications réellement lancées : `/opt/delishafrica/monorepo` (actuellement branche d'innovation avec changements de travail en cours : ne pas reset/checkout brutalement).
- Applications Expo : `apps/client`, `apps/merchant`, `apps/courier`. Ports LAN Asus pérennes : Client **8081**, Merchant **8082**, Courier **8083**. QA Client dédiée **8095**. Ne pas confondre avec les ports historiques VPS.
- API officielle VPS : **3010** ; canary existante **3011**, tests HTTP200. Base PostgreSQL officielle `delish-db` ; Keycloak 26.4.7 dans le realm existant `afritaste` avec comptes historiques conservés.
- API QA découplée créée sur VPS : worktree `/home/afripayadmin/DA_WORKTREES/da-client-enrollment-qa-20261012`, écoute uniquement **127.0.0.1:3095**. Charge `ClientEnrollmentModule` uniquement (pas Stripe, pas dispatch). GET `/api/v1/client-enrollment/readiness` HTTP200 `enabled:false` et POST register HTTP503. **Non visible des iPhones et non exposée à Internet.**
- Code produit candidat : [PR #35 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/35) sur PR #32 DRAFT. Les endpoints d'enrôlement restent HTTP404 sur les API officielles.

## Flux Client projeté (pas encore transaction validée)
```text
Client iOS/Android — panier invité conservé
      │
      ├── Mon Espace : adresse validée + preuves e-mail et SMS signées
      │          └── vérification locale ≠ autorisation de paiement
      │
      ├── Activer mon compte DelishAfrica (UX marque, Keycloak non présenté comme produit)
      │          └── API ClientEnrollmentModule vérifie 2 preuves exactes côté serveur
      │                      │
      │                      ├── ledger PostgreSQL HMAC unique anti-rejeu
      │                      └── Keycloak Admin API privé, compte disabled
      │                                └── rôle Client direct + effectif + provenance contrôlés
      │                      │
      │                      ├── commit ledger durable
      │                      └── activation Keycloak après nouvelle vérification
      │
      ├── OIDC Authorization Code + PKCE S256 (issuer/aud/azp/rôle)
      │          └── GET /auth/client/me doit confirmer le sujet Client attendu
      │
      └── retour intention de panier / checkout, payer seulement au geste volontaire
                 └── Stripe TEST → Merchant Thieyp → Courier GPS/ETA → Client livraison
```

## Frontières de sécurité
- Ne jamais activer `registration_allowed` global du realm partagé, ni attribuer `client` par défaut à des comptes Merchant/Courier.
- Requêtes de l'API vers Keycloak uniquement au nom DNS interne `afritaste-keycloak:8080`, jamais de jeton d'administration dans les apps ni le navigateur.
- Contrôles bloquants dans PR #35 : `DA_CLIENT_ENROLLMENT_ENABLED`, secret HMAC, ID et secret compte technique dédié, `DA_CLIENT_ENROLLMENT_SECURITY_GATE`, test réel SMTP reset `DA_CLIENT_ENROLLMENT_RECOVERY_GATE=SMTP_RESET_TESTED`, et tests de permissions minimales `DA_CLIENT_ENROLLMENT_AUTHZ_GATE=FGAP_NEGATIVE_TESTS_PASSED`. Tous OFF/inexistants en production tant que les prérequis ne sont pas prouvés.
- Service account Keycloak **pas encore créé**. À valider en sandbox séparée et vérifier que les permissions ne permettent ni gérer des utilisateurs tiers ni attribuer un rôle privilégié. Si les permissions fines ne permettent pas de borner la création de comptes, maintenir NO-GO et évaluer un realm Client distinct.
- Toute défaillance après création distante déclenche désactivation compensatoire et marquage `needs_review` ; requiert audit manuel si résultat d'activation ambigu. Interdire double paiement, exposition d'informations personnelles, utilisation de commandes démo comme preuve financière.
- Récupération mot de passe Keycloak actuelle **non configurée**. Postmark existe déjà pour l'API ; TCP smtp.postmarkapp.com:587 et :2525 joignable. Cela ne prouve pas l'envoi d'un e-mail Keycloak.

## Sauvegarde / résilience
- Exports PostgreSQL `pg_dump -Fc` de Keycloak et DelishAfrica, chiffrés en flux age avec deux destinataires publics : clé SSH Asus et clé SSH Toshiba v2. **Données jamais écrites sur disque en clair.**
- Archives chiffrées uniquement sur disque USB Toshiba : `/mnt/usb/workspace/POG_RESCUE_SECURE_2026-10-12_VPS_DB/`. Tests d'authenticité age + lecture intégrale et en-têtes PGDMP PASS ; restauration complète PostgreSQL EN ATTENTE, deuxième copie physique sur Asus EN ATTENTE.
- Ne jamais réinstaller Keycloak, lancer une migration PG ou modifier le realm tant qu'un plan de retour arrière réellement testé n'est pas disponible.

## Gate de livraison
1. Copie physique redondante + restauration Keycloak dans une base **indépendante**.
2. Installation d'un realm/serveur de test et validation des permissions du service account.
3. SMTP récupérations e-mail et thème de marque FR/EN, test avec compte QA contrôlé.
4. Promotion contrôlée de l'API candidat dans une canary isolée, migration PG additive sous sauvegarde, readiness OFF, puis ouverture ciblée sans affecter les 33 utilisateurs actuels.
5. Création Client sur vrai iPhone, `/auth/client/me` et rôles croisés, panier/restauration de session ; idem Android.
6. Une commande Stripe en mode TEST suivie du Client à Merchant à Courier et livraison, sans paiement LIVE ; seulement ensuite revue Store.

## Traces
- [Roadbook maître](https://github.com/adminluxe/DelishAfrica/blob/main/docs/DA_CLIENT_ENROLLMENT_REAL_VERTICAL_GATE_2026-10-11.md)
- [Roadbook technique PR #35](https://github.com/adminluxe/DelishAfrica/blob/feat/client-enrollment-secure-20261011/docs/DA_CLIENT_ENROLLMENT_ACTIVATION_GATE_2026-10-12.md)
- [CI PR #35](https://github.com/adminluxe/DelishAfrica/actions/runs/38182888636/job/114599012043)
