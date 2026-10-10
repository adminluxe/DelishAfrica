# DelishAfrica — P5-E : preuve réelle Stripe TEST (9 octobre 2026)

**État :** FOURNISSEUR STRIPE TEST VALIDÉ · AUCUN PAIEMENT ENCAISSÉ · AUCUN DÉPLOIEMENT.

## Opération effectivement exécutée

**Heure Stripe/vérification VPS (UTC)** : 2026-10-09 à 19:06:58.

- Le Toshiba s'est reconnecté et le SSH `purplecrm-vps` fonctionne de nouveau.
- Le dépôt applicatif canonique `/opt/delishafrica/monorepo` conserve son commit `e504c04`, et la branche isolée P5-E conserve `635b3f8`.
- Le Python de sonde a été reconstruit sur le Toshiba et son SHA-256 complet correspond **exactement** au pack testé : `17781568cad9301c0ff602dfac77747a0517ef6813a1c8267dc0b933153769cc`.
- Le prévol sécurisé lit uniquement les deux fichiers serveur `.env` en lecture `0600`, sans afficher les valeurs : `DRY_RUN_PASS`.
- La configuration des secrets concorde sur les deux fichiers protégés. `PAYMENTS_MODE=stripe_test`; empreintes de comparaison courtes du secret `7c45d2a09755` et du public `ad0691c08ea4`.
- **Stripe réel** : `GET /v1/account` avec la clé `sk_test` côté VPS => `AUTHENTICATED`.
- **Stripe réel** : `POST /v1/payment_intents`, montant 50 centimes d'euro, devise EUR, `confirm=false`, moyen de paiement non fourni => `CREATE_TEST_INTENT=PASS`.
- Même requête et même clé d'idempotence => **même identifiant Stripe** (`IDEMPOTENT_REPLAY_SAME_ID=PASS`).
- Lecture `GET /v1/payment_intents/{id}` => `GET_TEST_INTENT=PASS`.
- Annulation `POST /v1/payment_intents/{id}/cancel` => `CANCEL_TEST_INTENT=PASS`.
- Nouvelle lecture directe Stripe => statut **`canceled`** (`FINAL_GET_STATUS=canceled`).
- Aucun `payment_method` associé, aucune confirmation de paiement et aucune capture : `REAL_MONEY_RECEIVED=0`.
- Verdict fournisseur complet : **`P5E_STRIPE_TEST_RESULT=PASS`**, shell code retour 0.

Ce résultat est une vraie validation réseau fournisseur et non une simulation. Il ne concerne **que Stripe TEST**. Aucun secret n'a été exporté, aucun paiement LIVE effectué.

## Journal et reprise

Un seul dossier de la sonde existe et il est **`cancelled`**, vérifié indépendamment dans le fichier journal root-only.

- Journal distant : `/var/lib/delishafrica-stripe-test-provider-probe/stripe-test-20261009T190658Z-7627796d.json`, propriété root, permissions **0600**.
- Répertoire journal root : `/var/lib/delishafrica-stripe-test-provider-probe`, permissions 0700.
- Rapport Toshiba : `/home/tontoncestcarre/Téléchargements/DA_P5E_STRIPE_PROVIDER_TEST_20261009/DA_P5E_STRIPE_REAL_TEST_20261009.report.txt`.
- Wrapper relançable (prévol PAR DÉFAUT) : `/home/tontoncestcarre/Téléchargements/DA_P5E_STRIPE_PROVIDER_TEST_20261009/TONTON_P5E_STRIPE_VPS_ONESHOT.sh`.
- Script complet : `/home/tontoncestcarre/Téléchargements/DA_P5E_STRIPE_PROVIDER_TEST_20261009/TONTON_P5E_STRIPE_TEST_ONLY.py`.
- Le wrapper passe aussi un second prévol complet `DRY_RUN_PASS`.

## Gate de sûreté pour les prochains usages

- Le script impose un secret de type `sk_test`, la configuration `stripe_test`, et refuse `NODE_ENV=production`.
- Il nécessite l'opt-in explicite `RUN_REAL_STRIPE_TEST=YES` pour créer de **nouvelles** intentions non confirmées et les annuler.
- Il écrit une trace persistante root-only **avant** l'appel CREATE et refuse de recommencer en présence d'un journal de sonde non résolu.
- Une interruption inconnue de CREATE interdit une nouvelle exécution sans revue opérateur. Une annulation non vérifiée doit être recherchée dans le compte Stripe TEST avec l'ID et les métadonnées protégées dans le journal.
- Ne jamais imprimer, déplacer vers Git, le Toshiba ou un log la clé `sk_test`.
- Le serveur de production, les bases de données de production, les apps Client/Merchant/Courier et les builds Stores sont intacts.

## Ce qui n'est PAS validé par cette preuve

1. Les clés `pk_test` et `sk_test` ont-elles été émises sur le même compte Stripe ? **Pas encore confirmé explicitement**, bien que leurs configurations concordent.
2. Le SDK Stripe PaymentSheet réel iOS ou Android, le paiement effectivement autorisé/capturé, les webhooks signés, les remboursements et les litiges ne sont **pas** couverts.
3. La connexion du provider au vrai chemin invité P5-E n'est pas déployée ; la suite P1–P5-E reste fondée sur **112 tests en laboratoire**, tandis que la présente sonde éprouve uniquement les endpoints Stripe TEST.
4. Aucun worker Ops durable, aucun dispatch métier Merchant/Courier et aucun parcours Client sans Keycloak ne sont publiés.
5. OrchidPay B12 fait l'objet d'une réponse envoyée par le propriétaire à Apple ; son dossier App Store doit rester indépendant de Stripe TEST DelishAfrica.

## Décision d'ingénierie

**P5-E/Stripe TEST : étape externe CREATE → GET → CANCEL validée** ; l'étape suivante est l'intégration avec le module Nest invité **dans une branche isolée**, suivi du contrôle de l'identité de la paire de clés, de PaymentSheet iOS/Android, des webhooks et du registre Ops. Maintenir le blocage production.

Aucune migration de production, aucun build EAS, aucune OTA, aucun merge sur le dépôt canonique et aucune action App Store/Google Play.

## SUITE 2026-10-10 — P5-F STRIPE GUEST END-TO-END

L'intégration ne se limite plus à la sonde P5-E autonome : sur une branche séparée P5-F, GuestStripeIntentReservation a réellement créé puis récupéré le même PaymentIntent Stripe TEST via StripeHttpTestTransport depuis une commande backend synthétique et une base PostgreSQL dédiée. Annulation GET canceled, sans carte ni charge. Le moniteur Ops détecte l'incohérence de la session bound annulée et n'émet aucun ordre métier. Paire publique/privée également prouvée. Voir ROADBOOK_P5F_REAL_STRIPE_E2E_20261010.md. La production Guest reste NON activée.
