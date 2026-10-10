# DELISHAFRICA — ROADBOOK P5-G : Capture Stripe TEST et finalisation P3

**10 octobre 2026 — laboratoire indépendant uniquement.**

## Statut confirmé

**P5G_STRIPE_TEST_P3_CAPTURE_RESULT=PASS**, exit code 0, un test Node passé, zéro échec, durée 3,38 s.
Aucune clé LIVE utilisée et aucun argent réel encaissé.

- Base Git P5-F : `15c7f33`; branche P5-G : `feature/client-guest-p5g-stripe-capture-lab-20261010`.
- Worktree isolé : `/home/afripayadmin/worktrees/guest-p5g-stripe-capture-lab-20261010`.
- PostgreSQL de laboratoire indépendant : `127.0.0.1:55443`, données locales dans `/home/afripayadmin/guest-checkout-evidence-20261010/pg-lab-p5g`.
- Écriture du test P5-G retrouvée après interruption de Desktop Commander ; syntaxe du fichier Node validée avant exécution.
- Lancement contrôlé par `scripts/da_guest_p5g_capture_real_gate.py` avec SHA-256 épinglé, prévol `P5G_PREFLIGHT_RESULT=PASS`, uniquement `sk_test`, processus exécuté sous compte non-root.

## Verticale testée

1. Session invitée signée HMAC, devis serveur de **21,90 EUR**, coffre privé AES-256-GCM, données de contact synthétiques.
2. Couverture Merchant synthétique et autorisation Ops synthétique, indépendamment contrôlées via PostgreSQL.
3. Réservation Postgres idempotente puis création d'une intention Stripe en mode TEST ; restauration du même Intent.
4. Confirmation côté serveur avec le moyen de paiement fictif Stripe **`pm_card_visa`**, sans PAN réel.
5. Retour Stripe TEST : statut `succeeded`, montant reçu 2 190 centimes TEST.
6. Le service `GuestStripeHttpReader` récupère de nouveau cette intention via l'API Stripe avec la charge développée et vérifie la capture effective, `paid`, `captured`, non remboursé.
7. Signature HMAC de webhook **fabriquée localement pour le test** : une signature incorrecte est rejetée ; une signature locale correcte avec event `payment_intent.succeeded` déclenche le finaliseur P3.
8. Le finaliseur P3 relit lui-même Stripe (ne se fie pas aux seules données du webhook) avant validation atomique de `da_guest_verified_payments`, `da_guest_financial_outbox` et de la session `committed`.
9. Même événement présenté une seconde fois : résultat `duplicate=true`, **un seul paiement confirmé, un seul outbox**, aucun dispatch Merchant/Courier.
10. Journal privé de laboratoire enregistré avant le premier appel Stripe, avec état terminal `test_capture_finance_and_outbox_confirmed`.

## Ce qui est réellement prouvé

- Capture TEST fournisseur réelle et lecture de la charge par Stripe HTTP Reader.
- Transfert transactionnel en laboratoire vers P3, exactement une ligne dans le registre financier et un outbox, sans paiement LIVE.
- Idempotence face à la livraison en double d'un même événement signé **localement**.
- Aucune commande métier n'est libérée dans Merchant ou Courier.

## Ce qui n'est PAS encore prouvé

- **Aucun webhook provenant du système de livraison Stripe n'a été reçu**. La signature a été générée en laboratoire ; il faut tester le endpoint HTTPS et la signature réelle du fournisseur.
- Aucun scénario de chargeback, remboursement ou annulation après clientSecret n'est encore couvert ici.
- Aucune expérience PaymentSheet réelle sur iPhone/Android n'a été testée.
- Approbation Ops et preuve de lieu sont **synthétiques**, aucun restaurant réel.
- Aucun parcours public Client sans Keycloak, aucune migration de production, aucun build EAS ou Store.
- Le test P1–P5-E cumulatif **112/112 PASS** a été relancé au palier précédent P5-F, pas à nouveau par cette seule exécution P5-G.
- La lecture indépendante supplémentaire du journal via un second canal a été limitée par les contrôles d'accès de l'outil distant ; ne pas présenter cette vérification comme réalisée.

## Fichiers complets et reprise

- `services/api-nest/test/guest-stripe-capture.real.postgres.test.cjs` : test de capture complet.
- `scripts/da_guest_p5g_capture_real_gate.py` : lanceur sécurisé de laboratoire, prévol sans capture par défaut ; tout nouvel essai est bloqué si un journal existe.
- Roadbook : `docs/guest-checkout/ROADBOOK_P5G_REAL_TEST_CAPTURE_20261010.md`.
- Architecture : `docs/guest-checkout/ARCHITECTURE_PIN_P5G_REAL_TEST_CAPTURE_20261010.md`.

**Prochain P0 : webhook signé provenant réellement de Stripe, PaymentSheet test sur appareil, puis réconciliation Ops/RBAC et passage Client→Merchant→Courier.**

**L'application Guest Checkout n'est toujours pas activée publiquement. OrchidPay en attente Apple reste inchangé.**
