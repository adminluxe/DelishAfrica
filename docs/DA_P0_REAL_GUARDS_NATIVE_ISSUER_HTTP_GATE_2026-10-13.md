# DELISHAFRICA® — ROADBOOK P0 / HTTP NEST VRAIS GARDES + DOUBLE ISSUER
**Checkpoint : 13 octobre 2026 · DRAFT PR #35 · QA SYNTHÉTIQUE EXCLUSIVEMENT.**

## État de départ sans régression
- DelishAfrica PR #35 SHA parent `143ef311d452b29aa0a92799c05b85b63f794d68` : quatre CI SUCCESS après retrait du repli HMAC dérivé du hostname/cwd.
- F4M PR #45 SHA `7a12d6fd6b0385ac52e555a584490374c8c6366b` : trois CI vertes, labo financier distinct, non fusionné, non exposé à la production.
- Identité native Client : JWT Keycloak signé RS256, issuer Client distinct, preuve email + SMS factice + ledger PG QA démontrés ; à raccorder avant toute soumission.
- Les anciens gardes `OrdersAuthGuard` / `PaymentsAuthGuard` utilisent l'ancien issuer et interdisent le nouveau Client. Le test HTTP antérieur remplaçait explicitement ces deux gardes par des doublons : ce n'est PAS un test de chaînage réel.

## Delta de ce palier — réutiliser les composants existants
1. `src/auth/native-client-nest-commerce.guard.ts` : le principal serveur signé/admis transmet désormais les métadonnées nécessaires (`email`, expiration JWT). Les attributs proviennent du JWT effectivement vérifié, non des en-têtes HTTP.
2. `src/auth/native-client-commerce-issuer-bridge.ts` : nouveau *bridge* de TEST. Routage basé sur l'issuer non fiable **uniquement comme indicateur de chemin**, jamais comme droit. Le contrôle d'identité résulte EXCLUSIVEMENT du JWT signé RS256, du JWKS épinglé et du ledger email/SMS autoritatif. `GITHUB_ACTIONS=true` ET `QA_SYNTHETIC_ONLY=YES` obligatoires ; sinon désactivé.
3. `src/orders/orders.auth.guard.ts` et `src/payments/payments.auth.guard.ts` : injection **@Optional** ; le fournisseur du bridge n'existe ni dans `OrdersModule` ni dans `PaymentsModule` ni dans `AppModule`. Sans ce fournisseur, comportement legacy identique, hormis rejet des Authorization multiples.
4. `test/native-client-real-guards-http-bridge.qa.test.cjs` : HTTP localhost NestJS ; `OrdersController`, `PaymentsController`, `OrdersAuthGuard`, `PaymentsAuthGuard` et `AuthService` véritables, **sans overrideGuard**. Faux Stripe à compteur (zéro réseau), magasin d'ordres temporaire, DB/admission synthétiques. Clés RSA séparées avec le même `kid` pour prouver le cloisonnement d'issuer/clé.
5. Le workflow `client-enrollment-gate.yml` lance le test à chaque changement sur ces fichiers en CI DRAFT.
6. Ce roadbook et `DA_ARCHITECTURE_PIN_NATIVE_REAL_GUARDS_2026-10-13.md` consignent limites et risques.

## Conditions de preuve (ne pas anticiper le PASS)
- Accès historique Merchant/Courier/Ops sur `/orders/list` : conserver les vrais gardes, tester des JWT synthétiques signés.
- Paiements interdits aux comptes non Client, même correctement signés.
- Client natif : absence JWT 401 ; signature trafiquée 401 ; clé d'un autre realm 401 ; token multi-rôles/issuer/aud interdit 401/403.
- Ledger absent, SMS non prouvé, email non confirmé : 403 ; panne PG/JWKS : 503 ; **aucun effet side-channel**.
- Client approuvé : statut HTTP attendu sur les **vrais** contrôleurs, effets exclusivement sur doublures explicitement contrôlées (jamais Stripe).
- Révocation après admission : refus 403 et **zéro effet supplémentaire**.
- Les erreurs, états de session et nombres de tests doivent être vérifiés depuis les journaux CI au SHA exact.

## Réserves P0 — gates NON LEVÉS même si la CI est verte
- **Bridge non branché aux modules de production** ; aucune connexion SMS, SMTP, PG, Keycloak ou Stripe réelle ; les doubles QA ne sont pas des attestations d'un système production.
- On n'a PAS prouvé le comportement des JWT Client historiques sur toutes les routes d'écriture lorsqu'une nouvelle politique d'issuer sera activée. Éviter les chemins de contournement legacy.
- Le ledger de production, le fournisseur SMS, les clés JWT, la révocation, les vrais JWT Merchant/Courier et les migrations nécessitent encore un staging séparé / revue de sécurité.
- La matrice G0–G7, sécurité UI, appareils réels et SHA binary Store restent distincts. Aucun privilège `manage-users` ajouté.
- F4M et OrchidPay sont inchangés ; quarantaines LuxeEvents/TombolaX inchangées.

**NO-GO production, Stripe officiel TEST/LIVE, payouts, Store/EAS payantes, migrations VPS, merge.**
