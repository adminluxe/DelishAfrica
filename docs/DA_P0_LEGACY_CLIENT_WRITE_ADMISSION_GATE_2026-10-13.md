# DELISHAFRICA® — ROADBOOK P0 / Client legacy : lecture conservée, écritures interdites
**13 octobre 2026 — Dossier de QA sur la PR #35 DRAFT, AUCUN déploiement.**

## Références et frontière contrôlée
- Dépôt : `adminluxe/DelishAfrica`
- Base certifiée : PR #35 SHA `2ba9b74cc1e22d4ea3359313679a8dd5f9fc049b`, **4/4 CI SUCCESS**.
- Ce palier ajoute une **barrière d'écritures legacy** ; il n'active pas la nouvelle autorité Client en production.
- `NativeClientCommerceIssuerBridge` reste optionnel, absent des vrais modules et REFUSE de fonctionner hors GitHub Actions + `QA_SYNTHETIC_ONLY=YES`.

## Problème source, identifié sans observation d'exploitation
Dans le code candidat antérieur, `ExternalJwksVerifierService` pouvait accepter un JWT Client legacy
avec signature RS256, issuer historique, audience `delishafrica-client`, rôle `client`
et session Redis valide, après validation de l'isolation des claims. `AuthService`
construisait alors un principal `authSource=external`, `ownershipEligible=true`.
Les gardes historiques `OrdersAuthGuard` et `PaymentsAuthGuard` acceptaient ce Client
sans passage par `NativeClientNestCommerceGuard`, donc **sans vérification du nouveau
ledger e-mail/SMS**.
Ce chemin constitue un **risque de contournement fonctionnel dans le candidat**, non la
preuve d'une exploitation en production.

## Correctifs complets
1. `services/api-nest/src/orders/orders.auth.guard.ts` : pour un Client issu du chemin
   d'authentification legacy, garder uniquement les handlers de lecture `list` et `get`.
   Refus HTTP 403 des autres handlers (création, changement de statut, commandes du
   coursier, reset). Les handlers sont identifiés par **métadonnées de code NestJS**
   (`ExecutionContext.getHandler()`) et non par chemin HTTP contrôlé par l'utilisateur.
2. `services/api-nest/src/payments/payments.auth.guard.ts` : refuser HTTP 403
   toute création de PaymentIntent pour le rôle `client` qui n'a pas été admis par
   le bridge natif après JWT signé + ledger durable. Les comptes Merchant/Courier
   restent interdits à la création de paiement.
3. `services/api-nest/test/native-client-real-guards-http-bridge.qa.test.cjs` :
   enrichir le **test HTTP existant avec les vrais contrôleurs ET vrais gardes**,
   en signant un JWT Client legacy synthétique avec clé historique. Le test
   prouve d'abord sa validité par le véritable `AuthService`, avec contrôle
   Redis synthétique "session non révoquée" ; vérifie la continuité lecture,
   puis les refus des routes d'écriture et l'absence d'effets de bord.
   Aucun `overrideGuard`, aucune transaction Stripe.

## Contrôles exigés dans le workflow existant
- `QA_LEGACY_SIGNED_CLIENT_WRITE_BYPASS_BLOCKED=PASS` : écritures Client legacy refusées sur
  `/orders/create`, `/orders/demo/create`, `/payments/create-intent`.
- `QA_LEGACY_SIGNED_CLIENT_READ_CONTINUITY=PASS` : `/orders/list` accessible aux
  anciens Clients, mais les autorisations de lecture par propriété restent dans
  `OrdersAccessService` (couple issuer + subject).
- `QA_REAL_LEGACY_MERCHANT_COURIER_OPS_GUARD_HTTP=PASS` : aucun recul des rôles métier.
- `QA_REAL_NEST_DUAL_ISSUER_DENIALS_ZERO_EFFECTS=PASS`, Client natif positif et
  révocation inchangés ; Stripe réseau = ZÉRO.
- CI Keycloak réelle, PostgreSQL réel isolé, ledger et concurrence : réussite
  sur le **même SHA**, pas seulement sur la base précédente.

## Invariants et limites de la preuve
- Un Client legacy ne reçoit jamais un droit de création uniquement via une
  signature RS256 valide ou une session Redis non révoquée.
- Aucun remplacement des gardes Merchant/Courier/Ops.
- Aucune nouvelle permission Keycloak, jeton administrateur ou rôle `manage-users`.
- Les Services Stripe, catalogue et ledger du test HTTP restent des doubles
  comptabilisés : **ce test n'est pas un déploiement staging avec vrais services**.
- Une fois la politique de migration Client définie, les écritures commerce doivent
  passer exclusivement par une admission transactionnelle (issuer + sub, preuves
  e-mail/SMS valides et révocation) avec ports fournisseurs réellement isolés.
- La cohérence sur **toutes** les routes secondaires, la reprise d'une ancienne
  session réelle, la restauration, les appareils et les Stores restent à certifier.

## Interdictions maintenues
Aucun merge, VPS, realm réel, Stripe TEST officiel ou LIVE, payout, EAS payant,
Store, déplacement de fonds ou nettoyage destructif.
Le worktree Toshiba `/home/tontoncestcarre/work/DA_STRIPE_RECON_QA_20261012`
et les runtimes `/opt/delishafrica/monorepo/apps/{client,merchant,courier}`
demeurent intouchés.
LuxeEvents/TombolaX en quarantaine et F4M intact.

**État : CANDIDAT QA — NO-GO promotion jusqu'aux CI réussies puis staging.**
