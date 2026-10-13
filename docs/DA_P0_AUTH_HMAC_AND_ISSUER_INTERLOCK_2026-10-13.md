# DELISHAFRICA® — P0 AUTH HMAC / NATIVE CLIENT ↔ LEGACY ISSUER
**13 octobre 2026 · PR DelishAfrica #35 DRAFT · QA UNIQUEMENT · NON DÉPLOYÉ.**

## État de base déjà vérifié
- Base PR #35 : `d15225151ac01b22ff29161c82ff2e2d9dd4d7f4`.
- Les gardes réels `OrdersAuthGuard` et `PaymentsAuthGuard` appellent toujours
  `AuthService.resolvePrincipalFromAuthorization()` et le vérificateur JWKS
  épinglé à l'émetteur historique `afritaste`.
- Le nouveau garde natif Client, la preuve SMS fictive et le ledger PostgreSQL
  sont déjà testés dans l'API de QA, MAIS les anciens gardes étaient remplacés
  par des stubs dans le harnais `native-client-real-routes-no-side-effects.qa.test.cjs`.
- **Aucun passage en production Client natif n'est certifié.**

## Nouveau défaut réellement identifié dans main, PR #35 et F4M
Le code `AuthService.secret()` retournait SHA256(cwd + "|" + HOSTNAME)
si `DA_AUTH_SECRET` et `DA_AUTH_SECRET_FILE` étaient absents.
Cette clé est **prédictible à partir d'informations d'environnement**.
L'exploitation sur le VPS n'est pas démontrée : les vrais secrets de production
n'ont pas été consultés. Il s'agit d'un risque de conception P0, à supprimer.

## Correction candidate, fichier COMPLET
`services/api-nest/src/auth/auth.service.ts` :
- HMAC HS256 explicitement requis, en-tête JWT strict, sans ambiguïté RSA/HS.
- Les JWT HS256 internes doivent porter **`authSource=dev-login`**,
  jamais `external` ; aucune confiance propriétaire apportée par un jeton interne.
- Secret HMAC explicite ou fichier >=32 octets ; erreur sans repli si trop court.
- Si NODE_ENV=production et secret absent : **jetons internes refusés**,
  aucun secret prédictible. Les JWT externes RS256 suivent toujours leur
  vérificateur JWKS indépendant.
- Hors production, clé cryptographique éphémère par processus pour tests/dev,
  non stable après redémarrage et jamais dérivée du hostname/cwd.
- **Avant promotion**, confirmer `DA_AUTH_SECRET` ou fichier de secret
  robuste dans le vrai environnement et le besoin de compatibilité des
  anciens jetons internes. Ne pas copier un secret dans GitHub.

## Nouveau test QA isolé (sans serveur ni réseau)
`services/api-nest/test/auth-hmac-legacy-issuer-interlock.qa.test.cjs` :
- HMAC production absent ou trop court : refus.
- Secret explicite et secret fichier robustes : signature/vérification cohérentes.
- Jeton signé prétendant être `external` ou avec `alg:none` : rejet.
- Signature ancien repli hostname/cwd : rejet.
- Classes réelles `ExternalJwksVerifierService`, `AuthService`,
  `OrdersAuthGuard`, `PaymentsAuthGuard` : clients Merchant/Courier
  synthétiques et réellement signés acceptés en lecture Orders, jamais en Payments.
- Token Client synthétique d'émetteur distinct, avec même clé test :
  refus 401 des anciens gardes malgré validité cryptographique native.
- Le garde natif accepte uniquement un faux ledger pleinement approuvé, mais
  **l'ancien garde refuse toujours** le nouveau realm : preuve attendue
  que l'architecture n'est PAS branchée. Aucun bypass pour faire passer la CI.

## Contrat de sortie
- `QA_INTERNAL_HMAC_FAIL_CLOSED=PASS`,
  `QA_DETERMINISTIC_HMAC_FALLBACK=REMOVED`.
- `QA_REAL_LEGACY_AUTH_GUARDS_SYNTHETIC_KEYS=PASS`.
- `QA_SEPARATE_NATIVE_REALM_LEGACY_BRIDGE=NO_GO_NOT_WIRED`.
- No phone, database, SMTP/SMS external, payment, production runtime or
  CI claim beyond the exact SHA of this patch.
- Ne pas confondre ce test de classes réelles avec les gardes montés
  dans les contrôleurs Nest ou les endpoints HTTP de production.

**Promotion : NO-GO jusqu'à matrice complète multi-issuer avec
vrais gardes sur routes HTTP et ledger autoritatif de staging.**
