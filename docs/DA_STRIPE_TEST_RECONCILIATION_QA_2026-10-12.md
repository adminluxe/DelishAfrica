# DelishAfrica® — reprise financière après le webhook PostgreSQL (12 octobre 2026)

## Autorité et état vérifié
- Dépôt : `adminluxe/DelishAfrica`.
- PR d'origine : [#35 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/35), branche `feat/client-enrollment-secure-20261011`.
- Preuve webhook : commit `640df62bc9ed6bdfbf3de593b08e99b6faae72b4`, quatre CI SUCCESS sur ce SHA, document `DA_STRIPE_WEBHOOK_INBOX_PG_QA_2026-10-12.md`.
- Nouveau chantier : branche dérivée `feat/stripe-test-reconcile-pg-qa-20261012`, issue de `d15225151ac01b22ff29161c82ff2e2d9dd4d7f4`. Cela **n'altère pas** la PR #35 ni sa base.
- Source de vérité runtime précédente : `/opt/delishafrica/monorepo`, apps `client`, `merchant`, `courier`, API NestJS. **Aucun patch sur ce runtime**.
- Vérification le 12 octobre : `GET https://api.delishafrica.me/api/v1/health` HTTP 200 depuis le Toshiba ; **SSH VPS : port 22 « Connection refused »**. Le public HTTP sain n'est pas une preuve de disponibilité SSH ou de possibilité de déploiement.
- Le readbook d'activation Client signale des modifications non commitées sur le monorepo VPS : **interdiction de reset / checkout forcé / overwrite**.

## La frontière financière
Un reçu `Stripe-Signature` HMAC sur rawBody permet seulement d'attester la réception d'un événement. Même `payment_intent.succeeded` signé ne suffit pas à déclencher une livraison, un paiement marchand ou un état `paid`. Il faut une lecture indépendante Stripe TEST par un rôle serveur finance isolé : compte attendu, PaymentIntent lié au bon orderId/quote/Client, statut succeeded, charge correspondante, montant et devise exacte, capture totale, absence de refund et de dispute.

## Candidat QA créé — pas déployé
1. `services/api-nest/migrations/client-commerce/20261012_004_stripe_test_financial_reconciliation_qa_only.sql` :
   - nouveaux rôles QA dédiés à l'enregistrement de PaymentIntent et à la réconciliation ; rôle app/webhook toujours sans DML direct ;
   - lien PaymentIntent dans la réservation existante sans passage `paid` ;
   - port SQL de lecture d'autorité, scan de reprise, finalisation atomique d'un encaissement vérifié ;
   - reçu financier append-only, unicité par autorité/PaymentIntent/charge, effets idempotents ;
   - observations tardives de remboursement/litige append-only et exclusion de la délivrance commerciale ;
   - fonctions SQL `SECURITY DEFINER` et propriétaire superuser **uniquement dans le conteneur éphémère CI déconnecté**. Ne pas migrer telles quelles dans un vrai cluster. Revue ACL et fonctions sous propriétaire dédié NOLOGIN non-superuser impérative.
2. `services/api-nest/src/client-commerce/stripe-test-financial-reconcile.pg-qa.adapter.ts` :
   - exige `sk_test_` côté serveur, ID `acct_` attendu et clé HMAC de constat ; refuse toute configuration sans garde explicite ;
   - lit **seulement** `GET /v1/account` et `GET /v1/payment_intents/{id}?expand[]=latest_charge` sur `https://api.stripe.com` ;
   - n'appelle **jamais** Create, Confirm, Capture ou Refund ; contrôle toutes les liaisons DB ↔ Stripe avant d'appeler le port SQL financier ;
   - teste la frontière TEST/LIVE, les identités, métadonnées, devis, montant, devise, capture, charge, refund et dispute ;
   - `reconcileBatch()` peut reprendre les PaymentIntent déjà liés après une panne SQL / un webhook manqué, sans créer de nouvelle intention.
3. `services/api-nest/test/stripe-test-financial-reconciliation.pg-qa.integration.cjs` :
   - PostgreSQL 17 réel, deux pools finance et huit rapprochements concurrents pour une seule transition atomique ;
   - interdit l'écriture directe depuis Client/webhook, certifie l'idempotence et la mise en retenue de livraisons après remboursement ;
   - intercepte toutes les réponses Stripe en mémoire dans un conteneur Docker sans réseau extérieur et sans ports publiés. **Aucun appel fournisseur réel pendant la CI**.
4. `.github/workflows/native-client-commerce-authority-postgres-qa.yml` : compilation/chargement et test ajoutés après les trois migrations QA préexistantes, exécution sous `--network none`.

## Interdictions et limites — NO-GO confirmé
- **Pas de Stripe TEST officiel réellement contacté par ce code à ce stade.** Le test automatique ne contacte jamais le compte Stripe et ne justifie pas l'activation de paiements réels.
- **L'adaptateur de création Stripe TEST est implémenté en QA, mais aucune route commerciale publique ne le charge.** Les anciennes routes `orders/create`, `payments/create-intent` et `/stripe/webhook` restent sur leur ancien chemin ; ne pas présenter les nouveaux adaptateurs comme actifs.
- Le code ne prouve pas encore les réponses réelles aux events refund/dispute, les transferts vers comptes Connect, les frais, soldes/payouts/settlement, ni les parcours iOS/Android.
- Les identifiants de retenue `re_` / `dp_` du laboratoire sont des **marqueurs HMAC locaux**, pas des identifiants de refund/dispute attestés du fournisseur ; la migration finale devra modéliser explicitement les objets Stripe officiels.
- La persistance d'une intention créée chez Stripe mais non enregistrée en DB exige un parcours de récupération spécifique : reprise Stripe avec **la même clé d'idempotence**, implémentée en QA ; arrêt fail-closed dès 18 h en cas d'absence de PI durable et revue humaine. L'outillage de revue opérateur n'est pas implémenté. **Ne jamais inventer une nouvelle clé pour réparer.**
- Le rôle PostgreSQL qui peut marquer `paid` constitue une autorité critique : aucune identité mobile, aucun header, aucun body JSON et aucun récepteur webhook simple ne peuvent y accéder.
- Aucun déploiement VPS, aucune migration live, aucun impact Keycloak, Apple, Google, EAS ou Store ; PR DRAFT non fusionnée, aucun Stripe LIVE.

## Palier complémentaire après certification finance — création TEST idempotente

- **Finances :** [GitHub Actions 38293599945](https://github.com/adminluxe/DelishAfrica/actions/runs/38293599945) **SUCCESS** pour le SHA `18832719a91929349d7d0b24e8c629fe25732d8a` (PG17 réel, huit concurrents, refund hold, receiver HMAC).
- **Création Stripe TEST simulée :** [GitHub Actions 38294528567](https://github.com/adminluxe/DelishAfrica/actions/runs/38294528567) **SUCCESS** pour le SHA `21e2e18eee24926dfdc22a3100d46d3fa3ed8b6d` (PG17 réel, Stripe HTTP stub uniquement).
- Nouvel adaptateur `services/api-nest/src/client-commerce/stripe-test-intent-create.pg-qa.adapter.ts` : `reserveOrder` puis `reserveTestPayment` transactionnels, vérification `acct_` de Stripe TEST, création PI sous la clé `da-qa-test-v1-<hmac>` déjà réservée, liaison DB. Aucun paiement effectué; aucune clé réelle.
- Panne SQL après succès fournisseur : même réservation + même clé + même PI ; aucun nouveau `paymentIntentId` et aucun `paid` avant réconciliation finance.
- Fail-closed après 18 h sans PI persisté (la rétention Stripe des idempotency keys peut être purgée après au moins 24 h), compte erroné, devis altéré, sujet différent, mode LIVE, réponse fournisseur divergente.
- Nouvelle fonction PostgreSQL `da_qa_provider_read_reserved_test_intent` utilisable uniquement par le créateur TEST QA ; jamais accessible à un rôle Client mobile.
- **AppModule et routes commerciales inchangées**. Les contrats HTTP certifiés pour vrais clients attendent le chaînage avec le guard Client/JWKS/admission et avec le devis catalogue serveur.
- Architecture épinglable candidat : `docs/DA_ARCHITECTURE_QA_STRIPE_TEST_POSTGRES_PIN_2026-10-12.md`.

**Statut : socle QA création et réconciliation contrôlé en CI, mais aucun accès officiel à Stripe TEST et aucun G0–G7. Il ne faut jamais qualifier le fournisseur réel de certifié.**

## Palier QA supplémentaire — contrat checkout HTTP réel, sans raccordement public

**Exécution synchronisée du 12 octobre 2026**, commit `a2783bdcd569ee577a1aac424f74286057a9498d` : deux CI **SUCCESS** sur le même SHA.

- [GitHub Actions #38296555360](https://github.com/adminluxe/DelishAfrica/actions/runs/38296555360) : compilation TypeScript de l'API **et des trois apps** ; vraie classe `CatalogOrderPolicyService` avec catalogue synthétique ; serveur HTTP NestJS éphémère avec véritable garde RSA/JWT/admission Client, tests 401/403/409/503, aucun appel PSP ni modification production ; préflight Stripe TEST.
- [GitHub Actions #38296555438](https://github.com/adminluxe/DelishAfrica/actions/runs/38296555438) : PostgreSQL 17 réel déconnecté, réservations SQL, créateur PaymentIntent synthétique à clé constante, webhook HMAC, reçu de capture atomique, huit concurrents sur deux pools et retenue remboursement.
- Nouvelle frontière catalogue : `services/api-nest/src/client-commerce/client-commerce-canonical-quote.pg-qa.adapter.ts` extrait **exclusivement** identifiant partenaire + SKU + quantité du JSON mobile. Le vrai service catalogue serveur applique prix publiés, disponibilité, frais, minimum et fingerprint SHA-256 canonique. Les champs `amount`, `total`, `price`, `currency`, `paid`, `clientSubject` ou `metadata` envoyés par le mobile ne constituent jamais une autorité financière. Tests négatifs : articles inconnus ou doublés, quantités incohérentes, marchand contradictoire, catalogue absent et faux devis interne.
- Prototype de route **non chargé dans AppModule**, `services/api-nest/src/client-commerce/native-client-checkout.qa.controller.ts`, chemin éphémère `/qa-isolated/client-commerce/payments/create-intent`. Le garde JWT Client réel doit réussir avant devis ou Stripe ; précondition `DA_QA_ISOLATED_CLIENT_COMMERCE_ENABLED=YES` et `NODE_ENV` différent de `production`. Le test utilise un port PSP strictement fictif, compte les effets et refuse les erreurs renvoyant des secrets. **Aucune route réelle n'est migrée vers cette classe.**
- Le script `ops/stripe/DA_STRIPE_TEST_OFFICIAL_PREFLIGHT_V1.sh` (lancer depuis le Toshiba sur le dépôt QA) fonctionne en `--inventory`, `--offline` ou `--account-readonly`. Lecture du compte externe uniquement après deux variables de garde QA, exclusivement par **GET /v1/account**, sans sortie de clés ni payment mutation. Son inventaire actuel indique les quatre valeurs Stripe TEST **absentes du processus local** ; cela ne signifie pas qu'elles n'existent pas dans le coffre. Les refus sur branche détachée/dirty sont préservés. La CI n'a fait aucune requête Stripe réelle.

### Compatibilité Client à résoudre avant G0–G7

Le Client existant envoie encore `/payments/create-intent` avec montant mobile et `/orders/demo/create` avec une référence locale `DA-...`, ainsi qu'un `cartFingerprint` calculé sur l'app. La nouvelle autorité PostgreSQL produit un UUID d'ordre et un fingerprint serveur : **ces deux contrats ne sont pas encore reliés**. Il faut, dans une branche QA distincte et avec tests de compatibilité, faire accepter et persister les références retournées par la vraie API, préserver le panier après OIDC et supprimer la dépendance au store démo pour la confirmation finale. Ne jamais refaire un PaymentIntent pour réparer cette différence.

**Décision : GO pour implémentation/test de l'adaptateur commercial complet dans le laboratoire ; NO-GO toujours absolu sur Stripe officiel sans environnement et clés TEST autorisés, sur les routes runtime, migration PostgreSQL VPS, Keycloak, Apple/Google Stores, Stripe LIVE et G0–G7.**

## Anti-double intention Client — verrou SecureStore pré-Stripe (candidat QA)

**Correctif QA introduit le 12 octobre 2026, SHA code `43f3ac6db4595de73f0ddf85546831b973c5d638` ; double CI SUCCESS sur le même SHA : [Client/API/3 apps #38300514654](https://github.com/adminluxe/DelishAfrica/actions/runs/38300514654), [PostgreSQL/Stripe synthétique #38300514671](https://github.com/adminluxe/DelishAfrica/actions/runs/38300514671).**

L'audit de `apps/client/app/checkout-preflight.tsx` a révélé un point de rupture important : l'ancienne UI génère `DA-...` et un nouveau `clientMutationId` à chaque essai ; `PENDING_PAYMENT_COMMIT` n'est enregistré qu'après le retour positif de PaymentSheet. Lors d'un crash entre création de PI, présentation bancaire et écriture locale, le redémarrage pourrait perdre le lien de la tentative et fabriquer une nouvelle clé fournisseur. **NO-GO tant qu'un garde-fou d'idempotence et une réconciliation serveur ne sont pas prouvés sur le flux réel**.

Nouveau candidat `apps/client/utils/daCheckoutAttemptFence.ts` : état persistant SecureStore isolé par compte, sauvegardé **avant** tout appel `payments/create-intent`, avec ordre + mutation immuables et empreinte de panier ; phases `reserved → intent_created → sheet_open → reported_success`. Après un redémarrage au stade `reserved`, on récupère **la même** clé ; aux stades bancaire `intent_created` / `sheet_open`, on stoppe en mode conservateur avant tout nouvel appel fournisseur. Corruption/perte d'accès au coffre : refus, aucun paiement. Jamais de `sk_test_`, `client_secret`, adresse personnelle ni panier brut dans l'enregistrement.

Le fichier UI `apps/client/app/checkout-preflight.tsx` appelle ce candidat uniquement sous **double condition** `EXPO_PUBLIC_DA_CHECKOUT_FENCE_QA=YES` et `NODE_ENV !== production`; par défaut, comportement runtime existant inchangé. La suppression du verrou ne s'effectue qu'après relecture de la commande effectivement payée auprès de l'autorité et égalité de son PaymentIntent, y compris si l'app a crashé après PaymentSheet mais avant le callback JS. Les erreurs ambiguës affichent un message neutre « Aucun second débit ne sera lancé ». L'activation ne doit PAS être envisagée dans un binaire Store sans contrôle complet des preuves de paiement et de l'expérience utilisateur.

Suite `apps/client/test/daCheckoutAttemptFence.test.cjs` : sept tests locaux réels Node/TS **PASS** et exécutés en CI **SUCCESS** sur le SHA exact : persistance avant création Stripe, reprise exacte de la mutation, crash après PI, crash en PaymentSheet, cohérence du contrat UI, stockage corrompu/rejeté, restitution après paiement recontrôlé. La CI vérifie également TypeScript API + Client/Merchant/Courier ; caractère désactivé par défaut conservé.

**Limitations :** ce verrou sur appareil ne remplace PAS l'unicité et la transaction PostgreSQL, la vraie route de réconciliation Client ni la preuve Stripe officielle. Le Client utilise toujours les anciennes routes `/payments/create-intent` et `/orders/demo/create` ; aucun client en production n'est migré. Après annulation bancaire ambiguë, seule une réconciliation autoritative peut libérer le verrou, pas un clic « réessayer ». Les cas où aucune intention PI ne peut être relue nécessitent un état serveur `needs_review` et une voie d'assistance.

## Audit lecture seule du VPS — connexion SSH rétablie (12 octobre 2026)

Depuis le Toshiba, connexion `ssh purplecrm-vps` rétablie vers l'hôte `srv1037391`, compte `afripayadmin`. **Aucune écriture et aucun redémarrage** :
- GET `http://127.0.0.1:3010/api/v1/health` → HTTP 200 ; canary `3011` → HTTP 200 ; API publique `https://api.delishafrica.me/api/v1/health` → HTTP 200.
- Conteneurs `delish-api`, `delish-api-routes-canary`, `afritaste-keycloak`, `afritaste-keycloak-postgres` : actifs ; PostgreSQL écoute localement et `pg_isready` accepte la connexion.
- Source de runtime `/opt/delishafrica/monorepo` : branche `innovation/confluence-trust-current-20261001`, HEAD `e504c04` et **15 fichiers suivis modifiés localement** ; aucune synchronisation, reset ou déploiement autorisé tant qu'ils n'ont pas été sauvegardés/réconciliés.
- Disque `/` : 193 Go, 168 Go utilisés, **25 Go libres / 88 %**. Aucun nettoyage destructif réalisé.
- Inspection des seuls **états booléens/préfixes** des variables dans `delish-api` : secret Stripe TEST existant dans l'ancien runtime, secret webhook présent, `DATABASE_URL` présent ; inscription Client non activée, nouveau checkout QA non activé, fournisseur QA officiel non activé ; variables spécifiques `DA_STRIPE_TEST_SECRET_KEY` et `DA_STRIPE_TEST_EXPECTED_ACCOUNT_ID` absentes de l'environnement inspecté. **Aucune valeur/clé/token n'a été affichée, recopiée ou exploitée.**
- Ces identifiants TEST hérités du conteneur runtime ne sont **pas** un coffre ni une permission d'exécuter une transaction depuis le laboratoire. Ne pas exporter, recopier, réutiliser ni redémarrer le conteneur pour ce chantier sans revue dédiée.

**Décision sécurité :** l'accès SSH permet un nouvel audit non destructif, pas de promotion automatique. Base VPS et anciens flux commerciaux restent gelés. Le laboratoire PG17 GitHub reste l'unique autorité des certifications récentes.

## Palier 12 octobre, fin de session — UUID serveur et parcours Client deux phases certifiés en CI

**Le constat de départ :** le checkout Client utilisait encore les références mobiles `DA-...` et un `cartFingerprint` différent de l'empreinte catalogue PostgreSQL. La création d'une intention sur une commande mobile non réservée ne pouvait pas être considérée comme sûre. Le présent correctif définit un contrat QA en deux phases, tout en laissant les vraies routes commerciales **totalement inchangées**.

### Étape A — serveur HTTP NestJS réellement exécuté en test

**Commit de code :** `4d3135d516889e3087b45a63d77ba02dd6d674c0`.

- `services/api-nest/src/client-commerce/native-client-checkout.qa.controller.ts` expose désormais **deux routes strictement isolées** : `POST /qa-isolated/client-commerce/orders/create` (201) et `POST /qa-isolated/client-commerce/payments/create-intent` (200).
- Chaque route requiert le **vrai garde RSA/JWT Client** avec vérification de l'issuer, du rôle et du ledger d'admission SMS/e-mail durable. Le garde coupe les requêtes 401/403/503 avant devis ou réservation.
- Première phase : seul le partenaire et les SKU/quantités alimentent le devis issu du catalogue publié serveur. Le Client ne choisit ni prix, ni statut, ni identifiant `orderId`. L'adaptateur de réservation PostgreSQL retourne un **UUID immuable** ; le contrôleur valide l'identité Client, la mutation et les montants/fingerprints de la réservation.
- Deuxième phase : le Client doit renvoyer **le même UUID** et les **deux empreintes canoniques** du devis, accompagnés de la même `Idempotency-Key` ; un faux UUID local `DA-...`, une mutation différente, un autre total/catalogue ou une empreinte forgée entraînent un refus **avant tout port Stripe**. Le port SQL est de nouveau interrogé par réservation idempotente avant la requête fournisseur.
- Les tests `services/api-nest/test/native-client-checkout-http.qa.test.cjs` démarrent un vrai serveur NestJS éphémère et vérifient les refus, replays, quantité/prix serveur, révocations, le mode production interdit et l'absence de secrets dans les erreurs. Le **port PostgreSQL et Stripe de ces tests HTTP est simulé** ; la vraie logique PG17 et les adaptateurs Stripe sont couverts par la suite CI indépendante, pas par un seul test bout-en-bout connecté.
- Preuves même SHA : [Client/API + TypeScript 3 apps #38307731556](https://github.com/adminluxe/DelishAfrica/actions/runs/38307731556) **SUCCESS** ; [PostgreSQL17/disconnected provider #38307731643](https://github.com/adminluxe/DelishAfrica/actions/runs/38307731643) **SUCCESS**.

### Étape B — préparation côté application Client, jamais importée en production

**Commit de code :** `9dfefa35c751e252d636c988641ed570221120d1`.

- `apps/client/utils/daCanonicalCheckout.qa.ts` : séquence candidate `orders/create → payments/create-intent`, transport HTTP authentifié injecté et routage exclusivement vers les URL QA isolées. Le JSON de l'app ne contient **jamais** un prix, `paid`, une devise imposée ou un PaymentIntent choisi par le téléphone.
- Avant le premier appel réseau, `DaCheckoutAttemptFence.begin()` persiste dans le stockage sécurisé une réservation locale `reserve:<nonce>` + la mutation stable. Le serveur retourne un UUID ; `bindServerOrderId()` ne peut remplacer la référence locale **qu'une fois, avant l'intention**, jamais après le passage à `intent_created`. Les replays HTTP utilisent la mutation initiale même si l'interface produit une nouvelle valeur après un redémarrage.
- La séquence refuse le mode production, exige `EXPO_PUBLIC_DA_CANONICAL_CHECKOUT_QA=YES` dans un environnement QA, valide les réponses et le montant/fingerprint sur les deux étapes, puis mémorise le PI dans le verrou **avant PaymentSheet**. Elle ne présente pas PaymentSheet, ne confirme rien, ne met pas `paid` et ne libère jamais le verrou toute seule. **Aucun écran n'importe ce module aujourd'hui**.
- `apps/client/test/daCheckoutAttemptFence.test.cjs` : **12/12 PASS** sur Toshiba et en CI. Scénarios supplémentaires : liaison UUID unique, valeur Stripe par serveur, crash entre les deux POST, replay de mutation, montant/merchant contradictoire, interruption SecureStore, interdiction production.
- Preuves même SHA : [API/Client/Merchant/Courier #38308314438](https://github.com/adminluxe/DelishAfrica/actions/runs/38308314438) **SUCCESS** ; [PostgreSQL 17 #38308314349](https://github.com/adminluxe/DelishAfrica/actions/runs/38308314349) **SUCCESS**.

### Stripe TEST officiel : inventaire local du laboratoire

Commande exécutée sans réseau : `bash ops/stripe/DA_STRIPE_TEST_OFFICIAL_PREFLIGHT_V1.sh --inventory`. Branche QA correcte, Git propre, Node/git prêts, mais les quatre variables propres au **processus local** (`DA_STRIPE_TEST_SECRET_KEY`, `DA_STRIPE_TEST_PUBLISHABLE_KEY`, `DA_STRIPE_TEST_WEBHOOK_SECRET`, `DA_STRIPE_TEST_EXPECTED_ACCOUNT_ID`) sont **absentes ou non valides**. Le programme conclut `PROVIDER_NETWORK=NEVER_USED`, `PROVIDER_CHECK=NOT_PERFORMED`. Des anciens identifiants test existent ailleurs, mais ne sont pas importés/copiés ou utilisés dans ce chantier.

**Freins restant en place :** aucun chargement de ces contrôleurs dans `AppModule`, aucun transport API connecté à l'app officielle, aucun module Prisma/PG de production, aucune autorisation réelle de Stripe TEST, aucune preuve de reçu financier accessible sur le Client, aucun panier ni ligne de commande complet persistant pour Merchant, aucune livraison. Les deux postes de commande `/orders/create` et `/payments/create-intent` publics continuent d'utiliser la logique legacy. Le verrou local ne garantit pas à lui seul l'absence de deux mutations concurrentes sur appareils différents : une politique d'idempotence **serveur globale** et le parcours de reprise doivent encore être certifiés.

**NO-GO G0–G7 / Stripe officiel / production / Store / PR merge** jusqu'à l'intégration, la revue du compte TEST, la certification métier Merchant–Courier et la validation du propriétaire.

## Palier 13 octobre 2026 — lecture financière Client : DOUBLE CI SUCCESS

**Certifié sur le code a0dbcc6bb1224db192fc9d918f38af946d2cad8b**, après rétablissement de la liaison Toshiba, sans reset, sans migration VPS ni activation de route publique.

**Preuves du même commit :**
- [CI API + Client / Merchant / Courier #38317389130](https://github.com/adminluxe/DelishAfrica/actions/runs/38317389130) : **SUCCESS** — TypeScript des trois apps et de l'API, 15/15 tests Client de réservation/reprise, 4/4 tests du lecteur financier SQL, vrai contrôleur HTTP NestJS avec garde Client RSA/JWT, ports PostgreSQL et Stripe factices en HTTP.
- [CI PostgreSQL 17 financier #38317389082](https://github.com/adminluxe/DelishAfrica/actions/runs/38317389082) : **SUCCESS** dans un conteneur jetable sans réseau — migrations QA 001–005, test SQL de lecture liée à l'identité, ordre en attente avant capture, paiement seulement après reçu vérifié, refus d'un autre Client ou issuer, retenue après remboursement, anti-replay et concurrence.

### Contrats QA nouvellement vérifiés

1. Migration PostgreSQL 005, fichier services/api-nest/migrations/client-commerce/20261012_005_client_order_receipt_read_qa_only.sql : fonction de lecture seule **da_qa_client_read_owned_order(uuid,text,uuid)**. La commande est recherchée avec UUID, issuer et subject. Statut **awaiting_payment** avant preuve financière, **paid** uniquement si capture, reçu append-only, état de paiement vérifié, devise/montant exacts et aucune retenue, **financial_hold** après remboursement/litige, sinon **needs_review**. Un hold interdit la livraison.
2. Adaptateur services/api-nest/src/client-commerce/client-order-receipt.pg-qa.adapter.ts : requête SQL paramétrée, identité provenant du Client vérifié, validation stricte de la réponse et des montants. **Aucun UPDATE/INSERT/DELETE ni accès à Stripe** ; erreur générique en cas d'ordre étranger ou de statut incohérent.
3. Contrôleur NestJS isolé : **POST /qa-isolated/client-commerce/orders/status**, sous le même garde RSA/JWT Client + admission durable SMS/email que les deux routes de réservation/intention. Les erreurs 401/403/400/503 ne divulguent pas les données d'un autre Client ; réponse en lecture seule. Contrôleur **non chargé dans AppModule**, jamais rendu public.
4. Candidat apps/client/utils/daCanonicalCheckout.qa.ts : lecture du statut uniquement après ouverture de PaymentSheet dans le parcours QA, validation de l'UUID, mutation et PaymentIntent conservés. Un paiement non prouvé, une retenue, un PI différent ou une erreur réseau **gardent le verrou anti-double-paiement**. Un reçu **paid** du serveur correspondant au même PI permet uniquement de libérer le verrou local ; le Client ne marque jamais l'ordre comme payé.
5. Résultats des tests : **15/15 Client**, **4/4 reader**, tests Nest HTTP et SQL PG17. Tous sur valeurs synthétiques ; **aucun appel à Stripe TEST officiel, Stripe LIVE, à un vrai PSP ni à la base VPS**.

### Limites bloquantes et sécurité

La fonction SQL reçoit issuer/subject du **serveur authentifiant**. Elle ne valide pas un JWT cryptographiquement dans PostgreSQL : un compte de base applicatif compromis pourrait présenter une autre identité. Les fonctions SECURITY DEFINER QA ont un propriétaire de base de laboratoire, **pas le propriétaire NOLOGIN durci exigé en production**. Une revue des rôles, du contexte d'identité, des droits et de la gestion des secrets demeure indispensable. Un statut paid lu à un instant donné ne constitue jamais une autorisation permanente de livraison : Merchant/Courier devront revérifier les retenues au moment du dispatch.

**NO-GO maintenu** : aucune route réelle orders/create, payments/create-intent ou stripe/webhook migrée, aucune intégration Client PaymentSheet public, aucune application Merchant/Courier branchée sur le nouveau reçu, aucun Stripe TEST officiel autorisé, aucune migration PostgreSQL du VPS, aucun G0–G7, aucune fusion de PR ni soumission Store. Les PR #35 et #36 restent DRAFT.

## Palier F4 — panier commercial PostgreSQL immuable (13 octobre 2026)

**Commit de code certifié :** `e40b0ecb49d29f64c6abe4db68507de741b7427c`. Deux pipelines sur ce même SHA :
- [PostgreSQL 17 / finance / 006 #38319913618](https://github.com/adminluxe/DelishAfrica/actions/runs/38319913618) **SUCCESS** — véritable base jetable `--network none`. Preuves : `QA_SNAPSHOT_MISSING=PAYMENT_BLOCKED`, `QA_SNAPSHOT_APP_ROLE_ATOMIC_COMMIT_AND_REPLAY=ONE_ORDER`, `QA_SNAPSHOT_FOREIGN_CLIENT_DUP_SKU_OR_PRICE=DENIED`, `QA_SNAPSHOT_IMMUTABLE_AFTER_COMMIT=PASS`, `QA_SNAPSHOT_CAPTURED_PAYMENT_AND_IMMUTABLE_LINES=DISPATCH_ALLOWED`, `QA_SNAPSHOT_REFUND_HOLD=DISPATCH_REVOKED`.
- [API + Client + Merchant + Courier #38319916985](https://github.com/adminluxe/DelishAfrica/actions/runs/38319916985) **SUCCESS** — TypeScript, catalogue publié simulé, test de transaction et garde d'identité. Trois tests locaux de l'adaptateur utilisent un port PG factice et confirment BEGIN → réservation → snapshot → COMMIT, ROLLBACK sur interruption, rejet des prix ou identités invalides sans trafic SQL.

### Contrat commercial durable préparé et testé

- `services/api-nest/src/client-commerce/client-commerce-canonical-quote.pg-qa.adapter.ts` produit désormais, exclusivement à partir de la politique catalogue serveur, des lignes de fulfillment (SKU, nom, catégorie, quantité, prix unitaire et montant par ligne) et les frais de livraison. Prix, montant et drapeaux `paid` envoyés par un téléphone restent ignorés.
- `services/api-nest/src/client-commerce/client-order-snapshot.pg-qa.adapter.ts` fournit `reserveOrderAndSnapshot()` : une **même transaction PG** écrit l'UUID de commande puis un instantané marchand sans PII, sur le rôle de base applicatif QA. Une interruption avant COMMIT annule les deux écritures. Cette méthode n'est pas intégrée à l'application distribuée.
- La migration de test **006** (`20261013_006_canonical_order_snapshot_qa_only.sql`) crée `da_client_commerce_order_snapshot_qa`, interdit modification et suppression après validation, exige l'identité Client, le même UUID/devis/panier/devise/total, vérifie unicité SKU et arithmétique des lignes. Son garde `BEFORE INSERT` refuse toute nouvelle autorité de paiement **sans snapshot**.
- `da_qa_commerce_order_dispatch_eligible(uuid)` exige désormais **snapshot immuable + capture Stripe TEST vérifiée + reçu financier exact + absence de refund/dispute**. Le SQL recontrôle les holds au moment de la lecture, sans donner un passe-droit permanent au Courier.
- Les tests PostgreSQL 006 utilisent des commandes et preuves de paiement **synthétiques**. Ils vérifient refus de panier manquant, mutation/identité falsifiées, rejets de prix incorrects, replays, finance avant et après capture et retenue tardive. Le rôle app ne possède aucun SELECT/UPDATE direct sur le snapshot.

### Limites, blocages et prochaine preuve

**Certification complémentaire sur le SHA exact `2b54913be6310fa399f0c3ea676b73e40d911b81` :** [CI PostgreSQL 17 / deux PgPools #38320332214](https://github.com/adminluxe/DelishAfrica/actions/runs/38320332214) **SUCCESS**, et [CI Client/API/3 apps #38320332362](https://github.com/adminluxe/DelishAfrica/actions/runs/38320332362) **SUCCESS**. Le test `services/api-nest/test/client-order-snapshot.pg-qa.integration.cjs` exécute **le vrai adaptateur Node** contre PostgreSQL 17 dans le même conteneur sans réseau : 8 réservations simultanées sur 2 pools produisent **1 UUID + 1 panier + 1 autorité Stripe TEST synthétique**, une réservation historique sans snapshot est refusée, une panne entre le premier et le second SQL provoque ROLLBACK (0 commande orpheline), et le rôle applicatif ne peut ni lire ni modifier directement les tables. **Cette preuve F4 de transaction concurrente est maintenant CERTIFIÉE en QA déconnectée.** **Aucun écran ni route publique Client/Merchant/Courier n'est branché sur ce flux** ; la réservation historique démo demeure en place. Les fonctions SECURITY DEFINER et l'ownership demandent une révision IAM avant toute promotion.

Stripe TEST officiel n'a pas été contacté : clé `sk_test_`, clé publique, secret webhook `whsec_` et compte TEST épinglé sont absents du processus QA isolé. Ne pas importer des clés anciennes du VPS. **Aucun Stripe LIVE, aucune migration VPS, aucune publication, aucun G0–G7, aucune fusion**. PR #35 et #36 toujours DRAFT.

## Palier F4B — Merchant → Dispatch → Courier PostgreSQL réel certifié (13 octobre 2026)

**Deux jalons de code, quatre pipelines verts :**
- `d3a0d48a317f3c867e64d229e752da23c9e59a33` : migration 007, contrôleur NestJS QA et adaptateur commercial. [PostgreSQL17 #38322184915](https://github.com/adminluxe/DelishAfrica/actions/runs/38322184915) **SUCCESS** ; [API + 3 apps #38322184929](https://github.com/adminluxe/DelishAfrica/actions/runs/38322184929) **SUCCESS**.
- `3ebcdcbd2db4a753beffc8b9e3c1d8c67f1903ee` : vrai adaptateur Node connecté à **trois comptes PostgreSQL distincts** dans le même conteneur sans réseau. [PostgreSQL17 #38322468685](https://github.com/adminluxe/DelishAfrica/actions/runs/38322468685) **SUCCESS** ; [API + 3 apps #38322468143](https://github.com/adminluxe/DelishAfrica/actions/runs/38322468143) **SUCCESS**.

### Flux testé et preuves

1. `services/api-nest/migrations/client-commerce/20261013_007_merchant_courier_fulfillment_qa_only.sql` introduit deux tables QA persistantes : `da_qa_fulfillment_state` (accepté puis prêt) et `da_qa_courier_offer` (offert, accepté, enlevé, livré), avec suivi de chaque étape et **aucune PII Client**. Trois rôles de base séparés `da_qa_merchant_commerce_app`, `da_qa_dispatch_commerce_app`, `da_qa_courier_commerce_app` ont uniquement les fonctions nécessaires, aucun SELECT/UPDATE direct sur les tables.
2. La fonction `da_qa_merchant_visible_paid_orders` liste les lignes canoniques du restaurant seulement après preuve Stripe TEST synthétique capturée, et montre `financial_hold` si remboursement/litige. La fonction `da_qa_merchant_transition` impose `accepted → ready` sur l'UUID et le slug du restaurant. Une commande en attente, étrangère ou frappée d'une retenue financière est rejetée.
3. `da_qa_dispatch_assign_offer` est réservée au rôle du **serveur Dispatch** : un Courier ne peut jamais se créer une offre. Son issuer et son subject sont conservés comme affectation immuable. `da_qa_courier_assigned_offers` ne retourne que les offres de cette identité ; `da_qa_courier_transition` impose `offered → accepted → picked_up → delivered`, avec relecture de l'éligibilité financière **à chaque transition**. Un remboursement tardif bloque notamment `picked_up`.
4. `services/api-nest/src/client-commerce/merchant-courier-fulfillment.pg-qa.adapter.ts` expose les opérations via trois pools à rôles séparés. Les droits Merchant exigent `external`, statut de membership `active`, contrat `active`, KYB `verified`, restaurant `published` et `accessEligible`. Courier exige une preuve `committed-server-roster` active. Les arguments Client sont toujours dérivés du principal et du registre, **pas des champs d'identité du téléphone**.
5. `merchant-courier-fulfillment.qa.controller.ts` expose seulement en **module NestJS éphémère** les 4 POST `/qa-isolated/fulfillment/merchant/orders/list`, `merchant/orders/transition`, `courier/offers/list`, `courier/offers/transition`. Utilise le vrai `OrdersAuthGuard` en HTTP QA et bloque le mode production. **AUCUNE injection dans AppModule.**
6. Tests : `native-merchant-courier-fulfillment.pg-qa.sql` avec **vrai PostgreSQL17** (commande impayée invisible, capture vérifiée, ownership merchant, offre serveur, assignee étranger refusé, hold tardif) ; `merchant-courier-fulfillment-http.qa.test.cjs` avec vrai HTTP Nest/guard mais **AuthService/JWT résolu par simulateur**, base simulée ; `merchant-courier-fulfillment.pg-qa.integration.cjs` avec **vrai adaptateur Node + PostgreSQL17**, 3 rôles et deux commandes : première réellement amenée de `accepted` à `delivered`, seconde stoppée après remboursement avant `picked_up`. Résultats `QA_007_NODE_PG_ACCEPT_PICKUP_DELIVER_SEQUENCE=PASS`, `QA_007_NODE_PG_REFUND_BEFORE_PICKUP=BLOCKS_BOTH_APPS`, `QA_007_NODE_PG_THREE_SEPARATE_ROLE_ACLS=PASS`.

### Verrous NO-GO non négociables

- **L'identité n'est pas encore liée de bout en bout :** le JWT réel Merchant/Courier de l'environnement cible, son issuer, les adhésions contractuelles et le registre actif des livreurs ne sont pas raccordés à ces ports QA. En HTTP, la résolution AuthService est simulée, et l'état membre/roster provient de fixtures.
- **SQL et IAM :** le compte PG marchand partagé peut transmettre un `merchantSlug` et le compte Courier un issuer/subject à une fonction SECURITY DEFINER : la base ne prouve pas ces identités cryptographiquement toute seule. Une compromission du service/compte pourrait contourner les contrôles d'application. Ajouter une attestation serveur liée à l'identité et au contexte DB ainsi qu'un propriétaire NOLOGIN non-superuser avant production.
- **Concurrence finance / livraison :** la relecture du hold à chaque transition est prouvée pour un hold déjà commité, mais la **sérialisation transactionnelle d'un hold arrivant exactement en concurrence avec `picked_up`** n'est pas encore certifiée. Bloquer ce cas par un verrou partagé sur la ligne d'autorité/commande, puis tester l'ordre des commits.
- **Exploitation commerciale :** adresse de livraison, trajet/ETA, réassignation/rejets des offres et assistance Ops ne sont pas intégrés au modèle PG 007. Aucun écran des apps Client/Merchant/Courier n'appelle ces routes QA ; les routes réelles héritées restent inchangées.
- **Stripe TEST officiel :** aucun `sk_test_`, `pk_test_`, `whsec_` ou `acct_` épinglé n'est chargé dans ce processus QA ; toutes les captures des tests sont synthétiques. Pas de connexion Stripe officielle, pas de clé reprise du VPS.

**Statut :** F4B **certifié techniquement en laboratoire** ; **NO-GO** pour Stripe TEST officiel, routes publiques, déploiement, VPS, Keycloak, G0–G7, fusion et Stores. PR #35 et PR #36 maintenues en DRAFT. Prochain palier : réduire les écarts de confiance IAM/claims, tester le hold concurrent au dispatch, configurer les secrets officiels TEST en coffre isolé et seulement ensuite une vraie verticale commerciale G0–G7 approuvée.

## Palier F4C — conflit refund / pickup totalement sérialisé en PostgreSQL 17 QA (13 octobre 2026)

**Code vérifié :** migration QA additive `20261013_008_refund_dispatch_row_lock_qa_only.sql`, nouveau test `refund-pickup-row-lock.pg-qa.integration.cjs`, commit initial `670ad26dc1c2fe580481b75a17274ab0295b102f` puis commit corrigé et **certifié** `dde5b460d0c547d59c3dcafa907149b178d512d2`.

**Preuves sur le SHA final :** [PostgreSQL17 et concurrence #38323181256](https://github.com/adminluxe/DelishAfrica/actions/runs/38323181256) **SUCCESS** et [API, Client, Merchant, Courier #38323181287](https://github.com/adminluxe/DelishAfrica/actions/runs/38323181287) **SUCCESS**. Le premier essai PG17 avait échoué sur une collision d'une empreinte de reçu **synthétique**, réutilisée par une autre suite ; la contrainte d'unicité du reçu a correctement arrêté la CI. Le commit corrigé utilise des SHA-256 uniques déterministes pour chaque cas. Aucun échec n'a été masqué.

### Garantie transactionnelle F4C

- Le reconciler financier TEST **simulé** `da_qa_finance_record_hold()` relit puis verrouille **la même ligne de commande `FOR UPDATE`** que les fonctions Merchant, Dispatcher et Courier du schéma 007, puis verrouille l'autorité de paiement. Il revalide le mode `test`, l'état `succeeded`, le reçu capturé immuable, la devise/le montant et le paiement `paid`. Le rôle financier conserve la seule permission EXECUTE nécessaire et les rôles applicatifs n'obtiennent aucun privilège supplémentaire.
- **Refund valide d'abord :** la transaction hold maintient le verrou ; un pickup concurrent attend. Après COMMIT du refund, `picked_up` est refusé et le livreur reste au stade `accepted`. Résultat réel PG : `QA_008_REFUND_FIRST_COURIER_WAITED_THEN_PICKUP_DENIED`.
- **Pickup valide d'abord :** la transaction Courier maintient le verrou ; le refund attend le COMMIT. La prise en charge préexistante reste enregistrée, mais dès que le refund est validé, le passage vers `delivered` est refusé. Résultat réel PG : `QA_008_PICKUP_FIRST_REFUND_WAITED_THEN_DELIVERY_DENIED`.
- **Rejeu financier :** un deuxième appel pour le même ajustement est idempotent et ne débloque jamais la livraison : `QA_008_FINANCE_HOLD_REPLAY_STABLE`.
- Le test Node utilise PostgreSQL17 réel en conteneur **sans réseau**, deux transactions explicitement ouvertes, les rôles PostgreSQL séparés `da_qa_stripe_finance_reconciler` / `da_qa_courier_commerce_app`, et `pg_stat_activity.wait_event_type='Lock'` pour prouver que l'opération concurrente attend réellement la transaction verrouillante. Les valeurs de charge, compte, paiement et reçu sont **synthétiques** ; aucun fournisseur Stripe n'est appelé.

**Limite physique :** l'ordre des COMMIT est garanti, pas l'annulation matérielle d'un colis déjà enlevé avant le refund. La procédure de litige, d'assistance, de reprise et de suspension des missions doit être conçue avant lancement. Ce jalon **ne raccorde pas** le vrai OIDC Merchant/Courier, le registre réel, les adresses clients ni les routes commerciales publiques.

**NO-GO confirmé :** Stripe TEST officiel non configuré dans la QA, aucun `sk_test_` / `pk_test_` / `whsec_` / compte TEST épinglé importé, aucun LIVE, aucune migration VPS, aucune publication, aucune fusion de PR, aucune soumission Store, aucun G0–G7. Les PR #35 et #36 demeurent DRAFT.

## Palier F4D — Merchant & Courier FINANCE WALLET QA 009 (13 octobre 2026)

### Besoin produit, audit du code et vérité des montants

Le besoin exprimé par le fondateur : Merchant et Courier doivent observer leurs revenus évoluer **commande après commande**, avec un historique intelligible et aucune ambiguïté entre argent gagné, retenu et retirable. L'audit du worktree QA a relevé l'absence d'un module financier réel `wallet/earnings/payout` raccordé dans `services/api-nest/src`, `apps/merchant` ou `apps/courier`. `apps/merchant/app/_tonton_signature.tsx` affiche par exemple un chiffre statique `82 500 XAF` : c'est un **élément de démonstration, absolument pas un solde vérifié**. Les écrans de présence et de commandes ne sont pas un grand livre financier.

### Architecture technique introduite

- **Migration QA `20261013_009_merchant_courier_wallet_qa_only.sql`** : tables immuables `da_qa_wallet_policy`, `da_qa_wallet_allocation` et `da_qa_wallet_posting`. Répartition uniquement à partir du panier PostgreSQL 006, de la commande et de l'autorité de paiement marquées payées via la preuve de capture/reçu Stripe TEST **synthétique** du laboratoire 004, dans la même transaction protégée par le verrou `FOR UPDATE` commande puis autorité (008).
- Le rôle `da_qa_stripe_finance_reconciler` est le seul utilisateur applicatif disposant d'EXECUTE sur `da_qa_wallet_accrue_verified_capture(order_id)`. **Aucun taux, montant, `paid`, compte ou bénéficiaire ne provient du téléphone.** Un paiement manquant/refusé ne peut jamais créditer la répartition. La fonction est idempotente après 8 tentatives concurrentes provenant de deux pools.
- **Journal de répartition à somme nulle** et append-only : `allocation_clearing=-capturé`, `merchant_earned=+net`, `courier_reserved=+allocation livraison`, `platform_retained=+frais plateforme`. Le débit `allocation_clearing` ne représente PAS de l'argent en banque ou un solde Stripe ; il s'agit exclusivement d'un équilibrage comptable interne QA.
- Une politique identifiée par version `QA_FIXTURE_EUR_V1` concerne **seulement `qa-restaurant` en EUR**, avec exemple **non contractuel** de 20 % de frais menu et 100 % du forfait livraison pour Courier. Exemple : commande `26,90 €`, menu `23,00 €`, livraison `3,90 €`, commerçant `18,40 €`, coursier `3,90 €`, plateforme `4,60 €`. Les règles commerciales définitives, taxes, pourboires, remboursements partiels, incitations, régions, conversion de devises et Stripe Connect restent à concevoir et approuver.
- **Vues en lecture seule et instantanées** via `da_qa_wallet_merchant_summary/activity` et `da_qa_wallet_courier_summary/activity`, utilisant les étapes 007 et les holds 008 comme état de vérité. Pour Merchant : `pending` après capture puis `available` après `ready`. Pour Courier : aucun droit à rémunération avant affectation ; `pending` après offre, `available` après `delivered`. Dès qu'un remboursement/litige est COMMIT, `available=0` et `held=montant concerné`. **`withdrawable=0` et `payoutEnabled=false` toujours**, même si la somme est dite `available` (disponible uniquement au sens d'éligibilité opérationnelle de la simulation).
- `merchant-courier-wallet.pg-qa.adapter.ts` réutilise les validations Merchant (issuer externe, contrat actif, KYB vérifié, membership publié/actif) et Courier (roster serveur actif). Le contrôleur `merchant-courier-wallet.qa.controller.ts` expose uniquement `POST /qa-isolated/wallet/merchant/summary` et `POST /qa-isolated/wallet/courier/summary`, no-store, avec `OrdersAuthGuard`, corps HTTP aux champs strictement limités, aucun endpoint `withdraw`/`cashout`. Il est **désactivé en production** et absent de `AppModule`.
- `merchant-courier-wallet-release-isolation.qa.test.cjs` surveille l'absence de routage public et de paiements sortants ; le contrôle a réussi localement avec 0 échec.

### Preuves CI et limites exactes

- Commit `9801dc0801361e80c28a67d8478c10a462909a23` : [PostgreSQL17 #38324552260](https://github.com/adminluxe/DelishAfrica/actions/runs/38324552260) **SUCCESS** et [API/3 apps #38324552388](https://github.com/adminluxe/DelishAfrica/actions/runs/38324552388) **SUCCESS**. PG réel, 8 accruals → 1 allocation, 4 postings équilibrés, zéro gain impayé, passage pending/available, freeze après refund, refus de mutation et de lecture brute, aucune transaction Stripe ni payout.
- Commit `1af2f65e116d427be63585aefd6f000dcf34db09` : [PG17 #38324760411](https://github.com/adminluxe/DelishAfrica/actions/runs/38324760411) **SUCCESS** et [API/routes HTTP/3 apps #38324760436](https://github.com/adminluxe/DelishAfrica/actions/runs/38324760436) **SUCCESS**. HTTP NestJS réel et `OrdersAuthGuard` réel, mais son `AuthService` est simulé ; PG est mocké dans le test HTTP, tandis que le test PG séparé exécute le vrai adaptateur avec vraie base.
- Commit `79964cee22cb39a60b1588912e2d2199dd5b17c1` : garde CI statique de non-activation publique et non-payout. [PG17 #38324993520](https://github.com/adminluxe/DelishAfrica/actions/runs/38324993520) ; [API/3 apps + static guard #38324993516](https://github.com/adminluxe/DelishAfrica/actions/runs/38324993516). Les deux pipelines sont **SUCCESS sur ce SHA exact**, ce qui certifie l'isolation des routes finance QA et l'absence de payout public.

### Interdits et blocages avant commercialisation internationale

**NON EN PRODUCTION :** finance et répartition simulées, aucune connexion Stripe TEST officielle, aucune déclaration réglementaire que les fonds sont réellement disponibles, aucun vrai virement/compte connecté, aucun cashout, aucun changement VPS / Keycloak / live, aucune fusion, build EAS ni Store. **PR #35 et #36 DRAFT**. Les apps visibles exécutent toujours les routes historiques, pas les deux routes QA.

À résoudre avant G0–G7 :
1. **Fin du spoofing/contournement intra-rôle DB** : les fonctions SECURITY DEFINER acceptent le merchantSlug / issuer / subject en paramètres ; un compte applicatif DB compromis pourrait choisir un autre bénéficiaire. Avoir un owner SQL dédié NOLOGIN/non-superuser et un **contexte attesté** lié à la session et au token, audité, avant d'ouvrir les lectures aux partenaires.
2. **Authentification et contexte réels** : brancher les véritables comptes OIDC Merchant/Courier et les registres persistants (KYB/KYC/contrats/territoires/roster) sans fallback démo ; vérifier révocation et cross-tenant par tests HTTP intégrés à PG.
3. **Politique financière internationale** : version de contrat fixée **à la commande** (pas déterminée a posteriori à la capture), règle locale par devise/territoire, TVA/taxes, arrondis, PSP payout et solde disponible ≠ solde retirable, frais de paiement, pourboires et remboursements partiels ; test multi-devise sans agrégation FX.
4. **Cohérence financière** : incorporer l'accrual dans le reconciler Stripe TEST certifié, jobs de réparation/rejeu, réconciliation PSP externe, solde de cantonnement et retraits contrôlés ; rejeter toute impression de « gains crédités » si la capture réelle n'a pas été vérifiée.
5. **UX premium** : historique par course/commande, progression pending/eligible/hold, info-bulles Commission/TVA/PSP, actualisation depuis backend vérifié (WebSocket/SSE fiable ou polling avec ETags), états offline/stale et notification de litiges. Ne pas afficher des données démo comme financières réelles.

**Prochaine étape recommandée :** fermer le raccordement d'identité et les preuves anti-cross-tenant DB, puis installer **Stripe TEST officiel dans un coffre indépendant**, signer le passport G0–G7 de bout en bout avant d'activer les cartes de finances dans Merchant/Courier. Aucun contournement pour gagner du temps.

## Ordre de certification restant
- **F0 / CI** : suite SQL vraie sur PG17 isolé, huit concurrents, garde des privilèges, TypeScript, erreurs et jeux de preuves exportés sans secret. Un échec = NO-GO.
- **F1 / Création TEST officielle isolée** : vault/secret local dans un environnement de QA autorisé, clé `sk_test_` et compte épinglé, Idempotency-Key dérivée de la réservation SQL, montant serveur, confirmation manuelle. Prouver timeout fournisseur et reprise sans double PI.
- **F2 / Webhook extérieur et reprise** : point HTTPS QA isolé, secret `whsec_` officiel TEST séparé, vraie signature `Stripe-Signature` et octets bruts, doublons, retrys, erreur PG et dead-letter, pas de PII dans les journaux.
- **F3 / Finance** : réconciliation par API Stripe TEST, charge, refund, dispute, compte, ordre, devis et garde SQL. Reprise après crash, rôle séparé et hold métier.
- **F4 / Routes commerciales** : vraie API Client `/orders/create` + `/payments/create-intent` avec JWT client admis, devis canonique serveur, ClientMutationId idempotent, dispatch interdit avant capture ; guards Merchant/Courier/Ops testés ; aucun contournement guest.
- **F5 / Trois apps et G0–G7** : binaire exact QA iOS/Android, compte réel de QA, menu → panier → paiement TEST volontaire → Merchant → Courier → ETA/livraison → suivi, échecs et retour arrière ; validation utilisateur avant promotion.
- **F6 / Gouvernance** : revue IAM/Keycloak, coffre secrets, Stripe Connect et conformité ; une unique architecture/roadbook de production une fois certifiée.

**État documentaire de cette version : QA PG17/Stripe simulé CERTIFIÉ sur les SHAs de code testés, cf. exécutions CI ci-dessus.** Aucun raccordement fournisseur TEST réel, aucune route publique, aucun test G0–G7 : **NO-GO**. Toute évolution ultérieure exige une nouvelle CI sur son SHA exact.

---

## Mise à jour 13/10/2026 — F4E P0 : wallet SQL session-bound (QA 010)

**Statut : couche SQL / claims OIDC candidate certifiée en laboratoire synthétique. Identités financières Keycloak réelles = NON CERTIFIÉES.**

- Origine F4D : `cd0ba578401d087f9f42c4303e5501704d6bbf94`, deux CI SUCCESS F4D, PR #35/#36 DRAFT.
- Branche dédiée sans écraser le Toshiba : `feat/f4e-wallet-scope-isolation-qa-20261013`, [PR #37 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/37), base PR #36.
- SHA **code F4E testé** : `f97567f3e7c89ae5f80e33261cd2da6a2045dfb8`. Deux preuves vérifiées :
  - PostgreSQL 17 déconnecté + tous les tests 001–010 + attaques interpartenaires : [CI #38327215358 — SUCCESS](https://github.com/adminluxe/DelishAfrica/actions/runs/38327215358).
  - API TypeScript + Client/Merchant/Courier + matrice OIDC Merchant/Courier : [CI #38327215429 — SUCCESS](https://github.com/adminluxe/DelishAfrica/actions/runs/38327215429).
- Rappels d'échecs corrigés : PG17 `38326871118` et `38327037757` ont correctement refusé d'émettre des tickets lorsque l'heure de début de session PostgreSQL était indisponible au propriétaire non privilégié. Une fonction étroitement limitée et un rôle observateur `NOLOGIN INHERIT` ont permis les contrôles sans superuser. Les deux échecs restent dans l'historique, ne sont pas masqués.

### F4E livré techniquement en QA

1. Migration additive `20261013_010_wallet_tenant_bound_scope_qa_only.sql` avec révocation des anciennes fonctions financières par `merchantSlug/issuer/subject`, et fermeture des mutations Merchant/Courier/Dispatch non attestées. Aucune fonction de payout ajoutée.
2. Propriétaires distincts et sans login pour les lectures et écritures wallet, droit UPDATE limité aux clés primaires nécessaires pour les row locks ; impossibilité de SELECT direct par les rôles applicatifs.
3. Attestation SQL par rôle séparé, challenge lié au backend + ticket à durée courte/usage unique, autorisation de lecture adossée à organisation/territoire et à la révocation des droits au moment de la lecture.
4. Test adverse réel PG17 : Merchant A ≠ Merchant B, Courier A ≠ Courier B, même sujet et issuer différent, mauvaise organisation/territoire, vol de ticket dans une autre connexion, replays, contrat/KYB/roster révoqués ; preuves de refus dans la CI.
5. Filtrage supplémentaire des tokens partenaires **après signature RSA** : audience propre à l'app, `azp`, interdiction de mélange de rôles/applications et de sujet malformé ; tests de claims synthétiques dans la CI API.

### Non obtenu, à bloquer pour la suite

- La mise en relation **effective** entre les vrais JWT Merchant/Courier, la révocation de leurs sessions, les memberships/KYB et le registre Courier durable d'un côté, et le rôle SQL attestateur de l'autre, n'existe pas encore. Le laboratoire emploie des fixtures.
- Aucun contrôle contractuel international complet : entités juridiques, devise, TVA, taxes, PSP, FX, remboursements partiels, disputes ni autorisation réglementaire de payout ne sont prouvés.
- Aucune mutation Merchant/Courier QA post-010 autorisée pour les logins applicatifs avant réécriture sous attestations indépendantes.
- Aucune migration PG sur VPS, aucune modification du runtime ou des trois apps installées, aucun Stripe officiel TEST/LIVE, fusion, build, publication ni soumission Store.
- `withdrawableMinor=0`, `payoutEnabled=false` demeurent invariants. Montants 18,40 € et 3,90 € des tests = synthétiques.

**Prochaine barrière P0 :** intégrer l'attestor réel avec preuve JWT et révocation vérifiée, membership Merchant + contrat + KYB lié à l'organisation/territoire, roster Courier durable et preuves de séparation inter-partenaires de bout en bout ; ensuite seulement P1 Stripe TEST officiel. Le plan UX premium reste conditionné à ces preuves.

**Passation complète :** `docs/DA_PASSATION_F4E_WALLET_TENANT_ISOLATION_P0_QA_2026-10-13.md`. **Signature : F4E-SQL-010-QA-CERTIFIED-ON-f97567f / REAL-OIDC-P0-NO-GO / NO-STRIPE / ZERO-PAYOUT / NO-PRODUCTION / NO-MERGE / NO-STORES**.

---

## DELISHAFRICA® — F4F QA : pont JWT partenaire signé → wallet PostgreSQL 17 (13/10/2026)

**Source :** [passation F4F complète](./DA_PASSATION_F4F_SIGNED_PARTNER_WALLET_QA_2026-10-13.md). **PR #38 DRAFT** basée sur #37 DRAFT, jamais fusionnées. Worktree Toshiba F4D et VPS non modifiés.

**Périmètre certifié :** isolation SYNTHÉTIQUE par identité avec signature RSA réellement calculée par une clé éphémère en CI, vérification du véritable code `ExternalJwksVerifierService.verifyToken` sur clé artificielle épinglée en mémoire, vérification de session ACTIVE dans un registre QA simulé, autorisations métier stockées dans SQL 010 synthétique, liaison au rôle et à la connexion PG17 réellement distincts. Ni Keycloak réel, ni révocation production, ni vraie preuve KYB, ni registre Courier officiel ne sont impliqués.

**Règle critique :** le pont `QaWalletVerifiedSessionBridge` accepte seulement un Bearer JWT et la limite de lecture ; aucune entrée `merchantSlug`, `issuer`, `subject`, `organisation`, `territoire` provenant du mobile. Un vérificateur extérieur doit remettre une identité cryptographiquement vérifiée. Le bridge exige les claims `iss/sub/aud/azp/role/sid/jti/exp/iat`, une session non révoquée (preuve fraîche inférieure à 5 secondes), un seul Merchant KYB/contrat actif ou Courier en registre actif, puis un challenge et un ticket SQL F4E liés au backend et de courte durée. Refus opaque, fail-closed et aucun secret loggé.

**Matrice adverse :** Merchant A vs B, Courier A vs B, issuer étranger et même sujet, altération RSA et clé étrangère, audiences/roles/azp croisés, JWT expiré, SID manquant, révocation de session signée, contrat suspendu, Courier désactivé, ticket SQL intersession, aucun payout. Les montants `1840`/ `390` minor units de test sont synthétiques. `withdrawableMinor=0`, `payoutEnabled=false`.

**Premiers CI double SUCCESS sur le même SHA `2d7b6b250bf160244f91c85eeb80615fb6e9b4e4` :**
- [PostgreSQL17 isolation PG + tests RSA / revocation QA #38328354487](https://github.com/adminluxe/DelishAfrica/actions/runs/38328354487) — SUCCESS.
- [API + Client/Merchant/Courier + véritable code verifier JWT / signature synthétique #38328354493](https://github.com/adminluxe/DelishAfrica/actions/runs/38328354493) — SUCCESS.

**Lacunes bloquantes :** la vérification RS256 contre un Keycloak réel, les clés et métadonnées JWKS d'origine authentifiée, la révocation Partner depuis une autorité persistante, les données contractuelles/KYB officielles, le registre Courier, le processus attestor isolé réellement déployé, le nouveau modèle comptable légal multi-organisation/territoire, les permissions d'écriture Courier/Dispatch/merchant sous attestation et les politiques internationales de paiement ne sont PAS certifiés. F4E ferme les fonctions d'écriture non attestées après 010. Les pipelines ne représentent **jamais** une autorisation Stripe TEST/LIVE, un virement, une fusion ou une soumission Store.

**G0–G7 toujours NO-GO.** La signature F4F QA sur le HEAD documentaire final nécessite une nouvelle vérification du SHA exact. Le prochain verrou incontournable est l'intégration indépendante des véritables identités et contrats Keycloak/KYB/Courier en QA contrôlée.

---

## 13 octobre 2026 — F4G / Keycloak 26 réel en laboratoire isolé, partenaire → wallet PostgreSQL 17

**Statut technique : F4G QA signé avec de vrais jetons émis par Keycloak 26.4.7 ÉPHÉMÈRE, mais aucun partenaire ou montant financier réel n'est encore certifié.**

Branche candidate `feat/f4g-real-keycloak-partner-session-qa-20261013` ; [PR #39 DRAFT](https://github.com/adminluxe/DelishAfrica/pull/39) empilée sur #38 F4F puis #37 F4E. Worktree Toshiba et VPS intacts.

**Première triple preuve CI vertes sur le même SHA `21cd567d07ef31a91ed199df299c8bce3c24fd4a` :**

- [Keycloak 26.4.7 + PG17 + tokens et wallets — #38329914958 SUCCESS](https://github.com/adminluxe/DelishAfrica/actions/runs/38329914958).
- [API et trois apps TypeScript — #38329914989 SUCCESS](https://github.com/adminluxe/DelishAfrica/actions/runs/38329914989).
- [PostgreSQL17 et laboratoire finance historique — #38329915018 SUCCESS](https://github.com/adminluxe/DelishAfrica/actions/runs/38329915018).

### F4G réalisé et prouvé

1. **Keycloak binaire officiel 26.4.7** démarré dans un Docker `--network none`, certificat local vérifié, découverte OIDC HTTPS et JWKS signant réellement les JWT des deux comptes marchand et des deux comptes coursier synthétiques. L'API vérifie ces signatures avec son véritable `ExternalJwksVerifierService`, audience/azp/rôles et issuer de test épinglé.
2. Client confidentiel d'**introspection Keycloak éphémère** pour vérifier le statut du token à chaque demande ; `logout` administrateur QA provoque `active=false` puis refus de lecture. Le mot de passe et les clés sont jetables et non journalisés.
3. Session indépendante persistante pendant le seul test via SQL additive `20261013_011_partner_session_qa_only.sql`, indexée par SHA-256 `issuer/sub/sid/jti`, révocable ; attestor SQL peut seulement la lire, jamais la modifier ; rôles Merchant/Courier n'y accèdent pas.
4. `QaWalletVerifiedSessionBridge` F4F joint signature, introspection, session 011, droits contractuels synthétiques, KYB/roster synthétiques, puis ticket SQL F4E `010` lié au backend PostgreSQL. Une violation de n'importe quelle barrière arrête la lecture.
5. Attaques testées : sujet JWT modifié, rôle/app étranger, logout côté Keycloak, session SQL révoquée alors que le JWT reste signé, contrat suspendu, coursier désactivé, SQL de l'attestor hors privilèges. Deux commerçants ont des vues séparées : compte A 18,40 € **synthétiques en retenue**, compte B zéro ; les deux nouveaux coursiers Keycloak n'ont aucune offre attribuée et restent à zéro.
6. Découverte du format `jti` opaque signé Keycloak 26, parfois contenant des deux-points ; filtre borné, aucun logging de valeur et recherche par hachage paramétré. Les refus initiaux ont été corrigés sans supprimer les tests.

### Barrières qui RESTENT NO-GO

- Le Keycloak réellement exécuté est **éphémère et fictif**, pas le realm DelishAfrica utilisé par les clients. Les données de contrats et KYB Merchant et le registre Courier de test sont synthétiques ; aucune liaison juridique à une vraie entreprise/personne.
- Le grant `password` n'est ouvert **que sur les clients de test** ; l'expérience officielle sur appareils doit être certifiée via Authorization Code + PKCE dans G0–G7.
- Le registre 011 n'est pas la vraie infrastructure de révocation Merchant/Courier du domaine : durabilité, multi-régions, HA, sauvegardes, revocation distribuée, audit IAM et attestor isolé restent à produire.
- Aucun fonds, avoir, payout, settlement, Stripe Connect ou transfert juridique réel. **`withdrawableMinor=0` ; `payoutEnabled=false`.**
- Aucun Stripe TEST officiel, Stripe LIVE, migration VPS/production, fusion, EAS payant, soumission Store. Critères G0–G7 et validation expresse demeurent obligatoires.
- Les fonctions Merchant/Dispatch/Courier d'écriture historiques, volontairement révoquées après `010`, doivent être redéveloppées sous attestation avant toute application réelle.

**Passation F4G détaillée :** `docs/DA_PASSATION_F4G_KEYCLOAK_PG_WALLET_QA_2026-10-13.md`. **Signature : F4G-EPHEMERAL-KEYCLOAK-PG17-SYNTHETIC-QA-CERTIFIED-ON-21cd567d / REAL-PARTNERS-NOT-ATTESTED / NO-STRIPE / ZERO-PAYOUT / NO-MERGE / NO-STORE.** Toute évolution sur un autre SHA exige ses propres CI SUCCESS.
