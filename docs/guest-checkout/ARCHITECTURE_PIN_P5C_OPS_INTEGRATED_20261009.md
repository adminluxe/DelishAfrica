# DELISHAFRICA — ARCHITECTURE PIN P5-C : STRIPE + OPS GATED

Date : 09/10/2026. Statut : LABORATOIRE, AUCUN DEBIT REEL NI ROUTE GUEST PUBLIQUE.

## Circuit cible

1. Client mobile fournit panier et Place ID, sans montant autoritaire.
2. CatalogOrderPolicyService.quote calcule prix/produits cote serveur.
3. LocationTrustService (Google Places cote serveur) confirme adresse geocodable.
4. GuestMerchantCoverageStrict verifie partenaire actif, zones Merchant et registre Ops independant (hash de revision, date et revocation).
5. GuestCheckoutLedger fige le devis et GuestPrivateFulfillmentVault AES-256-GCM conserve contact, adresse et preuve de position Google (placeId, code postal, GPS, pays).
6. GuestStripeIntentReservation.start valide jeton signe + empreinte PG + preuve AES + couverture actuelle, puis reserve la cle d'idempotence unique dans PostgreSQL.
7. Le serveur REVALIDE l'autorisation juste avant Stripe.createIntent (fournisseur TEST simule dans les tests).
8. Le serveur confirme montant, devise, statut test et metadonnees Stripe, REVALIDE la couverture apres reception, puis COMMIT atomique session et reservation.
9. Seule une reservation BOUND et une approbation encore valide permettent de retourner un clientSecret.
10. P3 : webhook signe, lecture independent Stripe, transaction financiere et outbox; P4 : preparation privee de commande; P5-D/E : Merchant/Courier/tracking, ENCORE A CONSTRUIRE.

## Frontieres de confiance P0

- F1 : aucun montant mobile ne fait autorite.
- F2 : les coordonnees verifiees restent dans un bloc AES-GCM, lie par AAD a orderId et a la quote.
- F3 : Ops reste source d'autorisation independante de la fiche Merchant, la permission expire ou se revoque.
- F4 : cle d'idempotence stable reservee avant toute requete fournisseur; reprise apres timeout sans nouvelle cle.
- F5 : verifier avant ET apres Stripe; aucun secret n'est remis si permission invalidee pendant l'appel.
- F6 : trigger SQL refuse PAYMENT_PENDING si dossier livreur non scelle.
- F7 : P5-C est bloque si NODE_ENV=production et si DA_GUEST_STRIPE_TEST_ONLY different de 1.
- F8 : aucun controle Guest ne contourne les guards OIDC Merchant, Courier, Orders et Payments.

## Risques residuels qui bloquent l'activation publique

A. Revocation apres remise du clientSecret : un utilisateur avec un ancien secret pourrait encore payer. Exiger annulation/compensation Stripe cote serveur, puis gestion de l'eventuel paiement confirme.
B. Intent cree puis perte de connexion ou conflit de commit PostgreSQL : reconciliation fournisseur, annulation/reprise et extinction securisee meme apres expiration de l'historique idempotent Stripe.
C. Aucun appel Stripe reel meme mode test n'a encore ete execute depuis ce service; pas de preuve d'integration API publique.
D. Gouvernance effective des zones et workflow de validation/revocation Ops RBAC a developper.
E. Creation durable des vraies commandes et leur projection Merchant/Courier, suivi Client prive et remplacement Keycloak non livres.
F. Pas de migration PG production, build EAS, OTA ni publication Store effectues.

## Verification

Branche : feature/client-guest-p5c-ops-integrated-20261009
Worktree VPS : /home/afripayadmin/worktrees/guest-p5c-ops-integrated-20261009
Base de test dediee : PostgreSQL 16 local, 127.0.0.1:55439.
Gate : scripts/da_guest_checkout_p5c_ops_gate.sh
Preuve : /tmp/da_guest_p5c_ops_gate_20261009_FINAL.log
Tests : 71/71 en laboratoire, Stripe et Google Places simules, TypeScript API/Client valides.
Roadbook : docs/guest-checkout/ROADBOOK_P5C_OPS_INTEGRATED_20261009.md

Statut reel : P5-C LAB PASS, Guest Checkout public NON.
