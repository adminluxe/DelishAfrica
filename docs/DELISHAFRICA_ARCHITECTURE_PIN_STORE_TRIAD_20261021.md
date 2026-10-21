# DELISHAFRICA® — ARCHITECTURE PIN STORE TRIAD — 21 OCTOBRE 2026

## Autorités

### Source release mobile
`/home/tontoncestcarre/DA_P0_WORK/da_store_release_candidate_20261021`

### Repo GitHub
`adminluxe/DelishAfrica`

### Runtime API
`https://api.delishafrica.me/api/v1`

### IAM
Issuer :
`https://keycloak.afritaste.delishafrica.me/realms/afritaste`

Discovery :
`https://keycloak.afritaste.delishafrica.me/realms/afritaste/.well-known/openid-configuration`

## Frontière d'inscription

Deux moteurs séparés existent volontairement.

### QA
`daEnrollmentContract.ts` + `daEnrollmentFlow.ts`

Contraintes fail-closed :
- environnement QA explicite ;
- application ID DEV exact ;
- schéma DEV exact ;
- origines HTTPS sous `*.qa.delishafrica.me` ;
- réception pending seulement ;
- zéro droit professionnel.

### Production
`daProductionRegistration.ts`

Contraintes :
- application ID Store exact ;
- schéma Store exact ;
- client OIDC exact ;
- issuer Keycloak production figé ;
- PKCE S256 + nonce ;
- email vérifié obligatoire ;
- vérification serveur RS256/JWKS ;
- aucun token conservé après inscription ;
- `professionalAccessGranted=false`.

## Rôles

Un compte auto-inscrit reçoit au maximum l'identité Client générique nécessaire à l'accès personnel.

Jamais par défaut :
- merchant
- courier
- ops
- ownership
- dispatch
- payouts

Merchant et Courier exigent ensuite leurs gates métier indépendantes.

## Suppression

Point d'entrée in-app :
`/account-deletion`

Autorité :
Keycloak Account Console.

Précondition IAM :
Required Action Delete Account enabled + client role `account/delete-account` attribué par le rôle composite par défaut.

## Paiement et finance

Les changements de cette release ne modifient ni Stripe, ni les règles de finalité financière, ni OrchidPay F3.

Le runtime Payments doit rester :
- production ;
- webhook signature required ;
- catalogue recalculé serveur ;
- order commit authority Stripe retrieval ;
- refund/dispute aware ;
- mock order commit disabled.

## Release pipeline

```
worktree release isolée
  -> TypeScript / API / invariants
  -> Expo production config
  -> Hermes iOS+Android 3 apps
  -> commit SHA figé
  -> branche GitHub release
  -> EAS production 6 binaires
  -> recette native
  -> Store submit
```

Interdictions :
- build depuis le checkout VPS R&D dirty ;
- réutiliser un IPA/AAB historique ;
- pointer le moteur QA vers LIVE ;
- donner un rôle professionnel par défaut ;
- déployer une ancienne branche API par-dessus le runtime finance courant.
