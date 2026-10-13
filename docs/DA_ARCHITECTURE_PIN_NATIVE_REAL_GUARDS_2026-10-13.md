# DELISHAFRICA® — ARCHITECTURE ÉPINGLÉE / ISSUERS & GARDES HTTP RÉELS
**13 octobre 2026 · DRAFT, schéma QA — NE PAS CONFONDRE AVEC L'ARCHITECTURE DÉPLOYÉE.**

```text
                   Client Expo (non relié en production)
                                │
                         OIDC PKCE S256
                                │
                          Realm Client
                     issuer HTTPS distinct
                                │
                     Bearer RS256 (non fiable)
                                │
             ┌──────────────────┴───────────────────┐
             │ vrai OrdersAuthGuard / PaymentsAuthGuard
             │ injectés dans HTTP NestJS QA            │
             └──────────────────┬───────────────────┘
                                │
              reconnaissance non fiable de l'issuer
              (ROUTAGE SEULEMENT, PAS AUTHENTIFICATION)
              ┌─────────────────┴──────────────────┐
       issuer historique                      issuer Client natif
       AuthService legacy                       Bridge QA optionnel
       ExternalJwksVerifier RS256                garde natif réel
       JWT Merchant/Courier/Ops                  JWT signé + JWKS épinglé
              │                                 email_verified
              │                                 PG ledger email/SMS
              │                                        │
        Principal legacy                         Principal Client
              │                                        │
              └─────────────────┬──────────────────────┘
                         Orders / Payments
                       contrôleurs VÉRITABLES
                                │
                 Side effects comptés par mocks QA
                 aucun Stripe ni base externe
```

## Isolation vitale
- Le routage n'a aucune autorité : un token avec `iss` contrefait est rejeté par l'une ou l'autre signature/issuer ; même `kid` entre realms n'est pas une preuve de clé commune.
- Le contexte d'admission natif est un symbole JavaScript côté serveur rempli seulement après JWT et ledger : jamais depuis le body, cookies, `X-Role` ou `X-User`.
- La propriété d'une commande repose sur le couple **issuer + subject**, pas sur l'e-mail ou un ID de corps de requête.
- Le statut financier reste soumis à quote côté serveur, idempotence, preuve Stripe et règles de finalité ; le bridge n'accorde pas de paiement.
- `NativeClientCommerceIssuerBridge` **non enregistré dans les vrais modules**. `@Optional` ne signifie pas une activation automatique. Le test CI enregistre explicitement une instance synthétique.
- Les véritables JWT historiques n'ont pas été empruntés : tous tokens du test sont éphémères fictifs.

## Portes fermées
- Un échec issuer, signature, scopes, rôles, email, SMS, PG ou JWKS = 401/403/503, jamais succès.
- Pas de service account `manage-users`, `realm-admin` ou admin exposed.
- Pas de fallback de clé HMAC depuis hostname/cwd ; correction PR #35 antérieure validée sur SHA `143ef311...`.
- Aucun DNS/JWKS public piloté par un champ JWT.
- Aucune insertion dans AppModule ni mutation aux vrais gardes runtime VPS.
- Appareils Stores et titulaire IP restent sur dossiers de certification indépendants.

## Promotion explicite nécessaire (NON RÉALISÉE)
Une future décision devra supprimer la restriction QA de façon revue, créer une
configuration serveur contrôlée (issuer/JWKS HTTPS strict), implémenter des ports
transactionnels PostgreSQL + SMS sandbox/production, tester les vrais gardes
multi-issuer sur l'ensemble des routes sensibles, geler les preuves puis
déployer seulement après approbation. Ne jamais faire cette promotion comme
simple changement de variable d'environnement.
