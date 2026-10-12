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

## Ordre de certification restant
- **F0 / CI** : suite SQL vraie sur PG17 isolé, huit concurrents, garde des privilèges, TypeScript, erreurs et jeux de preuves exportés sans secret. Un échec = NO-GO.
- **F1 / Création TEST officielle isolée** : vault/secret local dans un environnement de QA autorisé, clé `sk_test_` et compte épinglé, Idempotency-Key dérivée de la réservation SQL, montant serveur, confirmation manuelle. Prouver timeout fournisseur et reprise sans double PI.
- **F2 / Webhook extérieur et reprise** : point HTTPS QA isolé, secret `whsec_` officiel TEST séparé, vraie signature `Stripe-Signature` et octets bruts, doublons, retrys, erreur PG et dead-letter, pas de PII dans les journaux.
- **F3 / Finance** : réconciliation par API Stripe TEST, charge, refund, dispute, compte, ordre, devis et garde SQL. Reprise après crash, rôle séparé et hold métier.
- **F4 / Routes commerciales** : vraie API Client `/orders/create` + `/payments/create-intent` avec JWT client admis, devis canonique serveur, ClientMutationId idempotent, dispatch interdit avant capture ; guards Merchant/Courier/Ops testés ; aucun contournement guest.
- **F5 / Trois apps et G0–G7** : binaire exact QA iOS/Android, compte réel de QA, menu → panier → paiement TEST volontaire → Merchant → Courier → ETA/livraison → suivi, échecs et retour arrière ; validation utilisateur avant promotion.
- **F6 / Gouvernance** : revue IAM/Keycloak, coffre secrets, Stripe Connect et conformité ; une unique architecture/roadbook de production une fois certifiée.

**État documentaire de cette version : QA PG17/Stripe simulé CERTIFIÉ sur les SHAs de code testés, cf. exécutions CI ci-dessus.** Aucun raccordement fournisseur TEST réel, aucune route publique, aucun test G0–G7 : **NO-GO**. Toute évolution ultérieure exige une nouvelle CI sur son SHA exact.
