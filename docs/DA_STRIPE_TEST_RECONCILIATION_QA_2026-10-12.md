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

## Ordre de certification restant
- **F0 / CI** : suite SQL vraie sur PG17 isolé, huit concurrents, garde des privilèges, TypeScript, erreurs et jeux de preuves exportés sans secret. Un échec = NO-GO.
- **F1 / Création TEST officielle isolée** : vault/secret local dans un environnement de QA autorisé, clé `sk_test_` et compte épinglé, Idempotency-Key dérivée de la réservation SQL, montant serveur, confirmation manuelle. Prouver timeout fournisseur et reprise sans double PI.
- **F2 / Webhook extérieur et reprise** : point HTTPS QA isolé, secret `whsec_` officiel TEST séparé, vraie signature `Stripe-Signature` et octets bruts, doublons, retrys, erreur PG et dead-letter, pas de PII dans les journaux.
- **F3 / Finance** : réconciliation par API Stripe TEST, charge, refund, dispute, compte, ordre, devis et garde SQL. Reprise après crash, rôle séparé et hold métier.
- **F4 / Routes commerciales** : vraie API Client `/orders/create` + `/payments/create-intent` avec JWT client admis, devis canonique serveur, ClientMutationId idempotent, dispatch interdit avant capture ; guards Merchant/Courier/Ops testés ; aucun contournement guest.
- **F5 / Trois apps et G0–G7** : binaire exact QA iOS/Android, compte réel de QA, menu → panier → paiement TEST volontaire → Merchant → Courier → ETA/livraison → suivi, échecs et retour arrière ; validation utilisateur avant promotion.
- **F6 / Gouvernance** : revue IAM/Keycloak, coffre secrets, Stripe Connect et conformité ; une unique architecture/roadbook de production une fois certifiée.

**État documentaire de cette version : QA PG17/Stripe simulé CERTIFIÉ sur les SHAs de code testés, cf. exécutions CI ci-dessus.** Aucun raccordement fournisseur TEST réel, aucune route publique, aucun test G0–G7 : **NO-GO**. Toute évolution ultérieure exige une nouvelle CI sur son SHA exact.
