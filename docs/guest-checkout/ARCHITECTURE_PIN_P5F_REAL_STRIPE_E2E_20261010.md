# DELISHAFRICA — ARCHITECTURE PIN P5-F / Stripe TEST réel et Guest Checkout

**10 octobre 2026. Statut : laboratoire Stripe TEST, non connecté aux routes publiques.**

## Flux P5-F audité

1. Client de laboratoire : capacité HMAC signée, jamais un compte Keycloak.
2. GuestCheckoutLedger : session persistée et devis canonique, 2190 cents EUR dans PostgreSQL isolé.
3. GuestPrivateFulfillmentVault : contact synthétique, panier et localisation vérifiée synthétique chiffrés avec AES-256-GCM et AAD.
4. GuestMerchantCoverageStrict : contrat Merchant publié synthétique + digest exact + registre PostgreSQL Ops indépendant.
5. GuestStripeIntentReservation : triple lecture d'autorisation et réservation de clé idempotente stable avant Stripe.
6. GuestStripeHttpTestTransport : vrai HTTPS Stripe TEST, clé sk_test en mémoire du worker non-root, CREATE PaymentIntent non confirmé.
7. PostgreSQL : liaison transactionnelle réservation bound / session payment_pending avant tout retour client_secret.
8. GuestStripeIntentReservation appelé de nouveau : RESTORE du même Intent via GET, aucun nouveau CREATE.
9. Annulation réelle Stripe TEST puis GET : canceled confirmé ; après annulation, le service Guest refuse de remettre le client_secret.
10. GuestPaymentReconciliationMonitor : GET Stripe ; intention bound mais remote canceled = operator_action_required / cancellation_binding_conflict.
11. Registre financier P3 et outbox : aucune ligne, aucune livraison émise. Aucun paiement capturé.

## Assurance fournisseur supplémentaire

La paire réelle pk_test/sk_test a été validée via le même PaymentIntent TEST déjà annulé en P5-E. Le secret serveur permet la lecture de référence ; le public accompagné de client_secret permet la même lecture. Les réponses correspondent. Le client_secret a été utilisé uniquement en mémoire sur HTTPS.

## Frontières de confiance vérifiées

- PostgreSQL P5-F indépendant sur localhost:55442, aucune base opérationnelle.
- Transport Stripe connecté au réseau réel uniquement sous NODE_ENV=test et DA_GUEST_STRIPE_TEST_ONLY=1.
- Le lanceur root ne transmet la clé test qu'en mémoire à un subprocess sous l'utilisateur afripayadmin.
- Clé live refusée, hash SHA-256 du script de test épinglé, refus de tout worktree/branche erronés.
- Journal durable écrit et synchronisé avant CREATE, dossier 0700 et journal 0600 ; après panne, réconciliation manuelle et pas de second test automatique.
- Aucune carte, aucune adresse cliente réelle, aucune autorisation bancaire, aucune confirmation ni capture.
- Aucun contrôleur Nest public n'utilise ce laboratoire ; les guards Payments, Orders, Merchant et Courier ne sont pas contournés.
- Aucune modification des binaires iOS/Android ni du Store Apple/Google Play.

## Limites fortes avant le service en production

- Une intention annulée après avoir été bound laisse la commande payment_pending en laboratoire ; le moniteur la classe explicitement en incident Ops. **Ne pas prendre cette démonstration pour un traitement d'annulation métier finalisé.**
- Aucun vrai paiement capturé, webhook Stripe P3 signé en réseau réel ou remboursement test dans cette preuve.
- L'autorisation Ops test est synthétique, pas un accord pour une zone commerciale réelle.
- Le Client public exige encore sa mécanique d'authentification actuelle ; UX sans Keycloak obligatoire non livrée.
- Monitoring d'Ops, scheduler, réseau métier Merchant/Courier et suivi Guest non déployés.
- Revoir les droits PostgreSQL, l'isolement de flux et la gouvernance des secrets avant production.

## Références

Branch Git : feature/client-guest-p5f-real-stripe-lab-20261010.
Worktree : /home/afripayadmin/worktrees/guest-p5f-real-stripe-lab-20261010.
SQL Lab : /home/afripayadmin/guest-checkout-evidence-20261010/pg-lab-p5f.
Roadbook : docs/guest-checkout/ROADBOOK_P5F_REAL_STRIPE_E2E_20261010.md.
Gate : scripts/da_guest_p5f_provider_real_gate.py.
Script répétable sans CREATE Stripe : scripts/da_guest_p5f_safe_one_shot.sh.
Test source complet : services/api-nest/test/guest-stripe-provider.real.postgres.test.cjs.

**P5-F TEST PROVIDER REAL PASS ; Guest Checkout public = BLOQUÉ.**
