# DELISHAFRICA — ROADBOOK P5-F : Guest Checkout × Stripe TEST réel

**Date : 10 octobre 2026, Europe/Brussels.**
**Statut : validation fournisseur P5-F PASS en laboratoire isolé ; Guest Checkout public NON OUVERT.**

## Git et environnements isolés

- Branche : feature/client-guest-p5f-real-stripe-lab-20261010
- Worktree VPS : /home/afripayadmin/worktrees/guest-p5f-real-stripe-lab-20261010
- Baseline : fbf2ee4, P5-E Stripe TEST provider audit.
- Dépôt de production à protéger : /opt/delishafrica/monorepo, HEAD e504c04, modifications Confluence préexistantes, NE PAS RESET.
- PostgreSQL 16 privé : /home/afripayadmin/guest-checkout-evidence-20261010/pg-lab-p5f, 127.0.0.1:55442.
- Journal de la sonde : /home/afripayadmin/guest-checkout-evidence-20261010/p5f-provider-intent-journal, propriétaire de laboratoire, répertoire 0700 et fichier 0600.
- Clés existantes : sk_test et pk_test dans les deux fichiers .env serveur protégés 0600, jamais recopiées ou affichées.

## P5-F étape 1 — Validation réelle de la paire de clés Stripe

À partir de l'intention TEST déjà annulée lors de P5-E :
1. GET PaymentIntent authentifié avec la clé secrète sk_test.
2. Récupération du client_secret en mémoire du processus VPS, sans stockage ni affichage.
3. GET du même PaymentIntent avec la clé publique pk_test et le client_secret dans la requête HTTPS.
4. Même identifiant, devise, montant, livemode=false et état canceled.

**Verdict : TEST_PUBLIC_PRIVATE_KEY_PAIR_MATCH=PASS.**
Aucun nouvel Intent créé pendant cette étape.
Référence Stripe : https://docs.stripe.com/api/payment_intents/retrieve

## P5-F étape 2 — Véritable service Guest Checkout × Stripe TEST

Le service GuestStripeIntentReservation de DelishAfrica est instancié avec GuestStripeHttpTestTransport réel et un PostgreSQL 16 indépendant :

1. Session invitée signée HMAC et devis backend synthétique de 21,90 EUR scellés dans PostgreSQL.
2. Dossier de livraison **synthétique** protégé AES-256-GCM ; preuve de lieu Google **synthétique** de laboratoire, pas d'adresse client réelle.
3. Zone Merchant **synthétique** et approbation Ops PostgreSQL indépendante vérifiée avant l'appel.
4. Clé d'idempotence créée et verrouillée dans PostgreSQL avant tout appel Stripe.
5. Stripe réel en mode TEST : création d'un PaymentIntent de 21,90 EUR SANS CARTE, SANS CONFIRMATION, et liaison commande payment_pending / réservation bound.
6. Nouvel appel au même service Guest avec le même jeton : restauration de la même intention (GET, pas de seconde création).
7. Annulation Stripe via l'adaptateur réel et relecture GET : statut canceled.
8. Refus de restaurer la même intention après son annulation : already_progressed_reconcile.
9. Moniteur Ops GuestPaymentReconciliationMonitor classe l'incohérence d'un Intent lié puis annulé en operator_action_required (code cancellation_binding_conflict).
10. Zéro enregistrement de paiement confirmé et zéro sortie dans l'outbox financier ; zéro commande métier Merchant/Courier créée.

**Verdict : P5F_REAL_STRIPE_GUEST_E2E_RESULT=PASS.**
**Montant de l'intention de test : 21,90 EUR ; montant encaissé : 0,00 EUR.**
Le fichier de test complet a passé le compilateur de syntaxe Node, un test de bout en bout, zéro échec.

### Relecture Stripe indépendante et journal

Une deuxième procédure indépendante a consulté le journal privé et l'API Stripe TEST :
P5F_INDEPENDENT_RECONCILIATION=PASS ; status canceled ;
livemode=false ; amount=2190 ; devise EUR ;
même commande synthétique et empreinte de devis ;
aucune méthode de paiement ; aucune charge.
Un seul journal de test a été créé, permissions 0600.
Aucun ID d'intention, client_secret, secret API, adresse personnelle ou numéro de carte ne figure dans ce roadbook.

## Sources complètes

- services/api-nest/test/guest-stripe-provider.real.postgres.test.cjs — test complet de la verticale P5-F.
- scripts/da_guest_p5f_provider_real_gate.py — prévol, vérification SHA-256 et exécution contrôlée via compte de laboratoire non-root.
- docs/guest-checkout/ROADBOOK_P5F_REAL_STRIPE_E2E_20261010.md — ce document.
- docs/guest-checkout/ARCHITECTURE_PIN_P5F_REAL_STRIPE_E2E_20261010.md — architecture.
- Rapport sur le Toshiba : /home/tontoncestcarre/Téléchargements/DA_P5F_REAL_PROVIDER_INTEGRATION_20261010/P5F_GUEST_STRIPE_REAL_E2E_20261010.report.txt.

## Commande Tonton : prévol en lecture seule

Depuis le terminal Toshiba :

ssh purplecrm-vps 'bash /home/afripayadmin/worktrees/guest-p5f-real-stripe-lab-20261010/scripts/da_guest_p5f_safe_one_shot.sh'

Le script relance et arrête seulement son PostgreSQL isolé si nécessaire, puis inspecte le journal annulé ; aucun appel CREATE/CANCEL Stripe. IMPORTANT : ne pas ajouter --execute pour rejouer le test. Le journal unique bloque toute nouvelle création sans intervention opérateur et nouvelle procédure de récupération.

## Risques ouverts avant toute activation publique

- Les zones et le Google Place sont synthétiques : aucune approbation de restaurant réel.
- Pas encore de capture Stripe TEST confirmée, ni de webhook signé réel testé dans le chemin Guest → P3.
- Pas encore de PaymentSheet complet validé sur iPhone et Android.
- Le parcours Client sans Keycloak obligatoire ne peut pas encore être ouvert.
- Il faut gérer une révocation Ops après remise du client_secret, les remboursements, litiges et paiements déjà capturés.
- Il faut réaliser la console Ops RBAC, ses alertes durables et les commandes métier Merchant/Courier.
- Aucun déploiement, migration de production, fusion dans le dépôt actif, OTA, build ou resoumission Store.

**Décision : fondation P5-F validée sur Stripe TEST réel en laboratoire, pas encore en production.**
