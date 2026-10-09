# DELISHAFRICA — ROADBOOK GUEST CHECKOUT P5-A : DEVIS + ADRESSE SERVEUR
Date : 09 octobre 2026, Europe/Brussels
**Statut : TESTÉ EN LABORATOIRE UNIQUEMENT — AUCUN CHECKOUT PUBLIC NOUVEAU**
Branche indépendante : `feature/client-guest-checkout-p5-20261009`.
Worktree VPS : `/home/afripayadmin/worktrees/guest-checkout-p5-20261009`.
Parent : `c722cf6`, consolidation P4 canonique 31 tests.

## Contexte et vrai problème utilisateur
« Mon espace » Client accepte des coordonnées, mais le paiement et la création de commande exigent toujours un jeton Keycloak. Objectif : parcours sans compte obligatoire, sans ouvrir les guards OIDC existants.

## Première intégration métier P5-A codée
`services/api-nest/src/guest-checkout/guest-canonical-checkout-stager.ts`
- Reçoit un jeton guest P1 déjà signé/persisté, panier (items/quantités), Place ID et coordonnées/consentement.
- Vérifie l'autorisation guest **avant** les appels potentiellement facturables au catalogue/Google.
- Transmet au devis `CatalogOrderPolicyService.quote()` seulement le partenaire et les items/quantités ; tout prix mobile est ignoré.
- Doit utiliser côté serveur `LocationTrustService.resolve({placeId}, requesterKey)` pour relire les données authentiques Google Places, sans croire la copie mobile `addressTruth`.
- Exige adresse `confirmed`, `deliverable`, preuve `google_places_new`, précision numéro de rue/bâtiment, coordonnées et code postal de Bruxelles couverte : **premier périmètre conservateur de lancement, pas international**.
- Exige en plus la décision du service de couverture du restaurateur (`ServerCoveragePolicy.verifyCoverage`) : cette politique doit être fondée sur des données métier réelles. **Pas de raccourci acceptant l'avis du téléphone.** L'implémentation professionnelle de ce service reste À FAIRE.
- Remplace l'adresse et la ville déclarées par l'adresse/vile authentifiées par le fournisseur.
- Fige le devis dans P2 (ISSUED->QUOTED), puis scelle P4 (AES-256-GCM), en conservant la reprise idempotente si l'app est interrompue entre les deux étapes.
- Le trigger P4 interdit de lier le paiement tant que le dossier chiffré n'existe pas.
- Retourne uniquement un statut, un montant/currency canonique, l'ordre, le partenaire et la zone autorisée ; `paymentAvailable:false`.
- **Aucun endpoint HTTP n'est ajouté, aucun Stripe Intent n'est créé et Merchant/Courier ne reçoivent rien.**

## Tests P5-A
`services/api-nest/test/guest-canonical-checkout.postgres.test.cjs`, PostgreSQL de laboratoire réel, catalogue et Google Places simulés :
1. un montant frauduleux à 1 € est ignoré ; la véritable adresse Google prévaut sur l'adresse fictive saisie ;
2. mauvais jeton refusé avant tout appel externe ;
3. fausse confirmation géographique, code postal hors zone, preuve incorrecte ou précision insuffisante refusés ;
4. serviceArea restaurateur refusée => pas de commande ;
5. retry identique sans second dossier ni modification ;
6. items invalides/doublons refusés ;
7. devis changé non substituable après scellement ;
8. consentement manquant: session figée mais Intent interdit par trigger, puis reprise possible.
**8/8 PASS** en test ciblé.

## Critères techniques
- Gate `scripts/da_guest_checkout_stage5_gate.sh` : rejoue P1/P2/P3/P4 canonique+alternatif/P5, contrôle PostgreSQL 127.0.0.1:55438, guards, TypeScript, diff.
- Total attendu : **39/39 tests** après gate consolidé.
- Le code ne lit ni n'écrit la base production, n'appelle pas le vrai fournisseur Google, n'émet pas de paiement réel.
- Pas de rebuild EAS ni de modification des versions en revue.

## Étapes bloquantes restantes P5-B à P5-F
1. Couverture réelle `ServerCoveragePolicy` par partenaire, avec périmètre géographique confié au commerçant. Ne pas autoriser simplement tout Bruxelles.
2. Authentification invitée publique sûre + limites partagées, activation conditionnelle contrôlée; détails PII dans logs interdits.
3. Création Stripe PaymentIntent avec clé d'idempotence stable, quote autoritaire, métadonnées canoniques et gestion d'Intent orphelin.
4. Branchement finalizer signé P3 à l'API réelle + reconciler persistant + alertes ; Stripe test mode.
5. Projection commandable Merchant/Courier sous autorisation pro et transaction/outbox, notification, résolution stock et suivi Client par droit privé distinct.
6. Client mobile : `Mon espace -> Payer -> Suivre`, sans redirection Keycloak, avec reprise après fermeture ; QA iOS/Android, E2E et sécurité/résilience/observabilité.
7. Consolidation avec le module financier Postgres actif **non committé** ; garder la baseline de production protégée.
8. Publication stores uniquement après revue du gate complet et validation.

**Vérité : nous avons validé l'entrée du futur checkout invité, pas encore son paiement ou son suivi.**

## Validation finale du gate P5-A — 09/10/2026
- Gate lancé dans le worktree indépendant : `bash scripts/da_guest_checkout_stage5_gate.sh`.
- Verdict lu dans le log : `FINAL_DA_GUEST_CHECKOUT_STAGE5_GATE=PASS` (code sortie 0), 39 tests cumulés / 39 réussis.
- API + Client TypeScript sans erreur, vérification du trigger PostgreSQL actif et guards OIDC existants préservés.
- Log de preuve VPS : `/tmp/da_guest_stage5_gate_20261009.log`.
- Test Google Places et catalogue simulés, PostgreSQL laboratoire réel, Stripe simulé. Aucun débit, publication ni déploiement.
- Ce jalon est l'entrée validée du futur checkout invité, PAS un checkout sans Keycloak fonctionnel en production.
