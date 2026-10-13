# 📌 DelishAfrica® — Architecture épinglable : commerce / Stripe TEST / PostgreSQL 17 (QA isolée)

**Date :** 12 octobre 2026
**Statut :** candidats certifiés en CI synthétique, **NON ACTIVÉS / NO-GO commercial et Stores**
**Branche :** `feat/stripe-test-reconcile-pg-qa-20261012`, [PR #36 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/36), superposée à [PR #35 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/35).
**Ancêtre de référence :** webhook PG certifié `640df62bc9ed6bdfbf3de593b08e99b6faae72b4`.
**Monorepo runtime historique :** `/opt/delishafrica/monorepo`, **non modifié dans cette intervention**. `/opt/delishafrica/compose` est historique et ne doit pas servir de source des apps.
**Copie QA isolée Toshiba :** `/home/tontoncestcarre/work/DA_STRIPE_RECON_QA_20261012`.

## Graphe logique — NE PAS confondre avec architecture déployée

```mermaid
flowchart TD
    A["Client iOS / Android<br/>sélection menu, mutationId"] --> B{"Guard Client JWT signé<br/>issuer JWKS épinglé + admission<br/>SMS/e-mail persistée"}
    B -->|refus| Z["HTTP 401 / 403 / 503<br/>zéro mutation"]
    B -->|autorisé| C["Catalogue serveur publié<br/>devis canonique + montant EUR"]
    C --> D["PG 17 rôle app<br/>réserver ordre idempotent"]
    D --> E["PG 17 rôle app<br/>réserver autorité Stripe TEST"]
    E --> F["rôle creator<br/>GET compte Stripe TEST épinglé"]
    F --> G["POST PaymentIntent TEST<br/>clé d'idempotence unique réservée"]
    G --> H["PG 17 creator<br/>lier PaymentIntent immuable"]
    H --> I["PaymentSheet Client QA<br/>confirmation volontaire"]
    I --> J["Webhook Stripe signé<br/>raw bytes, rôle inbox seulement"]
    J --> K["reçu inbox PostgreSQL<br/>jamais paid à lui seul"]
    K --> L["rôle finance séparé<br/>GET Stripe TEST PaymentIntent + charge"]
    L --> M{"compte, sujet, devis,<br/>montant, devise, capture,<br/>remboursement/litige"}
    M -->|mismatch| Z2["NO-GO + investigation"]
    M -->|capturé, non remboursé| N["PG transaction atomique<br/>authority succeeded + order paid"]
    N --> O{"hold refund / dispute ?"}
    O -->|oui| P["dispatch interdit<br/>escalade opérationnelle"]
    O -->|non| Q["Merchant accepte / prêt<br/>Courier collecte / livre"]
```

Ce graphe est la **cible fonctionnelle**, pas une assertion que la chaîne HTTPS réelle est raccordée. Aujourd'hui, les quatre opérations PG/réconciliation du milieu existent dans le laboratoire ; les routes publiques et les rôles natifs restent déconnectés.

## Frontières d'autorité

| Acteur | Autorité permise | Autorité refusée |
| --- | --- | --- |
| Client mobile | envoyer panier SKU/quantité et mutation idempotente | choisir prix, statut paid, rôle ou `client_subject` |
| Guard Client | vérifier JWT cryptographiquement + email/SMS autorisés en transaction | admettre sur simple entête ou profil local |
| Catalog server | chiffrer devis à partir des données publiées | accepter montant du smartphone |
| PostgreSQL app | réserver commande, autorité et clé unique | écrire `paid`, `provider_verified` |
| Receiver webhook | persister événement HMAC signé, anti-replay | écrire `paid` ou confirmer un montant |
| Stripe intent creator | vérifier compte TEST puis créer/lier **une** PI | utiliser une clé `sk_live_`, confirmer/capturer sans le Client |
| Financial reconciler | relire PI/charge Stripe, écrire preuve transactionnelle | livrer si remboursement/litige/écart |
| Merchant / Courier | traiter uniquement commandes payées et attribuées | contourner l'ownership, auto-pickup, auto-livraison |
| Ops | diagnostic, blocage fraude, rapprochement humain | forcer `paid` par un simple champ HTTP |

## Implémentation dans la PR #36

- Migration `services/api-nest/migrations/client-commerce/20261012_004_stripe_test_financial_reconciliation_qa_only.sql` : rôles creator/finance QA, fonctions réservées, reçu financier append-only, hold et garde de dispatch.
- `services/api-nest/src/client-commerce/stripe-test-intent-create.pg-qa.adapter.ts` : réservations SQL préalables, `GET /v1/account`, POST TEST à clé réutilisée, bind PG, blocage au-delà de 18 h sans PI durable.
- `services/api-nest/src/client-commerce/stripe-test-financial-reconcile.pg-qa.adapter.ts` : `GET /v1/account`, `GET /v1/payment_intents/:id?expand[]=latest_charge`, contrôles capture/ownership et transaction atomique.
- Tests de ces composants sur **PostgreSQL 17 réel dans Docker `--network none`**, avec le fournisseur HTTPS intégralement simulé. Aucun secret réel, aucun conteneur persistant ni port exposé.
- `services/api-nest/src/client-commerce/client-commerce-canonical-quote.pg-qa.adapter.ts` : pare-feu du devis. Accepte seulement partenaire, SKU, quantité ; consulte le vrai `CatalogOrderPolicyService` côté serveur ; recalcule prix EUR, frais, disponibilité et empreintes. Le JSON du mobile ne fournit jamais le montant à Stripe.
- `services/api-nest/src/client-commerce/native-client-checkout.qa.controller.ts` : prototype HTTP NestJS **isolé non déployé** sous `/qa-isolated/client-commerce/payments/create-intent`, avec JWT Client RSA et admission durable, contrôle explicite QA non-production et port provider simulé dans les tests. Cette route n'est PAS le vrai `/payments/create-intent`.
- `ops/stripe/DA_STRIPE_TEST_OFFICIAL_PREFLIGHT_V1.sh` : vérification préliminaire en lecture seule des conditions TEST, sans exposition des secrets. Accès fournisseur GET uniquement sous deux garde-fous indépendants, désactivé par défaut.
- `apps/client/utils/daCheckoutAttemptFence.ts` et appels expérimentaux dans `apps/client/app/checkout-preflight.tsx` : préservation du même `clientMutationId` **avant** création d'intention ; état SecureStore immuable du Client par compte et empreinte de panier ; `sheet_open` bloque toute reprise de paiement ambiguë. Relecture de l'ordre payé identique exigée pour libérer le verrou. Double garde QA : `EXPO_PUBLIC_DA_CHECKOUT_FENCE_QA=YES` **et** `NODE_ENV` non-production. Ce n'est ni une preuve bancaire ni une solution de réconciliation multi-appareil. Aucun binaire Store modifié.
- CI commune API + Client/Merchant/Courier et preuve HTTP sur le même SHA `a2783bdcd569ee577a1aac424f74286057a9498d` : [#38296555360](https://github.com/adminluxe/DelishAfrica/actions/runs/38296555360) SUCCESS ; SQL PG17 [#38296555438](https://github.com/adminluxe/DelishAfrica/actions/runs/38296555438) SUCCESS.
- Point d'entrée réel **NON raccordé** : `services/api-nest/src/app.module.ts` et routes existantes `orders/create`, `payments/create-intent`, `stripe/webhook`. La séparation est intentionnelle tant que le parcours natif E2E et Stripe TEST officiel n'ont pas été certifiés.

## Chaînage du contrat commercial Client QA — deux POST, zéro route de production

**Certifié dans le laboratoire le 12 octobre 2026**, code SHA `4d3135d516889e3087b45a63d77ba02dd6d674c0` (NestJS HTTP + PG17 CI **SUCCESS**) puis code SHA `9dfefa35c751e252d636c988641ed570221120d1` (12 tests Client + les trois applications + PG17, deux CI **SUCCESS**).

```text
Client QA / session OIDC authentifiée
    |
    | SecureStore: reserve:<nonce> + mutation stable + panier local
    v
POST /qa-isolated/client-commerce/orders/create
    |
    | NativeClientNestCommerceGuard JWT RSA + admission e-mail/SMS
    | catalogue publié -> devis serveur
    | da_qa_service_reserve_order() -> UUID PostgreSQL immuable
    v
orderId:UUID + canonicalQuoteFingerprint + canonicalCartFingerprint
    |
    | SecureStore bindServerOrderId() une seule fois
    v
POST /qa-isolated/client-commerce/payments/create-intent
    |
    | MÊME Client / mutation / UUID / devis / panier serveur
    | nouvelle lecture de réservation PostgreSQL avant provider
    | créateur TEST SQL-first, HMAC de la clé d'idempotence
    v
PaymentIntent TEST + clientSecret
    |
    | SecureStore markIntent() AVANT PaymentSheet
    | confirmation volontaire seulement si future UI QA validée
    v
Webhook HMAC -> Inbox PG -> Finance GET Stripe + charge -> paid
    |
    | UNQUEMENT après preuve bancaire durable, pas sur callback UI
    v
Merchant -> Courier (NON encore raccordé)
```

Le contrôleur `services/api-nest/src/client-commerce/native-client-checkout.qa.controller.ts` expose les deux POST **uniquement dans un module Nest éphémère de test** ; aucune route QA n'est enregistrée dans `services/api-nest/src/app.module.ts`. Port de catalogue réel `QaCanonicalClientQuoteAdapter`, réservation SQL stricte `QaClientCommercePgAdapter`, créateur TEST `QaStripeTestIntentCreator` ; en test HTTP, les ports PostgreSQL/Stripe sont simulés, tandis que les adaptateurs SQL/Stripe passent leur suite distincte sur PG17 déconnecté.

La classe Client `apps/client/utils/daCanonicalCheckout.qa.ts` est **non importée dans les écrans Expo** : elle n'est pas un correctif déployé. Le verrou `apps/client/utils/daCheckoutAttemptFence.ts` sait désormais remplacer une fois la référence locale par le UUID **avant** PI, puis interdit les rebind et les doubles tentatives incertaines. Les écrans runtime continuent d'appeler les anciens endpoints ; ni PaymentSheet réelle, ni réception `paid`, ni remise au marchand ne sont raccordées.

```text
APP_MODULE PUBLIC ROUTES               UNCHANGED
QA HTTP module                         isolated tests ONLY
Test account / real Stripe access      NOT_CONFIGURED locally
Test PG17                              ephemeral network-none Docker
Merchant/Courier paid gate             NOT_WIRED
G0–G7                                  NO-GO
GitHub PR #35 / #36                    DRAFT / NO MERGE
```

**Attention à l'idempotence multi-appareils :** le verrou SecureStore est local à un terminal. Le serveur doit aussi empêcher des commandes réellement doublées à partir de mutations différentes ou de sessions parallèles dans un contrat produit explicitement défini avant toute activation publique. Le stock et les lignes d'ordre doivent être persistés pour un vrai fulfill Merchant ; les tables de réserve actuelles lient montants/empreintes mais ne sont pas encore le modèle complet commercial.

## Architecture épinglée — preuve financière Client après PaymentSheet (13/10/2026)

**Jalon code a0dbcc6bb1224db192fc9d918f38af946d2cad8b ; doubles CI SUCCESS :**
[API + 3 apps #38317389130](https://github.com/adminluxe/DelishAfrica/actions/runs/38317389130) · [PostgreSQL17 #38317389082](https://github.com/adminluxe/DelishAfrica/actions/runs/38317389082).

~~~text
Client QA (aucun écran Expo n'importe cette séquence)
    |
    | SecureStore: ordre UUID + mutation + PaymentIntent du test
    | Token RSA/JWT réel Client avec admission durable e-mail/SMS
    v
POST /qa-isolated/client-commerce/orders/status [HTTP NEST QA UNIQUEMENT]
    |
    | Contrôle rôle, issuer, subject, ordre UUID et mutation
    v
QaClientOwnedOrderReceiptReader [PORT PG QA EN LECTURE SEULE]
    |
    v
da_qa_client_read_owned_order(order, issuer, subject)
    |
    +-- pending / pas de reçu --> awaiting_payment, dispatch=false
    |
    +-- capture vérifiée + reçu immuable + aucun hold
    |                           --> paid, dispatch=true
    |
    +-- remboursement ou litige --> financial_hold, dispatch=false
    |
    +-- divergence d'état financier --> needs_review, dispatch=false
    |
    v
Client QA : SEUL 'paid' + même PI permet de vider le verrou local
    |
    +-- Status en attente/hold/erreur --> verrou intact, aucune nouvelle PI
    |
    v
Merchant et Courier doivent revérifier l'éligibilité au dispatch
    [NON RACCORDÉS, NON DÉPLOYÉS]
~~~

**Séparation des responsabilités :** l'API Client lit l'autorité financière durable, elle ne la crée pas. Le webhook Stripe signé entre en inbox et le reconciler serveur indépendant vérifie Stripe TEST via la charge réellement capturée, avant tout commit financier SQL. Le Client et ses événements PaymentSheet ne peuvent jamais imposer paid. La migration 005 n'est accessible qu'au rôle QA de lecture fonctionnelle, sans SELECT/DML direct sur les tables. Les tests Nest réels utilisent des ports PostgreSQL/Stripe simulés ; seule la CI PostgreSQL est exécutée contre une vraie base **déconnectée**.

**Frontière de confiance encore incomplète :** les arguments issuer et subject de la fonction SQL ne constituent pas une preuve d'identité autonome au niveau de PostgreSQL. Ils doivent être fournis exclusivement par l'admission vérifiée du serveur ; une compromission du compte DB applicatif imposerait une protection complémentaire avant production. Renforcer SECURITY DEFINER (propriétaire NOLOGIN non-superuser), les rôles, la propagation des claims signés et la révocation des permissions dangereuses avant tout rapprochement production.

**GEL :** pas de modification des routes de production ; pas d'intégration dans les binaires Client/Merchant/Courier ; pas de Stripe réel TEST ni LIVE ; pas de migration VPS ni de changement Keycloak ; pas de G0–G7, fusion ou Store sans certification et feu vert du propriétaire.

## Architecture QA F4 — panier marchand immuable avant paiement (13/10/2026)

**Source du code :** commit `e40b0ecb49d29f64c6abe4db68507de741b7427c`. [CI SQL PostgreSQL17 #38319913618](https://github.com/adminluxe/DelishAfrica/actions/runs/38319913618) et [CI API + 3 apps #38319916985](https://github.com/adminluxe/DelishAfrica/actions/runs/38319916985) : **SUCCESS sur le même SHA**.

```text
Client JWT Client admis (source de vérité de l'identité)
      |
      | Seuls merchantSlug + SKU + quantité sont fournis par le mobile
      v
CatalogOrderPolicyService (catalogue publié SERVEUR)
      |
      | Nom, catégorie, quantité, prix unitaire, montant ligne,
      | sous-total, livraison, devis/fingerprint canoniques
      v
QaCanonicalOrderSnapshotPgAdapter (QA seulement)
      | TRANSACTION PostgreSQL BEGIN
      |    da_qa_service_reserve_order() : UUID canonique
      |    da_qa_service_store_order_snapshot() : panier immutable
      | COMMIT ou ROLLBACK intégral en cas d'échec
      v
da_client_commerce_order_snapshot_qa (migration 006 déconnectée)
      | App ne détient que EXECUTE sur fonction snapshot
      | AUCUN SELECT/UPDATE direct ; panier en lecture immuable
      v
BEFORE INSERT payment authority : refuse snapshot manquant
      |
      | Stripe TEST synthétique : vraie capture/reçu financier PG17
      v
da_qa_commerce_order_dispatch_eligible()
      | Exige panier + reçu capturé + paid vérifié + pas de refund/hold
      v
Merchant/Courier : aucune route publique raccordée à ce jour
```

**Propriété majeure :** un paiement ne doit jamais pouvoir être créé pour un UUID sans panier conservé. Le trigger 006 coupe les réservations historiques dépourvues de snapshot dès que cette migration est appliquée ; c'est voulu dans le laboratoire, mais **interdit de la promouvoir telle quelle sur les bases VPS existantes** sans stratégie de compatibilité et migration contrôlée. Le seul nouvel adaptateur transactionnel est encore expérimental et non injecté dans AppModule.

**Limites de confiance :** le snapshot SQL valide arithmétique, valeurs et concordance avec le devis de l'ordre, mais **ne vérifie pas à lui seul que les noms/prix proviennent du catalogue publié** : ce rôle appartient à `CatalogOrderPolicyService` et au contexte serveur approuvé. Les `SECURITY DEFINER` et arguments issuer/subject exigent un propriétaire dédié non-superuser, une séparation IAM et une identité liée aux claims vérifiés avant une production. Toute émission de mission Merchant/Courier requiert une nouvelle vérification transactionnelle juste avant dispatch/accept/pickup, pour empêcher la livraison après un hold tardif.

**Test Node réellement connecté à PostgreSQL : CERTIFIÉ EN QA.** Le commit exact `2b54913be6310fa399f0c3ea676b73e40d911b81` passe les deux pipelines [PostgreSQL 17 #38320332214](https://github.com/adminluxe/DelishAfrica/actions/runs/38320332214) **SUCCESS** et [API + 3 apps #38320332362](https://github.com/adminluxe/DelishAfrica/actions/runs/38320332362) **SUCCESS**. Le fichier `services/api-nest/test/client-order-snapshot.pg-qa.integration.cjs` exerce l'adaptateur transactionnel contre deux PgPools applicatifs en véritable PostgreSQL 17 sans réseau : **8 courses simultanées → 1 UUID, 1 panier, 1 autorité de paiement**, compatibilité legacy sans panier refusée, panne avant COMMIT → ROLLBACK et aucune commande orpheline, SELECT/UPDATE directs refusés au rôle applicatif. Cette preuve complète les tests SQL 006; elle n'implique ni Stripe TEST officiel ni le raccordement Merchant/Courier. **Stripe officiel TEST non connecté, routes publiques non migrées, G0–G7 NO-GO, PR #35/#36 DRAFT, LIVE gelé.**

## Architecture épinglée — flux Merchant / Dispatch / Courier QA 007 (13/10/2026)

**Preuves :** migration SQL + contrôleur QA code `d3a0d48a317f3c867e64d229e752da23c9e59a33`, [CI PG17 #38322184915](https://github.com/adminluxe/DelishAfrica/actions/runs/38322184915) et [CI API/3 apps #38322184929](https://github.com/adminluxe/DelishAfrica/actions/runs/38322184929) **SUCCESS**. Adaptateur Node réel + trois pools PG `3ebcdcbd2db4a753beffc8b9e3c1d8c67f1903ee`, [CI PG17 #38322468685](https://github.com/adminluxe/DelishAfrica/actions/runs/38322468685) et [CI API/3 apps #38322468143](https://github.com/adminluxe/DelishAfrica/actions/runs/38322468143) **SUCCESS**.

```text
Client signé et admis
  -> catalogue publié serveur
  -> UUID + devis + snapshot immuable PostgreSQL 006
  -> Stripe TEST *synthétique* ; capture + reçu financier + NO HOLD
       |
       v
Merchant QA HTTP (OrdersAuthGuard + membership contractuel actif)
  -> Pool da_qa_merchant_commerce_app
  -> SQL da_qa_merchant_visible_paid_orders() : inbox payé uniquement
  -> SQL da_qa_merchant_transition() : accepted -> ready
       |
       v
Dispatch interne (courier roster serveur, JAMAIS HTTP du téléphone)
  -> Pool da_qa_dispatch_commerce_app
  -> SQL da_qa_dispatch_assign_offer() : un seul livreur assigné
       |
       v
Courier QA HTTP (OrdersAuthGuard + registre actif)
  -> Pool da_qa_courier_commerce_app
  -> SQL da_qa_courier_assigned_offers() : assignee uniquement
  -> SQL da_qa_courier_transition() : offered -> accepted
                                             -> picked_up -> delivered
       |
       +-- à CHAQUE transition : snapshot + capture + reçu + absence hold
       +-- hold refund/dispute déjà commité -> blocage, pas de pickup
```

**Frontières de confiance :** le vrai `OrdersAuthGuard` est exécuté en HTTP de laboratoire, mais son `AuthService` résout une identité simulée pendant ces tests. Les porteurs d'identité marchand et livreur réels, le ledger de membership et le registre Courier restent à intégrer. Les fonctions SQL en SECURITY DEFINER n'authentifient **pas** de façon autonome un issuer/subject ou un merchantSlug transmis par la couche applicative. Les rôles de base sont séparés, mais ce point exige un lien serveur↔base attesté ainsi qu'un propriétaire fonction NOLOGIN avant toute promotion.

**Course financière à traiter :** les tests confirment le blocage si le refund est déjà commité avant `picked_up`, pas la sérialisation complète si hold et transition se produisent simultanément. La prévention transactionnelle doit être renforcée/testée pour éviter un TOCTOU de livraison. Adresse de livraison, géolocalisation/ETA, réassignation, vraies notifications et Ops n'appartiennent pas encore au modèle 007.

**GEL TOTAL :** SQL 007 et routes QA **non installés sur VPS**, aucun module enregistré dans `AppModule`, aucun Stripe officiel TEST/LIVE, aucun EAS, aucun G0–G7, aucun merge des PR #35/#36, aucun Store. Ces schémas/sources sont des candidats QA, non des permissions de mise en production.

## Architecture QA F4C — verrou financier et livraison atomiquement ordonnés (13/10/2026)

**Code :** `dde5b460d0c547d59c3dcafa907149b178d512d2`. [CI PostgreSQL17 réelle #38323181256](https://github.com/adminluxe/DelishAfrica/actions/runs/38323181256) **SUCCESS** ; [CI API + 3 apps #38323181287](https://github.com/adminluxe/DelishAfrica/actions/runs/38323181287) **SUCCESS**.

```text
                 UNE COMMANDE UUID / ORDER ROW
                         PostgreSQL17
                              |
                 Verrou unique FOR UPDATE
                   ordre commande AVANT
                ordre autorité de paiement
                     /              \
                    /                \
        DA finance TEST QA      Courier/Dispatch QA
          record_hold()           transition()
          refund/dispute       accepted/picked_up/
                               delivered (ou offer)
                    \                /
                     \              /
              Une seule progression validée
              à la fois; l'autre doit attendre
                              |
        +---------------------+----------------------+
        |                                            |
   hold COMMIT premier                      pickup COMMIT premier
        |                                            |
   pickup refusé                           hold attend puis s'inscrit
   état reste accepted                             |
                                            delivered ensuite refusé
```

**Migration QA 008 :** `CREATE OR REPLACE FUNCTION da_qa_finance_record_hold` ne change ni signature ni permissions de sa fonction 004 ; elle verrouille l'ordre et l'autorité dans le même ordre que les transitions 007, contrôle à nouveau le reçu financier, puis insère le hold append-only avec idempotence. Aucune table ni route publique modifiée. Les rôles restent séparés et le test réel utilise deux PgPools transactionnels et `pg_stat_activity` pour constater les attentes `wait_event_type=Lock`.

**Garantie exacte :** la présence d'un hold déjà COMMIT interdit la progression, même si une opération Courier était simultanément en attente. Si l'enlèvement avait légalement COMMIT avant le remboursement, il ne peut être « dé-enlevé » ; la retenue empêche toute progression ultérieure vers `delivered`. L'exécution des litiges et retours physiques nécessite un processus Ops/assistance additionnel.

**Frontières à corriger avant promotion :** fonctions SECURITY DEFINER avec propriétaire de laboratoire, issuer/subject/slug fournis par service applicatif sans attestation cryptographique dans la DB ; vrai JWT Merchant/Courier et membres KYB/registre actifs non intégrés au backend cible ; transports Expo et notifications non branchés ; jamais de connexion officielle Stripe TEST ni G0–G7 validés. Ne jamais appliquer 001–008 aux bases VPS en l'état.

## Architecture QA F4D — FINANCE WALLET Merchant & Courier, journal équilibré 009 (13/10/2026)

**Dernier code certifié QA :** `9801dc0801361e80c28a67d8478c10a462909a23` ([PG17 #38324552260](https://github.com/adminluxe/DelishAfrica/actions/runs/38324552260) et [API/apps #38324552388](https://github.com/adminluxe/DelishAfrica/actions/runs/38324552388) SUCCESS). Routes QA ajoutées en `1af2f65e116d427be63585aefd6f000dcf34db09` ([PG #38324760411](https://github.com/adminluxe/DelishAfrica/actions/runs/38324760411) et [HTTP + 3 apps #38324760436](https://github.com/adminluxe/DelishAfrica/actions/runs/38324760436) SUCCESS). Garde d'isolation en `79964cee22cb39a60b1588912e2d2199dd5b17c1`, CI **SUCCESS** [PostgreSQL17 #38324993520](https://github.com/adminluxe/DelishAfrica/actions/runs/38324993520) et [API + 3 apps #38324993516](https://github.com/adminluxe/DelishAfrica/actions/runs/38324993516).

```text
  Client commande [QA: JWT/ledger simulés en HTTP]
              |
  devis serveur + panier 006 immuable
              |
  paiement Stripe TEST synthétique VÉRIFIÉ et capturé (004)
              |
              v
       FINANCE RECONCILER RÔLE QA
       (pas d'autorisation mobile)
              |
       order FOR UPDATE + receipt exact + policy DB
              |
       009 da_qa_wallet_accrue_verified_capture(UUID)
         - montant exact, idempotent x8
         - policy immuable QA_FIXTURE_EUR_V1, EUR SEULEMENT
         - signed journal immutable 4 lignes, total = ZERO
              |
              +-- Clearing interne  -26,90€ (PAS un compte bancaire)
              +-- Merchant earned    +18,40€ (TEST)
              +-- Courier reserved   +03,90€ (TEST)
              +-- Platform retained  +04,60€ (TEST)
              |
      2 projections de droits calculées À LA LECTURE
              |
         +----+-------------------------------------+
         |                                          |
   Merchant membership                       Courier roster
   issuer/subject + KYB+contrat              issuer/subject actif
   [contrôle app QA]                          [contrôle app QA]
         |                                          |
   /qa-isolated/wallet/merchant/summary    /qa-isolated/wallet/courier/summary
         |                                          |
   capturé -> pending                       pas assigné -> aucun droit
   ready -> available                       offert -> pending
   refund -> held                           delivered -> available
                                             refund -> held
         |                                          |
         +-----------------+------------------------+
                           |
                   withdrawable = 0
                   payoutEnabled = false
                   NO BANK / NO STRIPE PAYOUT
```

Les tables `da_qa_wallet_policy`, `da_qa_wallet_allocation`, `da_qa_wallet_posting` sont append-only et invisibles aux rôles applicatifs ; une fonction finance seule écrit. Les rôles `da_qa_merchant_commerce_app` et `da_qa_courier_commerce_app` ne peuvent appeler que leurs projections respectives. Les présentations HTTP Nest sont **strictement en lecture seule, protégées par OrdersAuthGuard et désactivées en production** ; `Cache-Control: private, no-store`, champs HTTP limités. `AppModule` ne référence pas ces composants.

**Attention aux limites de confiance :** les projections SQL de ce laboratoire acceptent encore le `merchantSlug` ou `issuer/subject` passés par le service. Le rôle PostgreSQL est partagé par les requêtes du produit : il n'existe pas de liaison cryptographique **indépendante côté DB** avec la session du commerçant/livreur. En cas de compromission du service, des lectures cross-tenant restent théoriquement possibles. Il s'agit donc de **candidats QA, et pas de services bancaires sécurisés en production**. Les tests HTTP utilisent le vrai contrôleur/OrdersAuthGuard mais un `AuthService` synthétique ; les vrais JWT/SMS/KYB/rosters ne sont pas certifiés de bout en bout.

**Architecture internationale future :** ledger versionné par contrat/territoire/devise dès la réservation du panier ; transactions unitaires en *minor units* strictement isolées par devise ; répartition TVA/taxes, commission, pourboires, chargebacks, remboursements partiels et solde négatif ; PSP marketplaces/Connect et retenues KYC/KYB ; preuve d'éligibilité disponible / réellement retirable / réellement viré et rapprochement des transferts. Pas de conversion FX implicite, jamais de valeur décorative présentée comme argent acquis.

**Principes UI premium :** réaction instantanée à chaque événement financier **confirmé par API**, animation de mouvement associée à son UUID et à la commande, preuve visible de commission/frais, quatre catégories *en attente / éligible / bloqué / viré*, filtres par période et devise, avis intelligibles sur litiges, état offline clairement « dernière synchronisation » sans solde fictif. Pas d'animation de montant optimiste après action du téléphone.

**NO-GO absolu avant intégration :** pas de Stripe TEST officiel, pas de payout, pas d'inscription dans AppModule ou apps Expo, pas de migration VPS/PG prod, pas de fusion ni Store. Valider préalablement scope cryptographique et IAM SQL, PSP TEST, conformité territoriale et G0–G7 des trois applications.

## Interventions interdites avant signature d'un passport G0–G7

```
main                         PROTÉGÉ
PR #35 / PR #36              DRAFT, sans merge
VPS / Docker / PG prod       aucune migration 001-004 en production
Cloudflare / Keycloak        aucun changement
Apple / Android / EAS        aucune build soumise ni publiée
Stripe LIVE                  interdit
Stripe TEST officiel         désactivé, attente environnement QA approuvé
```

## Critères de promotion vers vraie route commerciale

1. **CI verte sur le SHA exact**, avec preuves de rôles, anti-replay, multi-pools, coupures réseau/SQL, remboursement et hold.
2. **Environnement Stripe TEST officiel isolé**, `sk_test_`, `pk_test_`, `whsec_` distincts dans coffre de secrets, compte `acct_` épinglé, aucune clé dans Git/logs.
3. Guard Client réellement branché au JWT signé et à l'admission Keycloak/SMS/e-mail persistée ; récupération fiable de ses permissions et révocation.
4. API `/orders/create`, `/payments/create-intent`, webhook, `/orders/confirm` avec devis serveur, idempotence SQL, scénarios paiement refusé/annulé/3DS, sans retomber sur la démo.
5. Merchant & Courier : ownership, proposition/acceptation, aucun pickup/delivered automatique, livraison interdite si non payé/hold.
6. Tests **G0–G7** sur Client/Merchant/Courier iOS et Android, captures, SHA et numéros de builds ; validation explicite de Tonton avant merge/store.
7. Correction indépendante des propriétaires `SECURITY DEFINER`/rôles avant toute migration hors Docker QA : les fonctions du laboratoire appartiennent à l'administrateur du conteneur et ne sont PAS des privilèges production.

**État read-only VPS après retour SSH (12/10/2026) :** API 3010/3011 HTTP 200, Keycloak/PG/API actifs ; `/opt/delishafrica/monorepo` sur `innovation/confluence-trust-current-20261001` à `e504c04`, 15 fichiers suivis modifiés ; disque 88 % utilisé, 25 Go libres. Un ancien conteneur utilise une clé au format Stripe TEST, mais la QA officielle isolée n'est pas configurée/activée et aucun secret n'a été affiché ni utilisé. Aucune opération live. Détails dans `docs/DA_STRIPE_TEST_RECONCILIATION_QA_2026-10-12.md`.

**Décision :** ce document complète les anciens pins sans prétendre les modifier sur le VPS. État = **pré-production isolée, provider TEST réel et routes commerciales non certifiés**.

---

## Architecture addendum F4E — frontière du compte financier (13 octobre 2026)

**Base F4D :** `cd0ba578401d087f9f42c4303e5501704d6bbf94`, CI [PG17 38325285489](https://github.com/adminluxe/DelishAfrica/actions/runs/38325285489) / [API et apps 38325285497](https://github.com/adminluxe/DelishAfrica/actions/runs/38325285497) SUCCESS.

**Candidat F4E :** branche `feat/f4e-wallet-scope-isolation-qa-20261013`, [PR #37 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/37) distincte de #36 ; tests techniques de la migration 010 et du gate OIDC passés sur le **même SHA de code** `f97567f3e7c89ae5f80e33261cd2da6a2045dfb8` : [PG17 38327215358](https://github.com/adminluxe/DelishAfrica/actions/runs/38327215358) SUCCESS et [API + trois apps 38327215429](https://github.com/adminluxe/DelishAfrica/actions/runs/38327215429) SUCCESS. Les changements documentaires ultérieurs n'emportent pas automatiquement une nouvelle certification du HEAD.

```text
Keycloak OIDC (réel) ----------------------- NON RELIÉ À L'ATTESTOR 010
  | RSA/JWKS, issuer, aud, azp, rôle          (F4E renforce le gate claim)
  v
NestJS OrdersAuthGuard + contrôle de session
  | membership/contrat/KYB/roster durable    (source réelle NON intégrée F4E)
  v
ATTÉSTEUR SQL DÉDIÉ : da_qa_wallet_attestor_010
  | app login SQL / challenge lié PID + backend_start
  | scope issuer + subject + org + territoire + marchand
  | registre QA synthétique validé et durée courte
  v
Ticket SQL UUID (non forgé par app), 20 s, usage unique
  |
  v
APP MERCHANT OU COURIER : read_attested_010(ticket,limit)
  | contexte SQL = session_user + backend PID/start
  | nouvelle vérification statut juridique et roster
  | anciens EXECUTE directs par slug/issuer/subject RÉVOQUÉS
  v
NOLOGIN READ OWNER → projection historique 009 (lecture seule)
  |    merchant: capturé → pending ; ready → available ; hold → held
  |    courier: offert → pending ; delivered → available ; hold → held
  v
  withdrawableMinor = 0 / payoutEnabled = false
  Aucun Stripe officiel / aucune banque / aucun versement
```

Propriétaires SQL `da_qa_wallet_read_owner_010` et `da_qa_wallet_write_owner_010` sont **NOLOGIN NOSUPERUSER** ; l'observation `pg_stat_activity.backend_start` est limitée à une fonction du backend courant sous troisième rôle `NOLOGIN` avec capacité exceptionnelle `pg_read_all_stats`. Cette exception doit rester confinée et être revue indépendamment. Les anciens ports de mutation Merchant/Courier/Dispatch perdent EXECUTE aux rôles applicatifs après migration 010 : **réactivation interdite** tant qu'une même attestation n'est pas réalisée sur chaque écriture.

Le ledger 009 ne possède pas encore de dimension juridique/territoriale propre : F4E exige un propriétaire unique du slug Merchant et interdit la multi-affectation territoriale du même Courier. Ce comportement fail-closed n'est PAS une implémentation internationale complète. Les registres 010 sont des **fixtures synthétiques**. Un attestor compromis pourrait encore tenter d'emprunter une identité active : séparation des credentials, vérification cryptographique du port de preuve et révocation temps réel restent des gates P0 absolus.

**CI synthétique verte ≠ identité Keycloak réelle certifiée ≠ argent véritable.** Aucun changement VPS, Stripe TEST officiel ou LIVE, production SQL, EAS, Store, PR merge. Roadbook F4E détaillé : `docs/DA_PASSATION_F4E_WALLET_TENANT_ISOLATION_P0_QA_2026-10-13.md`.

---

## Architecture F4F — pont de confiance JWT / révocation / wallet SQL (13 octobre 2026)

**Réalisation F4F :** [PR #38 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/38), issue de F4E [PR #37 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/37). [Passation dédiée](./DA_PASSATION_F4F_SIGNED_PARTNER_WALLET_QA_2026-10-13.md). Les deux CI sur **code SHA `2d7b6b250bf160244f91c85eeb80615fb6e9b4e4`** : [PG17 #38328354487](https://github.com/adminluxe/DelishAfrica/actions/runs/38328354487) et [API + 3 apps #38328354493](https://github.com/adminluxe/DelishAfrica/actions/runs/38328354493) **SUCCESS** en QA *synthétique*.

```mermaid
flowchart TD
    A["Bearer Merchant ou Courier<br/>JWT RSA synthétique en CI"] --> B{"API Trusted RSA/JWKS verifier<br/>issuer/aud/azp/role/sub/exp"}
    B -->|échec| Z["DENY, aucune SQL"]
    B -->|admis| C{"Révocation sid+jti<br/>preuve indépendante fraîche"}
    C -->|inactif/inconnu| Z
    C -->|actif| D{"Contrat & KYB Merchant<br/>ou roster/KYC Courier<br/>org + territoire actifs"}
    D -->|insuffisant| Z
    D -->|admis| E["Pool PostgreSQL dédié<br/>rôle Merchant ou Courier"]
    E --> F["F4E 010: challenge session_user<br/>backend PID + backend_start"]
    F --> G["Attestor SQL séparé<br/>contrôle registre actif"]
    G -->|échec| Z
    G -->|ticket 20 s, usage unique| H["read_attested_010<br/>revérification métier au SQL"]
    H --> I["Wallet 009 synthétique<br/>pending / available / held"]
    I --> J["Withdrawable = 0<br/>payoutEnabled = false"]
```

Le code `merchant-courier-wallet-signed-session.pg-qa.bridge.ts` ne s'enregistre dans aucun `AppModule` ni route exposée. Il refuse les requêtes si `NODE_ENV=production`, hors CI ou sans flag QA. Aucun paramètre mobile de tenant, slug, subject, organisation, territoire ou montant n'est pris en compte par l'attestation. Le port d'attestation DOIT appartenir à un service séparé, jamais au public gateway. Le test emploie une clé privée RSA créée en mémoire, un cache JWKS de test et un registre SQL 010/registre de révocation entièrement synthétiques ; il **ne** relie **pas** à Keycloak de production. Aucune lecture bancaire n'est réalisée.

**Manque avant P0 réel** : véritable Keycloak Merchant/Courier + provenance JWKS et révocation persistante, rattachement en temps réel aux contrats/KYB, organisation/territoire et registre Courier, rôles de DB dédiés à un service attestateur indépendant durci, vérification de la rotation et des replays, mutation Merchant/Dispatch/Courier attestée, ledger juridique multinational. Le gate réel n'est PAS certifié ; `Stripe TEST officiel`, `LIVE`, `payout`, VPS, merges, builds EAS et Stores restent gelés.

---

## F4G — Architecture épinglée de la preuve réelle Keycloak en laboratoire (13/10/2026)

**Branche :** `feat/f4g-real-keycloak-partner-session-qa-20261013`, [PR #39 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/39), empilée sur #38 F4F et #37 F4E sans fusion. **Code vérifié :** SHA `21cd567d07ef31a91ed199df299c8bce3c24fd4a`, [Keycloak26 + PG17 38329914958](https://github.com/adminluxe/DelishAfrica/actions/runs/38329914958), [API+apps 38329914989](https://github.com/adminluxe/DelishAfrica/actions/runs/38329914989) et [PG finance 38329915018](https://github.com/adminluxe/DelishAfrica/actions/runs/38329915018) : **SUCCESS**, tous en QA.

```text
Docker CI --network none / zero port publié
  |
  +-- Keycloak 26.4.7 RÉEL, realm factice da-wallet-partners-qa
  |      +-- Merchant A, Merchant B (JWT RSA / aud merchant)
  |      +-- Courier A, Courier B (JWT RSA / aud courier)
  |      +-- client confidentiel d'introspection, secret jetable
  |
  +-- TLS loopback 127.0.0.1 / CA éphémère / sans désactivation TLS
  |       |
  |       v
  |     ExternalJwksVerifierService API RÉEL
  |       | signed JWT issuer + audience + azp + role + sub UUID
  |       v
  |     introspection Keycloak : active=true obligatoire
  |       |
  |       v
  +-- PostgreSQL 17 RÉEL, données strictement SYNTHÉTIQUES
          |
          +-- 011 session_key SHA256(issuer/sub/sid/jti), révocation
          |       Attestor SELECT uniquement
          |
          +-- 010 membership, KYB, contrats et registre Courier fictifs
          |       org/territoire/issuer/subject ; fail-closed
          |
          +-- ticket one-use lié à backend PID / start / session_user
          |
          +-- 009 journal comptable équilibré, en lecture seule
                  |
                  +-- Merchant A : 1 840 centimes SYNTHÉTIQUES held
                  +-- Merchant B : zéro
                  +-- Courier A et B : zéro (non assignés)
                  +-- withdrawableMinor=0 / payoutEnabled=false
```

**Différence essentielle F4F → F4G :** les JWT ne proviennent plus d'une simple paire RSA générée dans le test, mais sont signés par le **logiciel Keycloak 26.4.7 réellement exécuté** dans le runner sans réseau extérieur. Le véritable vérificateur de l'API télécharge le JWKS local, puis une introspection locale Keycloak invalide le token dès le logout. La table SQL 011 traite la révocation de session indépendante sur identifiant haché ; les contrats, KYB, territoires et coursiers restent issus de fixtures.

Le test d'identification utilise provisoirement `password grant` seulement dans ce realm QA ; l'authentification mobile PKCE, la sécurité de l'attestor séparé physiquement et l'implémentation des registres juridiques durables sur **vrai** Keycloak/PG ne sont pas certifiées. Les rôles historiques Merchant/Courier/Dispatch de mutation restent bloqués après migration 010. La preuve QA ne constitue **aucun droit de paiement effectif**, aucun Stripe TEST officiel et aucun vrai virement.

**Architecture réelle cible (toujours non activée) :** Keycloak officiel + vérification et révocation live → autorité contractuelle Merchant KYB / registre Courier commités → service attestateur indépendant sur identité juridique et pays → PG ledger global multi-entités/devise/PSP avec ligne immuable et contrôle de solde → settlement/payout autorisé séparément → UI Premium avec solde daté, commissions et retenues. G0–G7 avant fusion, production, EAS et Stores.

**Référence :** [passation F4G](./DA_PASSATION_F4G_KEYCLOAK_PG_WALLET_QA_2026-10-13.md). En dehors du conteneur : Toshiba et VPS absolument inchangés, finances réelles zéro.

---

## F4H — Architecture épinglée de l'autorité financière Merchant/Courier (13 octobre 2026)

Validation code QA e603966d80a96afd6e9526730f9cb2e40dfcba08 : [Keycloak 26.4.7 + PostgreSQL 17, CI #38331022065 SUCCESS](https://github.com/adminluxe/DelishAfrica/actions/runs/38331022065) ; [API + 3 apps, CI #38331022061 SUCCESS](https://github.com/adminluxe/DelishAfrica/actions/runs/38331022061). [PR #40 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/40), empilée sur #39 F4G.

~~~text
REAL SOFTWARE / SYNTHETIC USERS : Keycloak 26.4.7, Docker --network none
  4 sujets partenaires QA, JWT RS256, JWKS HTTPS et introspection
                   |
   F4F verified signed JWT : issuer, subject, role, audience, azp, exp
                   |
   F4G session_011 PostgreSQL17 : hash issuer/sub/sid/jti, révocation
                   |
   F4H finance registry reader_012 : SELECT seulement
      +-- Merchant existing source tables:
      |   da_identity_subjects (issuer, subject, active merchant)
      |   da_merchant_memberships (role finance, contrat actif, KYB validé)
      |   da_catalog_partners (published, partner_id et slug)
      |   da_qa_finance_partner_entities_012 (org + territoire)
      |   da_qa_finance_legal_entities_012 (statut et KYB fictifs)
      +-- Courier NEW QA independent source:
          da_identity_subjects (issuer, subject, active courier)
          da_qa_finance_courier_roster_012 (KYC, accord, org, territoire)
          da_qa_finance_legal_entities_012 (statut et KYB fictifs)
                   |
    F4E attestor scope 010 : role indépendant, contexte PostgreSQL
                   | 
    Compare issuer/sub/organization/territory with ledger scope 010
                   |
    One-use backend-bound read ticket; no direct foreign wallet reads
                   |
    Balanced immutable synthetic ledger 009
                   |
       withdrawableMinor=0 / payoutEnabled=false
~~~

Le nouveau compte SQL da_qa_finance_registry_reader_012 est un login réservé à la **lecture**, propriétaire des tables sans login et non superuser. Ni Merchant, ni Courier, ni attestor historique ne peuvent SELECT les nouveaux registres. Les requêtes sont paramétrées seulement avec issuer+subject issus du JWT vérifié et leur source SQL métier. Une appartenance à deux portefeuilles financiers provoque un refus (pas de sélection arbitraire). Contrat suspendu, identité Courier révoquée, KYB expiré, partenaire dépublié, roster suspendu ou organisation/territoire divergents provoquent un refus.

**Précision non négociable :** le schéma Merchant est le **vrai schéma du code** de l'API, mais ses données Merchant, les pièces juridiques QA, tous les enregistrements Courier, la session 011 et le ledger restent **fictifs et éphémères**. Keycloak binaire réel ne signifie pas compte Keycloak de production. Ceci ne certifie aucune preuve de KYB/KYC légale ni onboarding Courier officiel, aucune gestion multi-juridictions, aucun paiement ni reversement effectif. Pas de connexion au domaine Keycloak public ou au VPS, pas de migration de production, pas de Store, pas de Stripe TEST officiel ni LIVE, pas de merge.

Prochains travaux P0 : service attestor réellement indépendant, véritables preuves d'identité et de contrat en QA autorisée, registry Courier officiel avec audit, séparation multi-organisation; requalification des mutations Merchant/Dispatch/Courier, puis règlement international/PSP TEST/G0–G7. [Passation F4H](./DA_PASSATION_F4H_FINANCE_AUTHORITY_QA_2026-10-13.md). Vérifier les trois CI sur le SHA final documentaire avant de déclarer la PR entièrement certifiée.

---

## F4I — Architecture épinglée de séparation du service financier (13/10/2026)

**Branche :** `feat/f4i-isolated-finance-attestor-qa-20261013`, [PR #41 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/41), sur F4H #40 DRAFT et les précédentes QA. **Certification sur code** `e7c58aee812b555030e2c06c987e3d8e716a4785` : [Keycloak + SCRAM + socket QA #38353167968 SUCCESS](https://github.com/adminluxe/DelishAfrica/actions/runs/38353167968), [API + 3 apps #38353167959 SUCCESS](https://github.com/adminluxe/DelishAfrica/actions/runs/38353167959), [PostgreSQL finance historique #38353167869 SUCCESS](https://github.com/adminluxe/DelishAfrica/actions/runs/38353167869). La preuve de SHA documentaire final sera vérifiée après cette mise à jour.

```text
        Keycloak 26.4.7 RÉEL, conteneur jetable,
        realm et 4 partenaires Merchant/Courier FICTIFS
                       | signé RS256 / JWKS HTTPS localhost
                       v
      +-------------------------------------------+
      | PROCESSUS « APPLICATION » NON PRIVILÉGIÉ   |
      | Docker UID 1000, pas d'admin Keycloak,     |
      | pas de mot de passe SQL attestor/registre  |
      +-------------------------------------------+
                       |
                 Socket Unix protégé
                 (pas de port publié)
                       v
      +-------------------------------------------+
      | PROCESSUS « ATTESTEUR » PRIVÉ F4I           |
      | Docker UID 1001, secrets propres           |
      | Signature RSA + introspection Keycloak    |
      | PG session_011 : SHA256(iss/sub/sid/jti)   |
      | Merchant catalogue + Courier QA roster    |
      | F4E 010 : challenge, ticket lié au backend|
      +-------------------------------------------+
              |             |               |
              v             v               v
     PG17 login_013     registry_reader  Merchant/Courier wallet logins
       attest-only        SELECT-only       fonctions F4E limitées
              \             |              /
                  SCRAM-SHA-256 obligatoire
                 pour TCP dans Docker --network none
                          |
                          v
             Ledger synthétique 009 append-only
                          |
                    withdrawableMinor=0
                       payoutEnabled=false
```

L'ancien rôle PostgreSQL `da_qa_wallet_attestor_010` perd EXECUTE de l'attestation SQL après l'installation additive de `20261013_013_separate_wallet_attestor_qa_only.sql`. Seul `da_qa_wallet_attestor_isolated_013` reçoit ce droit. Les comptes Merchant/Courier ne peuvent pas `SET ROLE` vers le nouveau rôle ni lire les registres financiers privilégiés, et l'application test ne dispose d'aucun secret d'attestation. Les règles `pg_hba.conf` hôte passent de trust (amorceur QA historique) à `scram-sha-256` avant de lancer les tests des processus séparés ; la socket PG de maintenance demeure interne au conteneur PostgreSQL.

**Distinction stricte :** ceci démontre seulement une **séparation QA de processus, de secrets, de logins SQL, de socket et d'identités fictives Keycloak**. Le schéma Merchant interrogé est celui du véritable code, mais les lignes de contrats/KYB, entités et coursiers restent de test. Aucune vérification légale réelle n'a eu lieu. Le service privé actuel possède des secrets SQL de lecture Merchant et Courier : un affinement architectural de privilèges reste obligatoire avant production. La révocation entre la source métier F4H et la consommation du ticket F4E ne possède pas encore de preuve atomique cross-service ; ne pas attribuer à F4I cette garantie.

**Barrières permanentes :** aucun code F4I ajouté aux AppModule et routes publiques, aucun port ni migration VPS, aucun Stripe TEST officiel ou LIVE, aucun payout, aucune fusion, aucun EAS payant, aucune soumission Store. SQL 010 continue de révoquer les anciennes fonctions Merchant/Dispatch/Courier de mutation. G0–G7 et autorisation humaine obligatoires.

**Passation :** [F4I attestateur QA](./DA_PASSATION_F4I_ATTESTOR_ISOLATION_QA_2026-10-13.md).

---

## F4J — Frontière de linéarisation SQL de l'autorisation financière (13 octobre 2026)

**Laboratoire :** [PR #42 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/42), empilée sur [F4I #41](https://github.com/adminluxe/DelishAfrica/pull/41). **Premier code SHA à triple CI SUCCESS :** `1bc1f770f83edb908a3e6b38debcce8246859d7e` — [Keycloak + PG17 F4J #38356090975](https://github.com/adminluxe/DelishAfrica/actions/runs/38356090975), [API + trois apps #38356090898](https://github.com/adminluxe/DelishAfrica/actions/runs/38356090898), [finance PG17 historique #38356091032](https://github.com/adminluxe/DelishAfrica/actions/runs/38356091032). Les commits documentaires doivent être recertifiés à leur propre SHA.

```text
Keycloak 26.4.7 REEL en réseau Docker fermé
  (JWT signés, mais Merchant/Courier 100 % FICTIFS)
                 |
       Verify RS256 / JWKS / aud / azp / role
                 |
       Introspection Keycloak TEST active ?
                 |
           Attesteur F4I privé
        Unix socket + SCRAM SQL
                 |
       Ticket F4E 010, lié au backend
                 |
         Wallet read F4J SQL 014
         SECURITY DEFINER NOLOGIN
                 |
     +-----------+--------------------+
     |           |                    |
     v           v                    v
Ticket 010   Session 011           Identité Merchant/Courier
FOR SHARE    FOR SHARE             FOR UPDATE (clé identité)
     |           |                    |
     |           |                    +--> Merchant 5 tables F4H
     |           |                    |    memberships + partner
     |           |                    |    entité légale + KYB/territoire
     |           |                    |    FOR SHARE
     |           |                    +--> Courier registre 012
     |           |                         + entité légale/KYC/contrat
     |           |                         FOR SHARE
     +-----------+--------------------+
                 |
     SAME PostgreSQL TRANSACTION
                 |
       F4E read_attested_010
       (EXECUTE app direct RÉVOQUÉ)
       - vérifie session backend/slug/issuer
       - consomme ticket unique
       - projette ledger 009 synthétique
                 |
       withdrawableMinor=0
         payoutEnabled=false
```

La fonction `da_qa_wallet_read_linearized_014(uuid,integer,text)` est le **nouvel unique point d'entrée de lecture du wallet pour les rôles QA Merchant/Courier**. Elle verrouille session, identité, membership/partenaire/entité ou roster au moment de la consommation du ticket. Le service privé F4I active cette fonction avec `QA_F4J_ATOMIC_SQL=YES`; l'application mobile ne choisit jamais de sujet, slug ni hash de session. Le propriétaire `da_qa_wallet_linear_owner_014` est `NOLOGIN NOSUPERUSER`, avec SELECT et permissions de row-lock sur clés identifiantes seulement, aucune permission de modifier contrat, KYB, état du registre ou montant.

**Ordres adversariaux validés :** si une mise à jour de contrat Merchant ou roster Courier verrouille la ligne et valide avant la lecture, celle-ci attend puis refuse ; si la lecture a acquis les verrous avant la modification d'un KYB ou d'une session 011, l'UPDATE concurrent attend le COMMIT. Ces ordres ont été observés en consultant `pg_stat_activity.wait_event_type = 'Lock'`, et non inférés par simples temporisations.

**Ne pas confondre les domaines atomiques :** la preuve vaut **uniquement pour les tables et mutations PostgreSQL couvertes par les verrous**, pas pour un logout Keycloak externe survenant simultanément, ni pour un changement de KYB dans un service distant non répliqué et sans protocole transactionnel. Les comptes Keycloak, le catalogue Merchant, le registre Courier 012 et le ledger restent peuplés de **données fictives de QA**. Les anciennes fonctions Merchant/Dispatch/Courier d'écriture 007 restent révoquées après 010.

Aucun Stripe TEST officiel ou LIVE, compte bancaire, payout, migration VPS, fusion, build EAS, publication Store ou G0–G7 n'est autorisé par F4J. **Passation :** [DA_PASSATION_F4J_WALLET_REVOCATION_LINEARIZATION_QA_2026-10-13.md](./DA_PASSATION_F4J_WALLET_REVOCATION_LINEARIZATION_QA_2026-10-13.md). Prochaine architecture F4K : mutations signées et sérialisées sous le même cadre d'autorisations, puis politiques internationales et PSP TEST officiels sous validation.

---

## F4K — Architecture épinglée : mutations Merchant/Courier signées (13/10/2026)

**Périmètre :** [PR #43 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/43), branche feat/f4k-attested-merchant-courier-ops-qa-20261013 sur F4J #42. Code SHA c2e67a7e17d6ed65ea30964610c521f307f560b3, triple QA SUCCESS : [F4K Keycloak/PG17 #38362829428](https://github.com/adminluxe/DelishAfrica/actions/runs/38362829428), [API + trois apps #38362829434](https://github.com/adminluxe/DelishAfrica/actions/runs/38362829434), [finance PostgreSQL historique #38362829468](https://github.com/adminluxe/DelishAfrica/actions/runs/38362829468). SHA documentaire final à recertifier après ces ajouts.

~~~text
Keycloak 26.4.7 RÉEL, comptes Merchant/Courier QA FICTIFS
                       |
         JWT signé RS256 / JWKS / aud / azp
                       |
           APP QA non privilégiée UID 1000
                 sans secret attesteur
                       |
          Unix socket local et protégé
                       |
      Processus F4K privé mutation-only UID 1001
        introspection Keycloak et contrat/KYB
        session révoquable 011, registres 012
        SQL SCRAM, prévalidation F4J 014
                       |
        Challenge backend F4E 010 / ticket neuf
                       |
          SQL 015 SECURITY DEFINER NOLOGIN
                 même transaction
           +-----------+------------+
           |                        |
     F4J row locks             007 ordre FOR UPDATE
     session/identité          capture prouvée,
     membership/KYB           hold/refund 008,
     entité/territoire        séquence Merchant/Courier
           |                        |
           +-----------+------------+
                       |
         Reçu immutable 015 / opération
         idempotence par order+role+stage
                       |
      009 journal comptable et projections
         Pending / Available / Held
         withdrawableMinor=0
         payoutEnabled=false

DISPATCH : AUCUN DROIT APPLICATIF F4K
Fixture : superuser éphémère dans PG QA pour deux offres
~~~

Le propriétaire SQL da_qa_fulfillment_writer_015 est NOLOGIN/NOSUPERUSER et ne possède que les droits strictement nécessaires à la preuve 014, aux transitions Merchant/Courier 007 et aux reçus immuables 015. Les fonctions historiques 007 restent inaccessible aux logins d'app. Le Dispatch reçoit **zéro GRANT** via 015. L'identité et le territoire ne peuvent pas être choisis dans la charge mobile ; seuls le JWT valide, le ticket indépendant et les registres SQL autorisent la transition.

**Pulses financiers démontrés :** deux commandes nouvelles artificielles de 26,90 €, gain Merchant de 18,40 € et commission de menu fictive 4,60 € par commande, réserve Courier de 3,90 €. La capture donne un gain en attente ; la commande prête le rend disponible côté Merchant ; l'offre attribuée crée le gain Courier en attente ; la livraison le rend disponible ; le remboursement le place en retenue. Six snapshots F4K (captured, merchant_ready, offered, courier_progress, refund_held, revoked) vérifient les montants exacts ; trois allocations forment 12 postings équilibrés à zéro. Les 8 reçus opérationnels sont append-only. Toutes ces valeurs, y compris 20 % de commission, sont SYNTHÉTIQUES et non contractuelles.

**Ce qui reste NO-GO :** vrai realm/PKCE, KYB/KYC et contrats juridiquement vérifiés, registre Courier officiel, authentification machine Dispatch/annulation, sources d'autorité distribuées, choix PSP/pays/devise/taxation, Stripe TEST officiel, Stripe LIVE, banques, settlement et payouts. Les apps Expo réelles ne sont pas branchées sur 015 ; aucune migration VPS, fusion PR, EAS payant ou Store. Le logout Keycloak externe n'est pas atomique avec la transaction PostgreSQL et cette preuve ne prétend pas le contraire.

**Étape F4L cible :** attestation de l'identité machine Dispatch, délégation minimale d'affectation, concurrence affectation/remboursement/livraison, identité Courier revocable, puis vrais contrats KYB/KYC et conditions internationales. Suivi : [Passation F4K](./DA_PASSATION_F4K_ATTESTED_MERCHANT_COURIER_OPERATIONS_QA_2026-10-13.md) et [roadbook financier](./DA_STRIPE_TEST_RECONCILIATION_QA_2026-10-12.md).

---

## PIN complémentaire F4L — Machine Dispatch sous autorité indépendante (13 octobre 2026)

> **Portée : laboratoire QA éphémère UNIQUEMENT.** Cette vue **ne décrit pas** les services exécutés sur le VPS ni des apps Expo déjà branchées. Les données et les contrats/roster/KYC/KYB sont totalement synthétiques. L'ancien bloc F4K ci-dessus reste la provenance historique ; son « Dispatch fixture-only » reste vrai pour **F4K**, tandis que **F4L** possède désormais sa propre preuve machine simulant de vraies affectations.

### Graphe d'identité et séparation machine / personnes

```mermaid
flowchart TD
    K["Keycloak 26.4.7 réel — realm QA isolé"] -->|"client_credentials, RS256 JWT"| M["Service machine QA<br/>audience dédiée, scope da.dispatch.assign"]
    H["Merchant/Courier mobiles<br/>JWT humain, identités test"] -.->|"Interdit : 007 / 016"| DENY["Refus SQL / HTTP"]
    M -->|"challenge du backend SQL propre"| C["PG17 begin_016<br/>login Dispatch machine"]
    M -->|"Bearer + demande, pas de secret introspection"| A["Attesteur séparé UID 1002<br/>socket Unix 0660, sans port"]
    A -->|"TLS, JWKS RS256, issuer, aud, azp, scope, rôle"| K
    A -->|"introspection active"| K
    A -->|"ticket éphémère / SQL attest_016"| T["Registre machine 016<br/>login attesteur SCRAM distinct"]
    T -->|"ticket unique lié PID/démarrage"| S["SQL assign_attested_016<br/>owner NOLOGIN"]
    C -->|"consomme ticket sur ce même backend"| S
    S -->|"ordre FOR UPDATE, hold 008"| F["Preuve capture / refund / dispute 004–008"]
    S -->|"FOR SHARE/UPDATE, même transaction"| R["Partenaire actif, entité/territoire<br/>identité et roster Courier actifs 012"]
    S -->|"propriétaire SQL dédié uniquement"| L["Ancien port SQL 007<br/>offer assign"]
    L --> O["Une offre immuable / commande<br/>Reçu append-only 016"]
    O -.->|"Jamais déclenché par Dispatch"| P["picked_up / delivered"]
```

**Règle d'or :** signature Keycloak seule ne suffit **jamais** à affecter. Le service doit également être actif dans le registre SQL local de délégation, porter le bon `org/territory`, obtenir une attestation indépendante puis consommer son ticket unique sur **sa propre connexion**. La base protège la commande, le contrat/l'identité du Courier, l'entité légale et l'état remboursé dans la même transaction.

### Propriété, ACL et frontières

| Autorité | Capacité minimale QA | Interdiction explicite |
|---|---|---|
| Keycloak confidentiel `da-f4l-dispatch-machine-qa` | `client_credentials`, scope `da.dispatch.assign`, rôle `da_dispatch_assign`, audience `delishafrica-dispatch-authority` | Aucune authentification d'utilisateur Mobile, aucun mot de passe humain, pas d'accès au realm de production |
| `da_qa_dispatch_machine_016` | Demander son challenge et consommer son ticket avec `assign_attested_016` | Ni DML direct, ni 007 direct, ni création de tickets, ni lecture des reçus protégés |
| `da_qa_dispatch_attestor_016` | Appeler seulement `attest_016` après validation cryptographique/introspection de Keycloak | N'exécute pas l'affectation, ne possède pas la clé confidentielle du service |
| `da_qa_dispatch_owner_016` | Fonction SQL `SECURITY DEFINER`, verrouiller les lignes, exécuter 007 après tous les contrôles | Rôle **NOLOGIN**, non-superuser ; n'accueille jamais un JWT ou secret applicatif |
| `da_qa_merchant_commerce_app` / `da_qa_courier_commerce_app` | Continuent les transactions attestées F4K selon leurs autorisations | **Aucun GRANT** de Dispatch 007, tickets/états 016 ni `SET ROLE` Dispatch |
| Initialiseur PG temporaire GitHub Actions | Installer fixtures, mots de passe SCRAM et registry QA puis disparaître | Pas de réutilisation runtime, pas de permission transposable en production |

**Anti-TOCTOU (time-of-check/time-of-use) :** ordre de verrouillage machine 016 : ticket et liaison backend, **order `FOR UPDATE` avant vérification de capture/refund**, registre machine verrouillé, partenaire/organisation/territoire verrouillés, identité et roster Courier verrouillés, offre verrouillée, 007 appelé puis reçu unique 016 enregistré et ticket consommé. La transaction sérialise l'affectation avec le refund 008 via la même ligne order, sans possibilité d'écrire `picked_up` ou `delivered` côté Dispatch.

### Matrice d'isolation et invariants

- **Authentification machine :** vrai Keycloak QA éphémère et JWT signé RS256, découverte/JWKS via TLS, contrôle `aud/azp/iss/role/scope/iat/exp/jti` et introspection active.
- **Droits SQL :** tests de `SET ROLE` et de mutation 007/016 par Merchant/Courier refusés. Aucun retour aux anciens GRANT 007.
- **Idempotence/concurrence :** sept affectations simultanées ⇒ **une insertion, six replays**, une seule ligne par `order_id`. Réaffectation non autorisée (y compris un autre coursier actif de la même organisation), ticket déjà utilisé, ticket expiré après attente sur verrou et course déjà récupérée refusés.
- **Contrats et juridictions :** Courier révoqué et Courier ayant changé d'organisation/territoire refusés malgré ses anciens identifiants ; identité machine révoquée dans PG également refusée.
- **Finance :** demande refusée sur ordre non prêt ou sous hold. **Deux ordres de concurrence sont observés en PostgreSQL 17 :** (1) refund détient le verrou, Dispatch attend puis refuse ; (2) Dispatch détient le verrou, refund attend, puis le Courier attesté F4K ne peut accepter l'offre après le hold. La date d'expiration du ticket est relue après l'attente sous verrou. Captures et postes comptables fictifs.
- **Comptabilité :** **16 allocations (dont les 3 initiales F4K), 64 postings, somme 0** ; **6 reçus Dispatch immuables F4L**, **8 reçus opérationnels de la baseline F4K**, **35 événements opérationnels attestés cumulés F4K+F4L**. `withdrawableMinor=0` et `payoutEnabled=false` en toutes circonstances.
- **Aucune app reliée à SQL 016**, aucune opération Stripe TEST officielle, aucun paiement réel, aucune transaction banque, aucun VPS modifié, aucun Store/EAS, aucune PR fusionnée.

**Renforcement complémentaire validé :** SHA `18b1e5a327700bcc9762a98a586e4ba4ea18c7c4` avec trois CI SUCCESS ([F4L double sens du verrou #38369963924](https://github.com/adminluxe/DelishAfrica/actions/runs/38369963924), [API + apps #38369963883](https://github.com/adminluxe/DelishAfrica/actions/runs/38369963883), [PG17 historique #38369963941](https://github.com/adminluxe/DelishAfrica/actions/runs/38369963941)). Après cette étape, la vérification de la politique SQL 015 prouve **35 reçus opérationnels au total**, et la finance garantit explicitement que tout portefeuille Merchant reste non retirable avec payouts désactivés. Aucune permission applicative 007 n'est rouverte.

### Preuves et autorité de version

- [PR #43 F4K DRAFT](https://github.com/adminluxe/DelishAfrica/pull/43), SHA parental `f9f4af32692bbc2820a1987ea5d2f85ba764a71e`, trois CI SUCCESS.
- [PR #44 F4L DRAFT](https://github.com/adminluxe/DelishAfrica/pull/44), branche `feat/f4l-oidc-machine-dispatch-assign-qa-20261013` **basée sur F4K**, pas sur main.
- **SHA de code QA F4L** `eb077d8c5e176b74f0dbae62386319be1a4a442d` : [Keycloak + PG17 + Dispatch #38368706755](https://github.com/adminluxe/DelishAfrica/actions/runs/38368706755), [API + 3 apps #38368706742](https://github.com/adminluxe/DelishAfrica/actions/runs/38368706742), [PG17 finance historique #38368706881](https://github.com/adminluxe/DelishAfrica/actions/runs/38368706881), tous SUCCESS et même SHA.
- **SHA documentaire final :** doit être attesté **après ce commit documentaire** par trois nouvelles CI SUCCESS et leur preuve dans la PR #44, pour éviter un hash auto-référent.
- [Passation F4L officielle](./DA_PASSATION_F4L_MACHINE_DISPATCH_QA_2026-10-13.md) | [Roadbook financier](./DA_STRIPE_TEST_RECONCILIATION_QA_2026-10-12.md).

### Frontières G0–G7 restant NO-GO

La certification F4L est **technique QA**, pas un feu vert d'exploitation : absence de partenaires/KYB/KYC/rosters légalement vérifiés, absence de couplage des apps Expo réelles, révocation Keycloak↔PostgreSQL non atomique, anciennes fonctions 007 superuser-definer en environnement de test, absence de sécurité réseau de production (mTLS possible ultérieurement), politique globale pays/devise/fiscalité, chargeback réel, intégration réelle PSP/banque, règlement et distribution. Une mutation SQL 016 ne doit **jamais** être appliquée directement au VPS. Production, paiements, fusion PR, build payant et publication requièrent une validation expresse et un nouveau passport.

**PIN : F4L-MACHINE-OIDC-ATTESTED-DISPATCH-QA-ONLY / PG17-ATOMIC-ORDER-LOCK / NO-MOBILE-DISPATCH / ZERO-PAYOUT / NO-PRODUCTION / DRAFT.**

---

## PIN F4M — Propriétaires `SECURITY DEFINER` métiers non privilégiés (13 octobre 2026)

**Périmètre : QA GitHub Actions déconnectée seulement.** Le runtime `/opt/delishafrica/monorepo/apps/{client,merchant,courier}`, la base persistante et le Toshiba historique ne sont pas modifiés. Le bloc F4L précédent reste valide sur [son SHA certifié](https://github.com/adminluxe/DelishAfrica/commit/27faa871e3f18df0f3ca2e254de484352b8d93c9). Cette nouvelle couche de propriétaires est candidate dans [PR #45 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/45), branche `feat/f4m-nonsuperuser-operational-sql-qa-20261013`.

### Défaut traité : propriétaire SQL excessif derrière l'attestation

F4K contrôle correctement l'identité Merchant/Courier et F4L contrôle correctement l'identité de service Dispatch, mais la fonction 007 historique appelée par ces wrappers était encore `SECURITY DEFINER` sous le propriétaire privilégié de création initiale. L'éligibilité financière 004, durcie par l'extension canonique 006, était dans le même cas. F4M change **leur identité SQL effective**, pas les règles de capture ou de livraison.

```mermaid
flowchart TD
    KC["Keycloak réel / identités synthétiques"] -->|"JWT signé / périmètre vérifié"| G["Wrappers attestés F4K-015 et Dispatch F4L-016"]
    G -->|"ports 007, permissions NOLOGIN seulement"| W["Owner F4M 017 NOLOGIN / NOSUPERUSER<br/>Merchant accepted-ready / Dispatch offer / Courier transition"]
    G -->|"lectures restreintes"| R["Owner projection opérationnelle<br/>NOLOGIN / SELECT-only"]
    W -->|"port finance EXECUTE"| F["Owner contrôle financier NOLOGIN / SELECT-only<br/>commande + snapshot 006 + capture + hold"]
    R -->|"port finance EXECUTE"| F
    W -->|"INSERT / UPDATE par colonne"| S["État Merchant + offre Courier<br/>verrous 007-008"]
    F --> C["Vérification snapshot canonique, capture,<br/>refund / dispute, sans mutation financière"]
    H["Applications Merchant / Courier / Client"] -.->|"SQL 007 interdit, SET ROLE interdit"| X["Refus sans effet"]
```

### Tableau des propriétaires et garanties

| Autorité F4M | SQL dont elle est propriétaire | Autorité DB maximale accordée |
|---|---|---|
| `da_qa_f4m_finance_gate_owner_017` | `da_qa_commerce_order_dispatch_eligible(uuid)` | `SELECT` commandes, snapshot canonique, autorité de paiement, reçu financier et retenue ; **jamais INSERT/UPDATE/DELETE financier** |
| `da_qa_f4m_ops_reader_owner_017` | `da_qa_merchant_visible_paid_orders` ; `da_qa_courier_assigned_offers` | `SELECT` projections des commandes et offres ; aucun `UPDATE` |
| `da_qa_f4m_ops_writer_owner_017` | `da_qa_merchant_transition` ; `da_qa_dispatch_assign_offer` ; `da_qa_courier_transition` | `SELECT` commandes/états/offres ; `INSERT` et `UPDATE` strictement limités aux colonnes métier nécessaires et à la clé verrouillée |
| Wrappers `015/016` | Restent sous leurs propriétaires attestés antérieurs | Appels aux fonctions 007 autorisés seulement entre propriétaires `NOLOGIN`, jamais via un GRANT 007 direct aux appareils |

**Invariants structurels contrôlés :** les trois nouveaux propriétaires sont `NOLOGIN`, `NOSUPERUSER`, `NOINHERIT`, `NOBYPASSRLS`, `NOCREATEROLE`. Aucun rôle Merchant/Courier/Dispatch n'en est membre. Les six fonctions conservent leur `SECURITY DEFINER`, mais avec `search_path=pg_catalog,public,pg_temp` pour éviter qu'un schéma temporaire soit recherché avant les objets de confiance.

**Ordre de migration QA :** 001–015 historiques → **017** (retirer privilèges effectifs avant la suite) → replay intégral F4K identités Keycloak et mutations → **016** identité machine Dispatch F4L → replay F4L et concurrence financière. L'ordre 017 avant 016 est intentionnel ; 016 fournit ensuite l'unique port Dispatch à son propre propriétaire `NOLOGIN`.

**Audit F4M :** `services/api-nest/test/f4m-nonsuperuser-operational-owners.pg-qa.sql` teste les 6 propriétaires, permissions, membership, verrouillage des accès 007 et absence d'écriture financière croisée. Le workflow `.github/workflows/f4m-nonsuperuser-operational-qa.yml` refait les tests F4K/F4L déjà certifiés avec SQL 017 ; les régressions API+3 apps et finance historique sont indépendantes. Aucune preuve ne vaut certification sans les trois CI SUCCESS sur le SHA final de la PR #45.

**Résultats à préserver, sans les présumer avant les CI :** 16 allocations synthétiques, 64 écritures financières équilibrées de somme zéro, 35 événements opérationnels F4K+F4L, 6 reçus Dispatch immuables, revenu non retirable et `payoutEnabled=false`. Les tests refusent les retraits, les affectations illégitimes, les rejouements de ticket, les erreurs de territoire et les opérations post-refund.

**Gates NO-GO :** fonctions financières/ledger non encore intégralement déprivilégiées, registres/KYB/KYC fictifs, autorisation mTLS et sécurité réseau de production non certifiées, identité opérateur, taxes/devise et politiques pays inconnues, client Expo non raccordé, logout Keycloak externe non atomique avec SQL. Aucun Stripe TEST officiel ou LIVE, transaction bancaire, payout, migration VPS, merge, EAS payant ou Store sans approbation explicite.

**PIN : F4M-LEGACY-SECURITY-DEFINER-NOLOGIN / F4K-F4L-REGRESSION-REQUIRED / QA-SYNTHETIC-ONLY / NO-PAYOUT / NO-PROD / PR-DRAFT.**

---

## F4M — Preuve de l'autorité SQL 017 sans superuser (code QA)

**Premier code F4M vérifié :** SHA `df8fe169a67972430fe4d6f43aedde3e08a5f27b`, trois CI SUCCESS sur exactement ce SHA : [Keycloak+PG17 #38388822255](https://github.com/adminluxe/DelishAfrica/actions/runs/38388822255), [API+3 apps #38388822324](https://github.com/adminluxe/DelishAfrica/actions/runs/38388822324), [finance historique #38388822365](https://github.com/adminluxe/DelishAfrica/actions/runs/38388822365). Le SHA du document final sera signé en [PR #45 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/45) après revalidation.

**Observation réelle déterminante :** l'autorité financière 004 était redéfinie par la migration 006 et demandait un SELECT du **snapshot canonique**. Le nouveau propriétaire NOLOGIN l'a refusé lors du premier test F4K. L'unique ajustement a été `GRANT SELECT ON public.da_client_commerce_order_snapshot_qa` à `da_qa_f4m_finance_gate_owner_017`. Une sonde SQL de fonction, `SET LOCAL ROLE`, transaction `ROLLBACK`, a isolé la permission manquante, puis le laboratoire avec JWT signés F4K/F4L a validé les opérations sous les droits corrigés. **Aucune élévation de pouvoir ou de privilège DML financier n'a été accordée.**

**Contrats validés :** six `SECURITY DEFINER` désormais possédés par trois propriétaires dédiés NOLOGIN/NOSUPERUSER/NOBYPASSRLS ; schema `pg_temp` en dernier ; pas de membership des apps ; aucun droit SQL 007 mobile, aucun DML croisé ; les points d'entrée strictement attestés 015/016 conservés. F4K et F4L rejoués intégralement sur vrai PG17/Keycloak éphémères, 6 reçus Dispatch et 35 reçus opérationnels, 16 allocations/64 postings équilibrés, pas de retrait, pas de payout.

**Cette preuve reste intégralement QA :** ne pas installer 017 sur une base persistante ni sur VPS sans revue complète et autorisation expresse. Les sujets/organisations, les moyens de paiement, les contrats, le roster et les fonds sont fictifs ; Stripe officiel, KYB/KYC réel, flux mobile, mTLS production et politique fiscale pays restent NO-GO.
