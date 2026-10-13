# Architecture de confiance — DelishAfrica / Auth P0
**13 octobre 2026 · pin documentaire sur PR #35 DRAFT, pas le runtime.**

```text
                  API NestJS — zone de confiance
                             |
         ┌───────────────────┴───────────────────┐
         |                                       |
Issuer HISTORIQUE afritaste            Issuer NATIF Client DISTINCT
  AuthService + RS256/JWKS              NativeClientNestCommerceGuard QA
  Orders/PaymentsAuthGuard              signed RS256/JWKS issuer pinned
  Merchant / Courier / Ops              email_verified + SMS + PG ledger
         |                                       |
  anciennes routes effectives          QA isolée seulement, PAS AppModule
         |                                       |
         └────────── STAGING BRIDGE ABSENT ───────┘
                      AUCUN FALLBACK AUTOMATIQUE
```

## Interdits
1. Aucun JWT Client d'issuer natif accepté par l'ancien AuthService simplement
   parce qu'il présente `role=client` ou un `kid` connu.
2. Aucune réutilisation de JWKS d'un realm pour l'autre.
3. Aucun contournement des gardes Merchant/Courier/Ops ou de propriété.
4. Aucun JWT HS256 local promu comme identité `external` ;
   en production, secret fort explicitement fourni, sinon rejet.
5. Aucun effet financier avant e-mail + SMS + ledger PostgreSQL transactionnel,
   possession Client, paiement validé et idempotence confirmée.
6. Aucun état des vrais Stores, realm historique, API VPS ou Stripe modifié.

## Gates
- QA candidate statique : TypeScript, HMAC, signatures RSA locales,
  classes des gardes réels, JWT multi-issuer artificiels.
- Staging ultérieur : vrais contrôleurs Nest ET vrais gardes,
  issuer historique + realm Client autonome, tokens Keycloak réels
  uniquement depuis conteneurs isolés, refus/acceptations 401/403/503,
  base PG durable en QA, provider SMS sandbox, aucun webhook LIVE.
- QA appareils, rollback, preuves Build Store et revue sécurité G0–G7
  obligatoires avant toute activation ou merge.

Risque Cloudflare POG Preview suivi séparément dans POG PR #35.
LuxeEvents/TombolaX exclus, travail F4M conservé sans duplication.
