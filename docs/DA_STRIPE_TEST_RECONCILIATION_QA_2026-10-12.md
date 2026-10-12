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
- **Le créateur d'intention côté API et les routes commerciales réelles ne sont PAS raccordés à cette nouvelle migration.** Les anciennes routes `orders/create`, `payments/create-intent` et `/stripe/webhook` restent sur leur ancien chemin. Ne pas présenter le nouvel adaptateur comme actif.
- Le code ne prouve pas encore les réponses réelles aux events refund/dispute, les transferts vers comptes Connect, les frais, soldes/payouts/settlement, ni les parcours iOS/Android.
- Les identifiants de retenue `re_` / `dp_` du laboratoire sont des **marqueurs HMAC locaux**, pas des identifiants de refund/dispute attestés du fournisseur ; la migration finale devra modéliser explicitement les objets Stripe officiels.
- La persistance d'une intention créée chez Stripe mais non enregistrée en DB exige un parcours de récupération spécifique : relecture Stripe sous **même clé d'idempotence**, et blocage/revue manuelle après expiration de sa fenêtre. **Ne jamais inventer une nouvelle clé pour réparer.** Non implémenté dans ce jalon.
- Le rôle PostgreSQL qui peut marquer `paid` constitue une autorité critique : aucune identité mobile, aucun header, aucun body JSON et aucun récepteur webhook simple ne peuvent y accéder.
- Aucun déploiement VPS, aucune migration live, aucun impact Keycloak, Apple, Google, EAS ou Store ; PR DRAFT non fusionnée, aucun Stripe LIVE.

## Ordre de certification restant
- **F0 / CI** : suite SQL vraie sur PG17 isolé, huit concurrents, garde des privilèges, TypeScript, erreurs et jeux de preuves exportés sans secret. Un échec = NO-GO.
- **F1 / Création TEST officielle isolée** : vault/secret local dans un environnement de QA autorisé, clé `sk_test_` et compte épinglé, Idempotency-Key dérivée de la réservation SQL, montant serveur, confirmation manuelle. Prouver timeout fournisseur et reprise sans double PI.
- **F2 / Webhook extérieur et reprise** : point HTTPS QA isolé, secret `whsec_` officiel TEST séparé, vraie signature `Stripe-Signature` et octets bruts, doublons, retrys, erreur PG et dead-letter, pas de PII dans les journaux.
- **F3 / Finance** : réconciliation par API Stripe TEST, charge, refund, dispute, compte, ordre, devis et garde SQL. Reprise après crash, rôle séparé et hold métier.
- **F4 / Routes commerciales** : vraie API Client `/orders/create` + `/payments/create-intent` avec JWT client admis, devis canonique serveur, ClientMutationId idempotent, dispatch interdit avant capture ; guards Merchant/Courier/Ops testés ; aucun contournement guest.
- **F5 / Trois apps et G0–G7** : binaire exact QA iOS/Android, compte réel de QA, menu → panier → paiement TEST volontaire → Merchant → Courier → ETA/livraison → suivi, échecs et retour arrière ; validation utilisateur avant promotion.
- **F6 / Gouvernance** : revue IAM/Keycloak, coffre secrets, Stripe Connect et conformité ; une unique architecture/roadbook de production une fois certifiée.

**État documentaire de cette version : CANDIDAT QA À TESTER.** Les résultats CI ne doivent être annoncés comme PASS qu'après leur exécution sur le SHA exact. G0–G7 et Stripe externe : NO-GO.
