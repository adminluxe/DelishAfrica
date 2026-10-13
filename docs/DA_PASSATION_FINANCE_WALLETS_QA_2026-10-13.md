# DELISHAFRICA® — PASSATION TECHNIQUE F4D
## Merchant & Courier : wallet QA 009, journal financier certifié — 13 octobre 2026

> **À ÉPINGLER dans le projet pour la prochaine session.**
> Ne jamais confondre ce laboratoire avec une application publiée, un solde
> bancaire, un payout exécuté ou une connexion Stripe officielle.
> Aucune action production / VPS / Keycloak / Stripe LIVE / EAS / Stores.

### 1. Où sommes-nous exactement ?

- **Dépôt GitHub :** `adminluxe/DelishAfrica`.
- **Branche de travaux QA :** `feat/stripe-test-reconcile-pg-qa-20261012`.
- **Dernier commit de code F4D :** `79964cee22cb39a60b1588912e2d2199dd5b17c1`.
- **PR #36 :** https://github.com/adminluxe/DelishAfrica/pull/36 — **DRAFT**, base `feat/client-enrollment-secure-20261011`.
- **PR #35 :** également **DRAFT**, non fusionnée.
- **Worktree QA Toshiba :** `/home/tontoncestcarre/work/DA_STRIPE_RECON_QA_20261012`.
- **Dépôt / applications réellement lancés sur le VPS :** `/opt/delishafrica/monorepo/apps/{client,merchant,courier}` — **NON MODIFIÉS par F4D**. Les ports et services VPS n'ont pas été touchés.
- **Remote Desktop Commander :** `purpletoshiba` (connexion connue en fin de session) ; vérifier la présence avant chaque intervention, ne pas supposer une exécution en arrière-plan.
- **Toutes les migrations QA 001–009** sont destinées **uniquement à une instance PostgreSQL17 Docker jetable `--network none`**. Ne les appliquer **JAMAIS** au serveur VPS ou à une base existante.

### 2. Certifications CERTAINES

| Palier | Preuve | Verdict |
|---|---|---|
| F4 / F4B | Panier commerçant immuable, transaction PostgreSQL + Merchant/Dispatch/Courier | CERTIFIÉ QA |
| F4C / 008 | Refund et pickup simultanés : verrou unique sur la commande, deux ordres de COMMIT | CERTIFIÉ QA |
| F4D / 009 | Journal de répartition Merchant/Courier, capture vérifiée, zéro somme, replay x8, hold tardif | CERTIFIÉ QA |
| F4D HTTP | Deux contrôleurs financiers protégés `OrdersAuthGuard`, KYB/roster simulés, lecture seule | CERTIFIÉ HTTP QA, **pas OIDC réel** |
| Isolation | Absence d'import public dans `AppModule`, de cashout, de transfert ou de payout | CERTIFIÉ CI |
| Stripe TEST officiel | Clés TEST, compte Stripe épinglé, vraie API Stripe, vrais webhooks TEST | **NON CERTIFIÉ / NON CONNECTÉ** |
| G0–G7 applications | Route commerciale de bout en bout dans les vrais écrans et comptes | **NON DÉMARRÉ / NO-GO** |
| Production et Stores | Test final & approbation humaine | **STRICTEMENT INTERDITS** |

**Dernier commit de code `79964ce`, pipelines SUCCESS :**
- PostgreSQL17/test de verrouillage, journal et finance : https://github.com/adminluxe/DelishAfrica/actions/runs/38324993520
- API + Client + Merchant + Courier + sécurité routage : https://github.com/adminluxe/DelishAfrica/actions/runs/38324993516

Précédentes preuves vérifiées :
- 009 Node/PG réel : https://github.com/adminluxe/DelishAfrica/actions/runs/38324552260
- 009 HTTP Nest + trois apps : https://github.com/adminluxe/DelishAfrica/actions/runs/38324760436
- 008 concurrence refund/pickup : https://github.com/adminluxe/DelishAfrica/actions/runs/38323181256

### 3. Ce qui existe réellement

**Nouveaux fichiers :**
- `services/api-nest/migrations/client-commerce/20261013_009_merchant_courier_wallet_qa_only.sql`
- `services/api-nest/src/client-commerce/merchant-courier-wallet.pg-qa.adapter.ts`
- `services/api-nest/src/client-commerce/merchant-courier-wallet.qa.controller.ts`
- `services/api-nest/test/merchant-courier-wallet.pg-qa.integration.cjs`
- `services/api-nest/test/merchant-courier-wallet-http.qa.test.cjs`
- `services/api-nest/test/merchant-courier-wallet-release-isolation.qa.test.cjs`
- Les garde-fous Merchant/Courier de `merchant-courier-fulfillment.pg-qa.adapter.ts` sont maintenant réutilisables par le wallet.
- CI : `.github/workflows/native-client-commerce-authority-postgres-qa.yml`, `.github/workflows/client-enrollment-gate.yml`.

**Routes uniquement dans un module Nest QA éphémère, pas AppModule :**
- `POST /qa-isolated/wallet/merchant/summary`
- `POST /qa-isolated/wallet/courier/summary`

**Pas de route `withdraw`, `cashout`, `transfer`, `payout`.** Elles sont absentes volontairement. En production, même avec le flag QA, les nouvelles routes restent interdites.

**Comptes SQL spécialisés :** `da_qa_stripe_finance_reconciler` (seul à allouer après capture), `da_qa_merchant_commerce_app` (lecture Merchant), `da_qa_courier_commerce_app` (lecture Courier). Pas de SELECT direct sur les tables de journal ni DML libre.

### 4. Économie du modèle — STRICTEMENT SYNTHÉTIQUE

Commande fictive de `26,90 EUR` : `23 EUR` menu + `3,90 EUR` frais de livraison. Politique fictive `QA_FIXTURE_EUR_V1` pour `qa-restaurant` : commission menu de `20 %` non approuvée ; totalité du montant livraison attribuée au coursier dans cette fixture.

| Sortie comptable | EUR |
|---|---:|
| Merchant gagné | 18,40 |
| Courier réservé | 3,90 |
| Plateforme conservée (simulation hors TVA/PSP) | 4,60 |
| Total des trois composantes | **26,90** |

Le journal immuable en partie double a une **somme signée de 0** : la quatrième ligne, `allocation_clearing=-26,90 EUR`, est un compte interne de contrepartie, pas un compte de banque.

États :
- Merchant : capture → **pending**, commande `ready` → **available**, refund/chargeback → **held**.
- Courier : avant affectation → **0**, offre assignée → **pending**, `delivered` → **available**, refund/chargeback → **held**.
- **Tous : `withdrawableMinor=0`, `payoutEnabled=false`**. `available` est un statut de la simulation commerciale ; cela ne garantit pas l'éligibilité réglementaire à un virement réel.
- Montants en **minor units**, EUR uniquement en QA. Pas d'agrégation FX implicite, pas de taxes, pourboires, retours partiels ni calcul légal de payout.

### 5. Risques bloquants absolus

1. **Cross-tenant / privilèges SQL :** les fonctions SECURITY DEFINER acceptent encore `merchantSlug`, `issuer` et `subject` comme arguments fournis par la couche serveur. Un rôle DB applicatif compromis pourrait les usurper. Les tests HTTP reposent sur un AuthService **mocké** ; ce n'est pas un test de vraies sessions OIDC. **Doit être corrigé et audité** avant toute ouverture publique : preuve de scope liée à une identité vérifiée ET à une session DB, owner des fonctions NOLOGIN non-superuser, séparation des privilèges, rotation, expiration et révocation.
2. **Finances internationales :** la politique de commission doit être fixée à la réservation selon contrat, pays, devise, statut juridique et taxes. Aucune règle QA 20 % ne peut devenir commerciale sans approbation. Prévoir frais PSP, TVA, arrondis, FX, pourboires, primes, remises, dispute, refund partiel, rétrofacturation après paiement, solde négatif.
3. **Stripe officiel non branché :** l'API Stripe TEST et les vrais webhooks/reconciliation nécessitent un compte `acct_` officiel piné et les clés `sk_test_`, `pk_test_`, `whsec_` séparées dans un coffre de secrets, jamais copiées du VPS ni journalisées. Stripe LIVE gelé. Le versement aux partenaires nécessite un fournisseur capable de faire marketplace payouts dans chaque pays, onboarding/KYC/KYB et preuve du statut PSP final.
4. **UX réelle absente :** les deux nouveaux endpoints QA ne sont pas montés sur le serveur distribué ni appelés par les applications. Certaines statistiques UI préexistantes demeurent **démonstratives** (ex. `apps/merchant/app/_tonton_signature.tsx`, 82 500 XAF statiques). Ne pas substituer des montants de démo à des créances financières.
5. **Transitions physiques :** la course refund/pickup concurrente 008 est sérialisée en PG, mais un pickup ayant déjà COMMIT ne peut pas être annulé matériellement par un refund arrivé plus tard. Concevoir le règlement de litige, récupération, support Ops.
6. **Conformité Stores :** aucune publication sans revue humaine et automatisée G0–G7, captures d'écrans réelles, identifiants reviewers valides, politiques et description strictement alignées sur les fonctions accessibles.

### 6. Prochaine mission — reprise par ordre de risque

**P0 : certifier les identités et l'isolation du compte en PostgreSQL**. Inspecter le vrai système OIDC Merchant/Courier et les tables de contrat/KYB/roster ; faire échouer l'accès à un autre marchand ou coursier même si le serveur ou le rôle DB reçoit un `merchantSlug` ou `subject` falsifié. Tester la révocation, les liens multi-organisations et le même sujet sur deux realms. Un compte superuser ne doit jamais être utilisé pour le trafic applicatif.

**P1 : raccorder Stripe TEST officiel en coffre indépendant**. Valider le compte piné et les permissions ; relier capture + preuve webhook + réconciliation à `da_qa_wallet_accrue_verified_capture()`. Ajouter les preuves de refund partiel, dispute, frais PSP et replays, test contre Stripe TEST seulement après préflight et approbation.

**P2 : bâtir la couche de settlement/payout indépendante** (pas depuis les téléphones). Découper `accrued`, `pending`, `available`, `held`, `withdrawable`, `payout_pending`, `payout_confirmed`, `payout_failed`, avec preuves PSP immuables, traitements de reprise et réconciliation. Pays et devises explicitement séparés.

**P3 : premium mobile UI Merchant/Courier**, sans jamais déclencher l'illusion d'un vrai portefeuille tant que P0–P2 ne sont pas signés. Visuels de gains par course, évolution accessible, commission expliquée, historique infalsifiable, badges de litige, état offline, actualisation serveur push ou polling cohérent. Le compte connecté ne doit jamais obtenir les gains d'un tiers. Geler les valeurs de démonstration si l'app est en mode réel.

**P4 : G0–G7** des trois apps en conditions proches utilisateurs + store compliance, QA sur la release candidate, validation humaine explicite, ensuite seulement examen de la fusion / du déploiement.

### 7. Commandes de reprise sans effet de bord

Sur **Toshiba purpletoshiba**, dans un terminal de contrôle ou via Remote Desktop Commander :

```bash
cd /home/tontoncestcarre/work/DA_STRIPE_RECON_QA_20261012
git branch --show-current
git rev-parse HEAD
git status --short
git log -5 --oneline
```

**Attendu après cette passation :** branche `feat/stripe-test-reconcile-pg-qa-20261012`, worktree propre, nouveau commit documentaire de passation (SHA à lire), PR #36 DRAFT. Ne pas faire de `git reset --hard`, `git clean -fd`, `pnpm install`, `docker compose down`, purge de cache ou redémarrage VPS sans audit préalable. Les derniers tests QA sont reproductibles en GitHub Actions sur un PostgreSQL Docker isolé.

### 8. Documentation source épinglée

- `docs/DA_STRIPE_TEST_RECONCILIATION_QA_2026-10-12.md` : état de tous les paliers Stripe/finances QA.
- `docs/DA_ARCHITECTURE_QA_STRIPE_TEST_POSTGRES_PIN_2026-10-12.md` : topology de confiance et chaîne commerciale.
- `docs/DA_PASSATION_FINANCE_WALLETS_QA_2026-10-13.md` : **CE FICHIER**, point de reprise.

**Instruction centrale au prochain assistant :** commencer par lire les trois documents ; ne pas déduire qu'une suite CI verte rend la production ou Stripe officiel certifiés. La priorité reste l'isolation prouvée des identités financières avant tout écran de chiffres en ligne.

---

**Signature de passation : F4D-WALLET-009-QA / ZERO_PAYOUT / NO_PRODUCTION / NO_MERGE / NO_STORE.**
