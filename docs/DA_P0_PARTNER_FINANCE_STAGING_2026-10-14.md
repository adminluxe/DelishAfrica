# DELISHAFRICA® — ROADBOOK P0 : ROUTAGE FINANCIER MERCHANT / COURIER

**14 octobre 2026 — PR #46 DRAFT — candidats QA uniquement — production / payout / Stores : NO-GO.**

## Autorité et portée

- `adminluxe/DelishAfrica` PR #46 `feat/p0-partner-finance-readonly-bridge-20261014`, empilée sur F4M PR #45, SHA F4M `7a12d6fd6b0385ac52e555a584490374c8c6366b`.
- Source de vérité exécutée sur VPS : `/opt/delishafrica/monorepo` avec les trois applications ; **non modifiée**.
- F4M possède déjà trois CI SUCCESS en QA synthétique isolée avec Keycloak 26.4.7, PostgreSQL 17, rôles NOLOGIN et attestations ; aucun fait de cette PR ne convertit ces fixtures en clients/paiements réels.
- Les PR F4K #43, F4L #44, F4M #45 et Client Enrollment #35 demeurent DRAFT. Issues réelles #33/#34 restent OPEN.

## Travail effectif de la PR #46

1. **Navigation** : `apps/merchant/app/index.tsx` et `apps/courier/app/index.tsx` proposent une entrée « Mon portefeuille » **seulement si `__DEV__ && EXPO_PUBLIC_DA_FINANCE_QA_ONLY=YES`** ; jamais comme fonction commerciale dans la build de distribution.
2. **Écrans** `apps/{merchant,courier}/app/finances.tsx` : statut, provenance QA, consultation et actualisation sans mutation. En cas d'échec/absence d'autorité, aucun montant et aucune valeur `0 €` inventée.
3. **Client authentifié** `apps/{merchant,courier}/utils/daFinanceReadOnly.ts` : utilise le `daOrdersFetch` OIDC externe existant ; route QA commune ; validation de l'émetteur du rapport, rôle exact, EUR, montants non négatifs en unités mineures, somme comptable, payout `false` et retrait `0`. Les montants des tests portent une mention visible « simulation isolée ».
4. **Contrôleur Nest** `services/api-nest/src/client-commerce/partner-finance-readonly.qa.controller.ts` : projeté pour injection du **pont privé existant F4F/F4J**, lecture seule et informations minimales ; **non importé par l'AppModule**, inutilisable en `NODE_ENV=production` et hors GitHub Actions/QA synthétique.
5. **Tests de contrats** `services/api-nest/test/partner-finance-readonly.contract.test.mjs` : refus de rôle croisé, mode LIVE, payout, montants incohérents, mauvaise devise, `null`, cache, interdiction d'exposer la navigation en release.
6. **Tests HTTP Nest** `services/api-nest/test/partner-finance-readonly.http.qa.test.cjs` : serveur local éphémère avec port d'autorité **MOCK** ; vérifie `no-store`, zéro lecture sans header, réponse 503 en prod, rejet de rapports faux et absence de données personnelles dans le body. Ne prouve ni signature réelle ni provider PG.
7. **CI** `.github/workflows/partner-finance-readonly-qa.yml` : actions GitHub sur SHA immuables, droits `contents:read`, credentials checkout non persistés ; pnpm figé, scripts tiers d'installation interdits, limite de workspace identique à CI F4M éprouvée (landing hors périmètre), typecheck API/2 apps, tests unitaires et HTTP.

## Preuves datées et leur périmètre

- **Toshiba, dossier temporaire supprimé** : contrat mobile 3 tests / 3 PASS avec 8 assertions role/format chacune ; aucun trafic financier/production.
- **GitHub Actions PR #46** : [run #38534491790](https://github.com/adminluxe/DelishAfrica/actions/runs/38534491790) — SUCCESS sur SHA `23c071e7d8810e52d2c76acee554f312557d302d` (API + Merchant/Courier TS ; contrat).
- **GitHub Actions PR #46** : [run #38534865847](https://github.com/adminluxe/DelishAfrica/actions/runs/38534865847) — SUCCESS sur SHA `d19fbc7c340b413dee886e3491d96fb6884e081b` (typecheck + contrats + **Nest HTTP mock**).
- Un run **sur le SHA documentaire FINAL** incluant ce roadbook, le PIN, la navigation release-gated et les tests de navigation doit encore être vérifié avant marquage `QA CODE CERTIFIED`. Ne pas écrire ici un SHA futur imaginaire.

## Conditions avant ouverture au solde réel : toujours NO-GO

- Vrai JWT Keycloak Merchant/Courier, issuer, aud, azp, revendications croisées refusées, sessions et révocations prouvées sur l'environnement exploité ;
- appartenance effective établissement/contrat, entité légale KYB signée, roster/KYC Courier, séparation par pays et devise, droits finance par entité ;
- **registre de finance et soldes PostgreSQL autoritatifs**, comptes SQL limités, attesteur indépendant, ledger immuable, remboursements/disputes/hold, exacte provenance Stripe TEST puis règles contractuelles du marché ;
- reconstruction/restauration QA indépendante et tests de sécurité SQL, concurrence/anti-rejeu ;
- parcours iOS/Android réels et preuve du binaire, accord G0–G7 puis accord explicite de l'administrateur.

**Le module financier public, ses vrais comptes SQL, le private attestor et les données financières ne sont PAS connectés à la production.** La PR #46 ne fait circuler aucune somme hors de fixtures QA, ne lance aucun Stripe TEST/LIVE, migration persistante, payout, publication EAS/Store ou transfert de fonds.

**Verdict du jalon : PASS PARTIEL QA candidate / release NO-GO, sans masquer les tâches réelles.**
