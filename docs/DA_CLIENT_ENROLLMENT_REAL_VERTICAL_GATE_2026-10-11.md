# DELISHAFRICA — ROADBOOK / GATE CLIENT ENROLLMENT & REAL VERTICAL — 2026-10-11

## ADDENDUM POST-RESET ET INSCRIPTION CLIENT — 11/10/2026 (prime sur les anciens statuts)

**RESET OPÉRATIONNEL SERVEUR TERMINÉ, CONTRÔLÉ APRÈS REDÉMARRAGE.** Six commandes de test précédentes (quatre livrées, une prise en charge, une en attente), deux présences Courier, deux suivis GPS et une autorisation Stripe TEST ont été retirés des quatre magasins JSON. Les onze tables PostgreSQL ciblées affichent chacune zéro ligne, y compris après le passage du synchroniseur automatique. API principale et canary : 3010 et 3011 HTTP 200. Watchdog et synchroniseur réactivés. Les archives chiffrées de la base et des fichiers sont conservées sur VPS et Toshiba USB, avec hash vérifié. Le contenu historique chez Stripe n'a pas été supprimé. Aucune identité, restaurant ni catalogue réinitialisé. Les caches locaux des applications restent à vérifier sur iPhone.

**AUDIT D'IDENTITÉ CONFIRMÉ DIRECTEMENT SUR KEYCLOAK 26.4.7 :** realm `afritaste`, 33 comptes existants, inscription OFF, `verify_email` OFF, réinitialisation mot de passe OFF, SMTP absent. Les trois applications OIDC sont actives, mais le rôle par défaut ne contient pas `client`. L'API réclame explicitement le rôle de royaume `client` ainsi que issuer/audience/azp. Ne jamais ouvrir l'inscription globale du realm partagé Client/Merchant/Courier.

**PR #35 DRAFT EN COURS, BASE PR #32 :** https://github.com/adminluxe/DelishAfrica/pull/35 . Enrôlement Client dédié : preuves email et SMS signées vérifiées côté API, HMAC et réservation PostgreSQL non rejouable, création par compte Keycloak service dédié exclusivement client, compte initialement désactivé jusqu'à attribution/contrôle du rôle, UX native DelishAfrica, séparation stricte des profils invités/identités. CI GitHub TypeScript API + 3 apps, tests mocked de rôle : PASS. Migration et code PAS déployés et flag d'inscription OFF.

**EAS / APPAREILS :** Compte Expo `delishafrica`, Apple Team AfriFood Global, deux appareils internes enregistrés (XR + un second iPhone). Dev Client iOS version 3.0.0 (19 septembre) encore disponible. L'IPA contient des symboles natifs `AIRMap`, pas `RNMapsAirModule`, cohérent avec la divergence JavaScript/native observée. Pas de nouveau build réalisé. L'iPhone tiers Purple Eco-Value ne doit être enregistré que lorsque l'identité et le binaire auront été validés ; une re-signature EAS de l'IPA existant pourra être évaluée.

**QA CODE NON LIVE :** Asus serveur Client PR32 `http://192.168.1.5:8091` ; nouvelle QA PR35 `http://192.168.1.5:8095` (bundle iOS compilé HTTP200) ; Courier PR32 `8093`. Les ports historiques `8081/8082/8083` restent intacts. Aucun paiement n'a été lancé. La QA PR35 est en lecture/affichage : le bouton d'inscription est fermé tant que le backend sécurisé et le canal récupération n'ont pas été approuvés.

**GATES IMPÉRATIFS :** permissions fines et secrets du compte de service Keycloak, récupération e-mail, thème de marque FR/EN, DB staging/migration, vraies inscriptions iPhone et `auth/client/me`, tests cross-role, test Stripe sandbox contrôlé Client → Merchant → Courier avec ID unique et positions GPS réelles, puis Android. Aucun Stripe LIVE, aucune fusion PR/Store push avant ces preuves.

---


**Status:** confirmed blockers, remediation planned, no destructive reset, no production deployment, Store release ON HOLD.
**Source of evidence:** 25 iPhone screenshots (IMG_0989.PNG through IMG_1014.PNG), GitHub repository analysis and previously known runtime state. Screenshots are intentionally not committed because they show personal contact and location information.

## What the iPhone captures actually prove
- Client: profile/address/SMS/email reach 3/3; marketplace/cart and secure checkout load, but **no OIDC account enrollment** is offered. Hosted browser authentication still says **AFRITASTE** with username/password and "Invalid username or password". An API-accepted Client OIDC subject is NOT established.
- Merchant (Thieyp): 5 orders visible, 4 delivered and 1 in route; this proves a read, NOT a new live Client→Merchant transaction.
- Courier: operational screens and a restored session are visible; a diagnostic also shows **jwt_role_missing**, so authorization cannot yet be accepted as fully validated.
- No completed Stripe sandbox purchase and no single fresh order tracked end-to-end across all three actors is demonstrated.

## Security-sensitive code facts
- apps/client/auth/daOidcConfig.ts: issuer remains https://keycloak.afritaste.delishafrica.me/realms/afritaste ; OIDC clientId delishafrica-client.
- apps/client/auth/daOidcClaims.ts: issuer + audience + azp + client role are mandatory; guest identity/profile evidence is NOT an OIDC access token.
- apps/client/app/client-space.tsx: collects/validates contact and address; it does not provision OIDC identities.
- services/api-nest/src/identity-proof/identity-proof.service.ts: proof token validation is tied to role, channel, recipient and validity, but an enrollment API also needs persistent one-time/anti-replay guarantees.
- services/api-nest/src/orders/orders.controller.ts: orders/demo/reset calls resetDemoOrders() for ops; no filtering by Stripe mode/payment or active status.
- services/api-nest/src/orders/orders.demo.store.ts: persistent file from DA_DEMO_ORDERS_STORE_FILE or .runtime/orders-demo-store.json; a historical "demo" path can be linked to a Stripe verified paid order.
- services/api-nest/src/orders/orders.access.service.ts: order creation verifies payment authority and role, so naive wiping risks paid history and reconciliation.

## Decisions
1. Client enrolment must be **native DelishAfrica UX, self-service**; never distribute technical Keycloak credentials to customers.
2. Verify existing SMS/email/address evidence on the API, exact role/destination; rate limiting, anti-replay, idempotency, anti-enumeration; only then server-side Keycloak provisioning limited to client-only identities, with activation and recovery. Avoid realm-wide default client role or global registration on a shared Merchant/Courier realm without explicit isolation.
3. Preserve OIDC issuer/PKCE/nonce/audience/azp/role. Rebrand hosted login, activation and email templates. At the end of login return to checkout preflight; NEVER create a charge automatically.
4. Check guest→client profile scoping and cross-account leakage, refresh/revocation and return journey on iPhone and Android.
5. Before a reset: inventory actual runtime file + payment modes, independently reconcile Stripe test/live, pause API writers and mission processes, encrypt and verify backups, purge ONLY unambiguous terminal synthetic nonfinancial fixtures. Do NOT call POST /orders/demo/reset blindly.
6. New one-ID vertical only after clean verified state: Client sandbox checkout → Thieyp Merchant accept/ready → Courier offer/accept/pickup/GPS ETA/delivery → Client tracking. No real charge.
7. No merges of identity changes, EAS build/store submission, or permission changes until device/CI/security gates pass.

## Provenance and tracking
- [#33 — Customer self-enrollment blocking payments](https://github.com/adminluxe/DelishAfrica/issues/33)
- [#34 — Safe demo order cleanup and genuine three-sided vertical](https://github.com/adminluxe/DelishAfrica/issues/34)
- [PR #32 — UI Maps and auth wording, still DRAFT](https://github.com/adminluxe/DelishAfrica/pull/32). Does not provision a Client account.

A separate offline kit was prepared 2026-10-11: DA_SAFE_DEMO_ORDERS_RESET_V1.py, DA_VERTICAL_READINESS_AUDIT_V1.sh and ROADBOOK_GATE_CLIENT_VERTICAL_20261011.md; on synthetic files, encrypted backup+reset+restore and test/live/unknown/active fail-closed checks all passed. The kit was NOT run against the real VPS. Remote command execution became unavailable while resuming the audit, so no operations on the live VPS were performed after that limitation.

**Hard facts to preserve in subsequent chats:** official VPS repository is /opt/delishafrica/monorepo (contains uncommitted API, orders and financial state changes that MUST NOT be reset); canonical VPS ports 3010 / 8081 / 8082 / 8083 according to pinned roadbook, while Asus iOS QA on 192.168.1.5 used original ports 8081/8082/8083 and temporary PR32 QA ports 8091/8093. Do not conflate server locations or assign new canonical ports.

Last updated 2026-10-11.
## 11/10/2026 — Blocage LAN iPhone DEV sur QA 8095
- Image iPhone : « No development servers found » et « Failed to connect to http://192.168.1.5:8095 » ; ne pas classer cela comme défaillance du serveur tant que l'accès Safari/iPhone n'est pas connu.
- Asus Wi-Fi 192.168.1.5/24 (privé), Node 8095 écoute ; Windows Firewall Node.js déjà ouvert sur le réseau privé ; Toshiba 192.168.1.33/24 ouvre `8095/status` en HTTP 200 ; manifeste iOS HTTP 200. Metro 8095 redémarré seul en mode interactif, autres ports conservés.
- IPA DEV du 19/09 : NSAllowsLocalNetworking=true, mais NSLocalNetworkUsageDescription et NSBonjourServices absents. PR #35 ajoute les deux clés **uniquement aux builds EAS development** ; test DEV/PROD GitHub CI SUCCESS. Un nouveau binaire sera nécessaire pour appliquer ces clés si les vérifications iPhone le justifient ; `eas build:resign` ne modifie pas l'Info.plist natif.
- Test à faire depuis Safari iPhone : `http://192.168.1.5:8095/status` ; attendu `packager-status:running`. Si OK, vérifier autorisation Réseau local de DA Client DEV. Sinon, vérifier SSID/VPN/isolation et adresse IP iPhone. Diagnostic non clôturé sans preuve de l'iPhone.
- ZÉRO changement du VPS live / Keycloak / Stripe / Stores ; aucun EAS build ni dépense.

## 12 OCT 2026 — QA Client premium sur iPhone, correctifs non publiés
- Les captures iPhone confirment la nouvelle navigation Mon espace → Activation → Connexion, mais **pas une inscription réussie** : Keycloak conserve son flag OFF. Des étapes de contacts 1/3 puis confirmés ont été vues à des instants différents ; faux négatif potentiel détecté et corrigé dans code.
- [PR #35 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/35) : module `daProofIdentity` partage la canonisation des coordonnées avec l'API, conserve les preuves non expirées lors de variations cosmétiques, invalide en cas de réel changement. Checkout OIDC et SMS/e-mail attestés par le serveur restent obligatoires.
- UX : phrases secrètes masquées si inscription non autorisée, suppression des actions de session absurdes à l'état déconnecté, distinction profil sauvegardé / compte activé, conservation de l'intention de retourner au checkout sans paiement automatique.
- Dernier head code `bdf128cc6adab9bd7bfe501673172474c0b2977e` : CI SUCCESS (API, 3 apps, nouveaux tests d'identité, Keycloak mock). QA Asus isolée sur `http://192.168.1.5:8095` : TypeScript PASS, bundle iOS Hermes HTTP 200 depuis Toshiba ; ports 8081/8082/8083 préservés.
- Reste : essai iPhone des nouvelles interactions, Keycloak permissions et récupération SMTP, enrôlement Client end-to-end puis paiement Stripe TEST surveillé, livraison complète. **AUCUN** paiement réel, build EAS, déploiement API ou store push.


## 12 OCTOBRE 2026 — ÉTAT RÉEL DU VERROU D'ACTIVATION CLIENT

**Capture iPhone reçue vers 00:24 :** `Votre compte, votre liberté`, deux contacts vérifiés, profil et panier conservés. Le message `L’activation des comptes arrive bientôt` est **exact** ; cette capture ne constitue pas une inscription Keycloak réussie.

**Audit VPS live en lecture seule** via `ops/client-enrollment/DA_CLIENT_ENROLLMENT_SAFE_GATE_V1.sh` vérifié SHA Git : 3010/3011 HEALTH HTTP200, `/client-enrollment/readiness` HTTP404 sur les deux API, table `da_client_enrollments` absente, service account `delishafrica-client-enrollment` absent, SMTP Keycloak absent, trois options du realm `registration_allowed`, `reset_password_allowed`, `verify_email` à false ; rôle `client` existant, API ↔ Keycloak privé HTTP200. API Postmark/identity-proof fonctionnent pour les codes, pas pour la récupération Keycloak.

**Sécurité PR #35 corrigée :** la première version candidate activait un compte Keycloak avant la confirmation durable du registre PostgreSQL. Séquence modifiée : compte initialement disabled + rôle client vérifié → commit du registre anti-rejeu → activation avec second contrôle ; désactivation compensatoire et `needs_review` en cas d'échec. Tests de panne simulée PostgreSQL/Keycloak, TypeScript API + 3 apps, audit script et thèmes : **SUCCESS** [GitHub Actions](https://github.com/adminluxe/DelishAfrica/actions/runs/38181325581/job/114594318612). Pas d'activation automatique.

**RISQUE DE DÉPLOIEMENT IMPORTANT :** VPS `/opt/delishafrica/monorepo` contient des changements non committés liés à une autre branche. Aucun reset/merge/checkout forcé ; la branche PR #35 ne doit être promue qu'à partir d'une copie isolée, avec sauvegarde et rollback contrôlés. Les ports officiels Expo `8081/8082/8083` et APIs `3010/3011` ne sont pas modifiés.

**TOUJOURS NO-GO** : déploiement candidat d'inscription, permissions fines du compte de service Keycloak, SMTP+test de récupération, migration de base avec backup, vraie création/connexion sur iPhone, paiement Stripe TEST et verticale Merchant/Courier ; aucun LIVE, Store push, nouveau build ou changement de realm réalisé.

**Prochaine procédure détaillée :** [Roadbook et audit d'activation Client du 12 octobre](https://github.com/adminluxe/DelishAfrica/blob/feat/client-enrollment-secure-20261011/docs/DA_CLIENT_ENROLLMENT_ACTIVATION_GATE_2026-10-12.md) et [PR #35 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/35).


## 12 OCT 2026 — QA API CLIENT ISOLÉE 3095 & DOUBLE SAUVEGARDE CHIFFRÉE

- **VPS QA réellement fonctionnelle, ClientEnrollmentModule seul** : worktree propre créé sous `/home/afripayadmin/DA_WORKTREES/da-client-enrollment-qa-20261012`. Compilation TS PASS ; écoute **127.0.0.1:3095 exclusivement**. `GET /api/v1/client-enrollment/readiness` = HTTP **200**, `enabled:false`; `POST /api/v1/client-enrollment/register` = HTTP **503**, `client_enrollment_not_ready`. Aucun autre module métier/paiement chargé. Le repo canonique VPS avec modifications non commitées n'est pas écrasé.
- **Exports de sauvegarde Keycloak et PostgreSQL API chiffrés age**, directement streamés depuis VPS, sur USB Toshiba `/mnt/usb/workspace/POG_RESCUE_SECURE_2026-10-12_VPS_DB/`. Recipients distincts **Asus et Toshiba**, avec clés privées restées sur leurs postes. Archives chiffrées SHA-256 contrôlées, déchiffrement Toshiba **PASS** avec lecture intégrale en mémoire `PGDMP`. **Restauration PostgreSQL isolée pas encore validée, seconde copie physique sur Asus non encore réalisée.**
- Keycloak live realm `afritaste`, 33 comptes historiques : AUCUNE modification. `smtp.postmarkapp.com` ports **587** et **2525** accessibles depuis le VPS ; Keycloak SMTP recovery encore non configuré/testé. L'API Postmark actuelle fonctionne pour les preuves.
- Sécurité durcie dans **PR #35 DRAFT** : activation uniquement après commit PostgreSQL ; contrôle du rôle `client` **effectif/composite** et du marqueur de compte Client ; deux gates additionnels obligatoires : récupération SMTP réellement testée et FGAP permissions limitées vérifiées négativement. CI Code/Test **PASS** [GitHub](https://github.com/adminluxe/DelishAfrica/actions/runs/38182746301/job/114598582311) sur code `cb4c7d945e139120b5003733979d9a66cf5a5b1d`.
- **NO-GO** : infrastructure Keycloak QA et gestion des permissions pas encore créée (outil bloqué lors de la tentative sécurisée). Aucun contournement via le realm réel ; aucun Store push/EAS/paiement LIVE, aucune création de compte ou commande réelle.
- [Roadbook technique détaillé du 12 octobre](https://github.com/adminluxe/DelishAfrica/blob/feat/client-enrollment-secure-20261011/docs/DA_CLIENT_ENROLLMENT_ACTIVATION_GATE_2026-10-12.md) et PR #35 restent la source pour la suite. Les ports API officiels 3010/3011 et Metro 8081/8082/8083 demeurent intacts.

**Architecture de référence épinglée dans GitHub :** [Client Enrollment — frontières de sécurité et QA du 12 octobre](https://github.com/adminluxe/DelishAfrica/blob/main/docs/DELISHAFRICA_ARCHITECTURE_PIN_CLIENT_ENROLLMENT_2026-10-12.md).


## 12 OCTOBRE 2026 — VIDÉO IPHONE 8095, BOUCLE CHECKOUT CONFIRMÉE

- Vidéo iPhone enregistrée à 01:11, **77,6 secondes**, inspectée par échantillonnage visuel : panier Client 6 articles / **101 €**, checkout, demande de connexion, activation impossible malgré SMS et e-mail confirmés, puis retour Mon espace. **Aucune création de compte Keycloak ni paiement validé** ; l'intention de panier reste visible.
- **Diagnostics réels :** Asus Metro Expo DEV QA `8095/status` HTTP200, PID Node connu et CLI `expo start --dev-client --lan --port 8095`. Les blobs Git des cinq fichiers iPhone présents sous `C:\Users\Valérie\Documents\DA_CLIENT_ENROLL_QA_20261011\workspace` correspondent exactement à la PR #35 : `activate-account` b3cc2109583db6d2cfe4221d8b442f2b25010076, `client-space` ea428481104566223a5ac05dbc88692b5799cab3, `checkout-preflight` 007d200ad486f608325a2ba1769c9de87d7b766f, `secure-session` 5afcba434976919b161f1db21d0b13478e851661, `daProofIdentity` b9740cdfa0af07c5be5c6b13da2df340e13ce825.
- **Root cause fonctionnelle** : activation attend `GET /api/v1/client-enrollment/readiness` sur l'API publique par défaut `https://api.delishafrica.me/api/v1` ; API officielle 3010 renvoie **404** (module non déployé) et API QA `127.0.0.1:3095` renvoie **200, enabled:false** en réseau VPS privé uniquement. L'app de l'iPhone ne peut ni joindre 3095 directement ni créer un compte sur l'API live. `secure-session` ne peut authentifier que les comptes Keycloak existants ; le test d'un **nouveau** compte reste impossible. **Ce n'est pas un défaut de Metro ni une question de recompilation ou de nouvel iPhone.**
- **Gravité : NO-GO livraison / verticale réelle**. Ne pas maquiller ce manque en retouchant simplement les textes ; pas d'essai Stripe avec les données fictives. Prochaine levée : Keycloak QA autonome + rôle/permissions minimales et tests négatifs + récupération email, restauration DB isolée, puis API inscription canary liée au client et test physique complet.
- Aucun correctif UI ni déploiement production effectué lors du diagnostic vidéo. Tous les ports historiques et paiements réels restent inchangés.


## 12 OCTOBRE 2026 — CLIENT : PROTECTION ANTI-USURPATION ET JETONS MULTIRÔLES, CI VERTE

**Contexte :** l'iPhone QA 8095 reste bloqué à l'activation Client ; ce point est **inchangé**. Aucun déploiement, aucune inscription Keycloak, aucune mutation sur les API publiques ni les ports réservés.

### Corrections de code, PR #35 DRAFT
- Les contrôleurs `IdentityProofController` (start, check, attest) et `ClientEnrollmentController` (register) utilisent désormais le **même identifiant réseau issu de la socket serveur**, via `services/api-nest/src/identity-proof/trusted-requester-peer.ts`. Ils **ignorent** les valeurs `CF-Connecting-IP`, `X-Forwarded-For` et `req.ip` non validées dans la chaîne de confiance. Les tests vérifient les en-têtes falsifiés, IPv4, IPv4-mapped IPv6, IPv6 et l'identité de rate-limit sur les quatre opérations.
- Le vérificateur OIDC `ExternalJwksVerifierService` contrôle **après signature JWT** les audiences et les rôles des comptes Client via `services/api-nest/src/auth/client-token-isolation.ts`. Il refuse les privilèges de realm inattendus (`merchant`, `courier`, `ops`, `realm-admin`, etc.), les audiences produit croisées et les permissions provenant de clients Keycloak autres que le compte self-service `account`. Les tests négatifs portent aussi sur `realm-management` et les claims malformés.
- **CI complète SUCCESS** pour `27409a31dfac94d73ec50b4411388cb7f4c31639` : [GitHub Actions 38185238347](https://github.com/adminluxe/DelishAfrica/actions/runs/38185238347/job/114606029459), vérifications TypeScript API + 3 apps, proofs, tests anti-IP falsifiées, rôles OIDC Client et mocks Keycloak.

### Limitations / NO-GO conservé
- La socket serveur voit actuellement le **proxy immédiat** : c'est volontairement préférable à faire confiance à des en-têtes falsifiables, mais la véritable chaîne de proxies de confiance doit être auditée, avec tests en LAN et via Cloudflare/Nginx. Le rate-limit reste notamment ciblé par destinataire ; vérifier la scalabilité multi-instance avant lancement public.
- La validation JWT **ne prouve pas** les permissions réelles du compte technique de provisionnement (FGAP Keycloak) ; vérifier la séparation des privilèges avec des tests interdits en sandbox indépendante.
- Keycloak QA autonome, restauration complète PostgreSQL, SMTP de récupération et test d'un véritable nouveau Client : toujours **non validés**. La QA `127.0.0.1:3095` reste `enabled:false`; aucune création de compte réelle sur l'iPhone et aucun paiement Stripe déclenché. Poursuivre avec l'infrastructure autorisée, sans utiliser le realm partagé comme terrain d'expérimentation.
