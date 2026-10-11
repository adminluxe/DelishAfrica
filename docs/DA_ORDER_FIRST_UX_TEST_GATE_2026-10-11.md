# DelishAfrica - Order-first UX candidate - 2026-10-11

Status: **MERGED AS SOURCE CODE ON 2026-10-11 / ON-DEVICE VALIDATION AND STORE RELEASE PENDING**

## Decision respected
The identity provider (Keycloak/OIDC) remains a backend implementation detail. No new signup, password reset, forced account screen, or Keycloak-flow modification belongs to this candidate.

The existing customer journey already collects and verifies contact/address in Client Space before payment. This PR does not change those sensitive verification rules, payment intent creation, idempotency or order transaction logic.

## Source baseline
- Repository: `adminluxe/DelishAfrica`
- Base: `main` at `161f7d568a1edcaec702916747b68d1a6e16cf0b`
- Candidate branch: `feat/valerie-client-order-first-20261011`
- Files changed (UI only): `apps/client/app/index.tsx`, `apps/merchant/app/index.tsx`, `apps/courier/app/index.tsx`.

## Change summary
1. Client: the primary **Commander maintenant** action now appears ahead of the optional Radar rail.
2. Client: clarify that restaurant browsing does not require an account, and explain contact/address verification in the normal checkout, without suggesting an additional account-creation step.
3. Client: Radar copy explicitly indicates discovery, not an ordering requirement.
4. Merchant / Courier: remove internal `S10N` release code labels and some development jargon from visible home screens; keep route targets and permission checks unchanged.
5. Preserve all existing protected API, merchant association, delivery role and payment gates.

## Evidence available
- TypeScript 5.9 transpilation syntax check of all three changed TSX files: PASS.
- Baseline OIDC screen and `useDaPkceAuth.ts` unchanged: PASS.
- Five source-level assertions including order-first placement: PASS.
- `git diff --check`: PASS.
- No full typecheck with Expo dependencies yet; no simulator or device run.
- No production deployment, EAS build, Store submission, Meta publish or payment touched.

## Mandatory release gate
- Confirm normal guest discovery -> restaurant -> menu -> cart -> preflight on Android and iOS.
- Confirm primary ordering action appears before the Radar at small viewport size and with text scaling/accessibility enabled.
- Confirm Radar remains reachable and clearly optional.
- Confirm SMS/email/address validation behaves exactly as before; no fake identity is accepted.
- Confirm duplicate-payment protection and order confirmation against a sandbox provider only.
- Confirm Merchant/Courier wording works on actual devices and role gates fail closed.
- Run monorepo typecheck, lint, and relevant CI.
- Rebuild using certified EAS credentials and version increments only after QA and explicit release go.

## Provenance note
Source changes alone are not evidence of app distribution, and no Store-live claim is made.

## QA complémentaire Asus — 11 octobre 2026, contrôle de la PR #30

**Source UX testée :** commit `f6a4f3e08d6460bee2afb8913e79adb8f5c79671` (trois écrans UI inchangés).
**Dépendances :** la PR séparée [#31](https://github.com/adminluxe/DelishAfrica/pull/31) a corrigé trois imports d'icônes manquants chez Merchant/Courier ; fusionnée sur `main` (`fc802ead0f5a80cc433e678c7a6a908681f31474`) après CI verte. Elle ne touche pas au paiement ni à l'identité.

### Preuves automatiques exécutées hors Toshiba

- Windows Asus (Desktop Commander) : reconstruction d'une archive Git ciblée des apps `client`, `merchant`, `courier` et packages. Le checkout complet Windows échoue sur un ancien chemin racine contenant un caractère `:` interdit Windows ; **aucune suppression ou reconfiguration du dépôt canonique**.
- PNPM `9.15.4` : `install --frozen-lockfile --ignore-scripts` **PASS** après PR #31 ; scripts tiers non exécutés.
- TypeScript `tsc --noEmit` : **CLIENT PASS (0)** ; **MERCHANT PASS (0)** ; **COURIER PASS (0)**.
- Expo SDK 54 / Metro : en mode **workspace automatique** (ne pas définir `EXPO_NO_METRO_WORKSPACE_ROOT=1` pour cette copie Windows), trois manifestes iOS **HTTP 200**.
- Bundles iOS réels via les URLs `launchAsset.url` des manifestes, non via `/index.bundle` générique : **Client HTTP 200 (11 298 680 octets ; 1 721 modules)** ; **Merchant HTTP 200 (7 205 838 octets)** ; **Courier HTTP 200 (7 428 144 octets)**.
- DEV servers actifs sur Asus, réseau local `192.168.1.5` (réseau privé) : Client port `8081`, Merchant `8082`, Courier `8083`. **Adresses de test temporaires : ne pas annoncer comme production.**
- Les tentatives initiales avec `EXPO_NO_METRO_WORKSPACE_ROOT=1` étaient des faux échecs de résolution (module `expo-router/entry`) et ont été résolues par la configuration Metro monorepo Expo automatique. Aucun correctif UI/Auth n'a été appliqué pour contourner ce problème de test.

### Reste à prouver avant publication mobile / release

- **iPhone :** ouvrir les trois DEV clients, pointer vers les ports `192.168.1.5:8081/8082/8083` sur le même Wi-Fi et constater réellement l'ordre Client, le Radar optionnel, et les libellés Merchant/Courier. Captures ou retour explicite requis.
- **Android 13 :** reproduction du point soulevé par Valérie (Samsung A22) encore à faire au gate appareil, ou justification explicite de l'exception avec Android gelé en release.
- **Achat :** parcours restaurant → panier → identité/adresse → pré-paiement ; valider les refus sécurisés et les protections anti-doublons **uniquement avec fournisseur sandbox**. Ne pas encaisser une transaction réelle comme test.
- **Jusqu'à validation :** PR #30 **FUSIONNÉE DANS MAIN SUR APPROBATION DU PROPRIÉTAIRE** ; aucun EAS build ni Store submit automatique, aucune modification du flux Keycloak/OIDC, aucun uplift IP attribué à ce patch non publié.

## Suivi de fusion du 11 octobre 2026

- PR #30 fusionnée par squash dans `main` : commit `1beb07e04336303f7b836b51165f1da8d8639536`.
- Le correctif de dépendances de la PR #31 avait déjà été fusionné : `fc802ead0f5a80cc433e678c7a6a908681f31474`.
- Autorisation du propriétaire : intégrer la PR #30 dans le code, sans publier de build sur les Stores avant la vérification des DEV clients sur iPhone et la validation Android.
- Contrôles effectués sur Asus : TypeScript 3/3 sans erreurs, manifests Expo iOS 3/3 HTTP 200, bundles Metro iOS 3/3 HTTP 200.
- Contrôles restant à effectuer : inspection visuelle et parcours utilisateur sur appareils, authentification/rôles, paiement en sandbox seulement et portes de publication Stores. Aucun de ces points n'est présumé validé.
- Aucun déploiement de paiement ni changement des règles Keycloak/OIDC réalisé dans cette PR.
