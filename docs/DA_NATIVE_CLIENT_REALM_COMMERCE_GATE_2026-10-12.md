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
