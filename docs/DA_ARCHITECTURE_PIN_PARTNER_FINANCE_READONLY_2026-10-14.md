# DELISHAFRICA® — ARCHITECTURE PIN : Merchant/Courier financial read-only bridge

**Date : 14 octobre 2026 · PR #46 DRAFT · P0-AUTHORITY / QA-CANDIDATE · PRODUCTION NO-GO**

## Frontières (code réel vs. cible)

```text
Merchant Expo / Courier Expo (screen /finances)
  |  - release: unavailable (aucune somme inventée)
  |  - dev + flag explicite: QA synthetic only
  v
daOrdersFetch -> session OIDC externe contrôlée par /auth/me
  |  Authorization bearer; aucune identité/merchantSlug/montant fourni au backend
  v
/qa-isolated/partner-finance/v1/summary (GET, no-store)
  |  Contrôleur dans le code, NON importé par AppModule
  |  Accessible UNIQUEMENT via module de test non-production et GH Actions
  v
FINANCE_READONLY_QA_PORT -> QaWalletVerifiedSessionBridge.readWallet
  |  RS256 JWT signé, issuer, azp, aud, rôle, sub, sid, jti, TTL
  |  révocation durable, appartenance / registre Courier validés serveur
  |  entité juridique / KYB-KYC / territoire / contrat
  v
Private Attestor (processus séparé) -> ticket PostgreSQL éphémère
  |  lecture tenant-scopée, F4J row locking et mandat finance
  v
PostgreSQL17 QA ledger + reconciliation -> report qa_synthetic_only
  |  somme vérifiée / non négative / EUR uniquement
  |  payoutEnabled=false / withdrawableMinor=0
  v
Exposition : summary agrégé uniquement, aucune identité, aucun ledger brut
```

**Attention :** cette chaîne est **testée en morceaux dans la lignée F4F–F4M**. Le contrôleur P0 n'est pas fourni avec un prestataire de finances réelles ni enregistré dans un runtime. Il s'agit de la couche **frontière API/app** requise avant le raccordement réel, pas d'une preuve de service fonctionnel sur VPS.

## Source et autorité

- Source Git canonique publique : `adminluxe/DelishAfrica`, production `main` distinct de la PR #46.
- Source financière QA : F4M PR #45, SHA `7a12d6fd6b0385ac52e555a584490374c8c6366b`, 3 CI synthétiques réussies.
- PR #46 reprend les mêmes migrations F4M sans les appliquer au serveur officiel.
- Runtime réel à préserver : `/opt/delishafrica/monorepo`, applications `apps/client`, `apps/merchant`, `apps/courier`.
- Aucune vérité Stripe LIVE, payouts, contrats KYB/KYC ou solde financier réel certifiée.

## Gates P0 avant lecture d'argent réel (NON SATISFAITS)

1. JWT réels Merchant/Courier : issuer strict, RS256, JWKS épinglé, audience/azp propres, sid/jti, révocation et négatifs inter-rôles.
2. Tenancy : rattachement serveur au marchand/entité/territoire, KYB actif, contrat signé ; Courier roster KYC et contrat actifs, aucun accès à un autre établissement, droits de finance limités.
3. Comptabilité : ledger PostgreSQL autoritatif, historique/solde/holds/refunds/reconciliation Stripe TEST validés, finance SQL à privilège minimal, sauvegarde/restauration independent host.
4. Architecture : attesteur indépendant du serveur public, identités SQL NOLOGIN/SUPERUSER, aucun secret d'attestation, ni finance SQL DML, dans les applications Expo/API exposées.
5. Parité : source des fonds vérifiée, devise/pays, disponibilité, origine des commissions contractuelles, concordance des transactions côté Merchant et Courier, tests de révocation et concurrence.
6. Tests et release : API Nest sur le vrai module autorisé, mobile QA sur iOS/Android, G0-G7 sur **binaire exact**, approbation avant merge, VPS, migration, Stores.
7. Accès au wallet réel refusé (HTTP 503) tant que les contrôles ne sont pas prouvés ; `0 €` ne doit jamais servir de valeur de substitution.

**Mesures actives dans le candidat :** `__DEV__ && EXPO_PUBLIC_DA_FINANCE_QA_ONLY=YES` pour les seules simulations, `NODE_ENV!==production && GITHUB_ACTIONS===true && QA_SYNTHETIC_ONLY===YES` côté contrôleur, protection `Cache-Control: no-store`, projection monétaire minimale, aucun transfert ni code de payout.

## Non-action

Pas de changement `AppModule` en production, pas de modification VPS, Realm Keycloak, Stripe TEST/LIVE, EAS, app stores, PG persistante, sessions de l'opérateur ou données financières. Maintenir les PR existantes en DRAFT.
