# DELISHAFRICA® — ROADBOOK STORE TRIAD RELEASE — 21 OCTOBRE 2026

## 1. Source de vérité de cette release

Worktree release isolée :
`/home/tontoncestcarre/DA_P0_WORK/da_store_release_candidate_20261021`

Branche :
`release/store-triad-signup-20261021`

Base Client/Courier :
`97c238634e3075dc58c9390f74b52216b38d3a77`

État Merchant repris depuis :
`c01457778ba2d6d73e7179fb4170e2f63c6d0d71`

Le checkout VPS `/opt/delishafrica/monorepo` reste une branche R&D dirty et n'est PAS une source de build Store.

## 2. Inscriptions — séparation QA / production

Le lot QA certifié conserve 21 sources, 7 par application, avec manifeste SHA-256 :
`7972e33a03df372b5d235ca9df2ccb415b9618bca4bfb3630d47c322a409413e`.

Le moteur QA reste fail-closed : package DEV exact, schéma DEV exact, environnement `qa`, origine `*.qa.delishafrica.me`. Il ne peut pas devenir un fallback LIVE.

La release ajoute une porte production distincte :
- package/scheme/client OIDC exacts par application ;
- Authorization Code + PKCE S256 ;
- nonce obligatoire ;
- issuer/audience/authorized-party contrôlés ;
- `email_verified=true` obligatoire ;
- vérification serveur via `POST /api/v1/auth/registration/verify` ;
- aucune attribution automatique de droit professionnel ;
- jetons d'inscription non persistés et révoqués best-effort.

## 3. Identités natives production

Client :
- bundle/package : `com.delishafrica.client`
- scheme : `delishafricaclient`
- OIDC client : `delishafrica-client`
- EAS projectId : `b9aebdae-10b4-4638-a576-a5f61352ea97`
- App Store Connect app : `6807363823`

Merchant :
- bundle/package : `com.delishafrica.merchant`
- scheme : `delishafricamerchant`
- OIDC client : `delishafrica-merchant`
- EAS projectId : `394e7d6f-559b-4536-81a9-fbc0cdb0c68f`
- App Store Connect app : `6807369989`

Courier :
- bundle/package : `com.delishafrica.courier`
- scheme : `delishafricacourier`
- OIDC client : `delishafrica-courier`
- EAS projectId : `5d1b6b85-9e64-4cc2-9cbe-7d698feccc84`
- App Store Connect app : `6807372575`

Version applicative candidate : `3.0.2`.
Build numbers : autorité EAS distante, profil `production`, `autoIncrement=true`.

## 4. Suppression de compte

Les trois apps exposent :
`/legal -> /account-deletion`

La suppression est initiée depuis l'application puis continue dans le centre de compte Keycloak DelishAfrica :
`https://keycloak.afritaste.delishafrica.me/realms/afritaste/account/#/personal-info`

Le centre exige une authentification et doit exposer l'action Delete Account. Les droits professionnels Merchant/Courier ne sont jamais des rôles par défaut.

## 5. Gates déjà validées

- API Nest build : PASS.
- TypeScript Client/Merchant/Courier : PASS 3/3.
- Expo config production : PASS 3/3.
- Version production : 3.0.2.
- Bundles / projectIds EAS : cohérents.
- QA `extra.daEnrollment` absent en production.
- Gate identité synthétique : 10/10 PASS.
- Invariants signup/delete statiques : 69/69 PASS.
- `git diff --check` : PASS.
- Scan diff : aucun secret / cache / node_modules / artefact parasite retenu.
- Sauvegarde Keycloak PostgreSQL avant bascule : PASS.
  - archive : `keycloak-20261020T235444Z.dump`
  - SHA-256 : `990401b0d02647d8b077839daad4d689f2084fde464872f025c976ad14e344a9`

## 6. État IAM production constaté avant bascule

Constat read-only :
- `registrationAllowed=false`
- `verifyEmail=false`
- `resetPasswordAllowed=false`
- `loginWithEmailAllowed=true`
- `duplicateEmailsAllowed=false`
- SMTP realm absent
- Required Action Delete Account présente mais disabled
- rôles par défaut : account/manage-account, account/view-profile, offline_access, uma_authorization
- aucun rôle professionnel merchant/courier/ops attribué par défaut

Test OIDC public Store Client avec `prompt=create` : réponse `Registration not allowed`.

## 7. Bascule IAM requise avant GO

Dans le realm production `afritaste` :
1. User registration = ON.
2. Verify email = ON.
3. Forgot password = ON.
4. SMTP Postmark configuré et connexion testée.
5. Required Action Delete Account = Enabled, PAS Default Action.
6. Ajouter aux rôles par défaut uniquement :
   - realm role `client`
   - client role `account/delete-account`
7. Ne JAMAIS ajouter `merchant`, `courier` ou `ops` aux rôles par défaut.

## 8. API production

Le code source VPS contient déjà la logique `/auth/registration/verify`, mais le runtime public répond encore 404 au checkpoint.

Règle :
ne pas reconstruire l'API depuis une ancienne branche release. Le runtime VPS contient des évolutions finance/OrchidPay actives. Déploiement du endpoint uniquement après rapprochement avec le source LIVE courant et build complet PASS sans régression health/payments/auth.

## 9. Exports et builds

Exports Hermes production 3×2 exécutés depuis la worktree release :
`/home/tontoncestcarre/DA_P0_EXPORTS/DA_STORE_TRIAD_HERMES_20261021`

Résultat du 21 octobre 2026 : Client iOS/Android, Merchant iOS/Android et Courier iOS/Android = PASS 6/6.

Aucun ancien IPA/AAB ne sera soumis.
Après ce gate 6/6 PASS :
- commit de la branche release ;
- push GitHub de la branche exacte ;
- six builds EAS production frais iOS/Android ;
- vérification du SHA source et des identités natives ;
- recette native réelle ;
- soumission seulement si IAM + API + suppression + parcours natifs sont GREEN.

## 10. Décision actuelle

`PRODUCTION_NO_GO / STORE_NO_GO` jusqu'à clôture des gates suivantes :
- Keycloak production basculé et relu ;
- endpoint `/auth/registration/verify` public actif et fail-closed ;
- six exports Hermes PASS ;
- six binaires Store signés PASS ;
- recette native Client/Merchant/Courier ;
- suppression authentifiée vérifiée ;
- revue finale indépendante de la matrice Store.

Aucun raccourci vers le LIVE QA. Aucun ancien binaire. Aucun droit professionnel automatique.
