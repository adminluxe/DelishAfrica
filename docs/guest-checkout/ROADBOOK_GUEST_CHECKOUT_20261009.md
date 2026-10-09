# DELISHAFRICA — ROADBOOK DE CHANTIER GUEST CHECKOUT
Date : 9 octobre 2026 (Europe/Brussels).
Périmètre : Client, API NestJS, Stripe. Merchant/Courier/Ops préservés.
Statut : PALIER 1 CODÉ ET TESTÉ, PAIEMENT INVITÉ NON ENCORE BRANCHÉ, AUCUN DÉPLOIEMENT.

## 0. Origine
Vidéo de test Client + retours d'une testeuse sur la double saisie de coordonnées et l'obligation de connexion Keycloak après « Mon espace ». Audit a confirmé le blocage simultané dans `apps/client/utils/daOrdersApi.ts`, `apps/client/app/checkout-preflight.tsx`, `PaymentsAuthGuard` et `OrdersAuthGuard`. Le paiement réel est attaché à un principal OIDC ; contourner les guards serait une faille.

## 1. Dépôt et isolation
- Repo réellement utilisé : `/opt/delishafrica/monorepo` (branche de travail active **sale**, Confluence/financial-state non committé).
- Worktree isolé : `/home/afripayadmin/worktrees/guest-checkout-secure-20261009`.
- Branche : `feature/client-guest-checkout-secure-20261009`.
- Baseline : `e504c04` depuis innovation/confluence-trust-current-20261001 ; cette branche peut nécessiter réconciliation avec les travaux financiers actuels avant intégration.
- Aucun code source, configuration, instance API, cache Expo, build Store ou environnement de production n'a été changé.
- Dépendances TypeScript de la baseline partagées en liens symboliques de lecture avec le repo actif ; aucune installation npm/pnpm ni mutation du répertoire des dépendances.

## 2. PALIER 1 — Réalisé
- Nouveau `services/api-nest/src/guest-checkout/guest-capability.ts` : jeton court signé HMAC SHA-256, capacité de portée **une commande**, ID de commande et clé d'idempotence générés côté serveur, expiration 4 heures, aucune donnée personnelle en claims ; secret requis >=32 octets encodé en base64url. Ce jeton est signé mais PAS chiffré ni opaque ; l'identifier comme **capacité préliminaire**, pas comme identité citoyenne prouvée.
- Nouveau `guest-session.service.ts` : création de session de prévisualisation à usage développeur, rate-limit local 8/h/IP pour démonstration, refus systématique en environnement `NODE_ENV=production`.
- Nouveau `guest-session.controller.ts` + `guest-checkout.module.ts` : route de santé + prévisualisation seulement, **ne branche pas Stripe ni les endpoints commandes**. Prévisualisation activée seulement avec `DA_GUEST_CHECKOUT_PREVIEW=1` ET clé solide ET environnement hors production. Aucun de ces drapeaux n'a été configuré.
- Module importé dans `services/api-nest/src/app.module.ts`, sur branche uniquement.
- `apps/client/ui/water/WaterRadarV2.tsx` : texte du Radar clarifie « commandables » / « en veille non commandable » en gardant le placement, les animations, les contrôles et le rendu.
- Tests unitaires du jeton : 4 PASS ; tests de scellement production et de limite preview : 3 PASS ; total **7/7**.
- Référence TypeScript API avant modifications : PASS. TypeScript API et Client après corrections : PASS, sous réserve du dernier gate script.

## 3. RESTE À FAIRE — PALIERS 2 À 5
**P2 — Checkout guest session en API (bloquant)**
- Décider stockage persistant des sessions et jetons de récupération dans PostgreSQL ; stocker seulement empreintes cryptographiques, chiffrer les coordonnées nécessaires, rotation/révocation, limiter abus avec un limiteur partagé entre instances.
- Associer un invité à un ID de commande serveur et au panier autorisé, sans déduire l'identité d'un e-mail ou clientId fourni par le mobile.
- Les opérations Merchant/Courier/Ops doivent refuser un bearer invité ; accès à une commande précise seulement.
- Conserver une connexion Keycloak facultative pour les clients qui veulent un historique multi-appareils, jamais obligatoire pour la première commande.

**P3 — Stripe et commit serveur fiable (critique)**
- Le montant est calculé et contrôlé sur le serveur à partir du vrai catalogue et de l'adresse livrable ; pas du montant demandé par l'app.
- Créer une PaymentIntent avec idempotence forte et liaison session guest + commande + panier + montant + devise ; vérification en lecture depuis Stripe.
- Le webhook signé doit pouvoir déclencher **un seul commit de commande durable** même si le téléphone est éteint ; reprises, concurrence/rejeux webhooks et cas refund/dispute doivent conserver le même invariant.
- Intégrer la nouvelle persistance financière PostgreSQL existante avec soin : elle est aujourd'hui **non committée sur la branche active**, et n'est PAS dans ce worktree basé sur HEAD.
- Aucun vrai paiement en tests automatisés ; doubles débits interdits.

**P4 — Application Client sans écran de connexion forcé**
- Conserver Mon espace et panier, démarrer une session invitée sécurisée au checkout puis payer sans Keycloak.
- Faire persister la capacité dans SecureStore en limitant sa durée et sa portée ; récupération des commandes via un jeton de suivi spécifique, jamais via simple orderId.
- Ne pas changer le profil visuel Premium ni les apps professionnelles.
- Gérer manque de connexion, expiration, abandon, retour de Stripe, app fermée, réouverture, migration depuis l'ancien compte et suppression des données.

**P5 — Qualité, publication et preuve**
- Tests négatifs P0 : contrefaçon, session expirée, commande d'autrui, rôle marchand/coursier, panier malveillant, prix modifié, webhook modifié, retries concurrents, 2 debits, poste paiement avant commit, app fermée.
- Tests non-régression P1 : iOS/Android, minimum de commande, adresses, allergènes, notifications et suivi ETA.
- Mettre à jour fiche confidentialité et wording de Mon espace selon le comportement réellement livré.
- Préparer build seulement après validation manuelle et autorisation de publication. En attendant ne pas toucher aux versions en revue chez Apple/Google.

## 4. Critères de fin de chantier
1. Un Client avec profil admissible peut commander et payer sans compte Keycloak.
2. Aucune commande n'est créée sans paiement confirmé côté Stripe.
3. Aucun paiement confirmé ne reste perdu même en cas de crash client.
4. Aucune capacité invitée ne permet de lire/modifier une autre commande ni d'agir en Merchant/Courier/Ops.
5. Les 3 apps, leur dispatch et leur suivi restent fonctionnels.
6. Gate build + tests P0/P1 + roadbook/architecture mise à jour + revue avant soumission.
**À CE JOUR CES CRITÈRES NE SONT PAS ENCORE ATTEINTS.**

## 5. Références / preuve
Source du constat : `/home/tontoncestcarre/Téléchargements/POG_ANDROID_BETA_14J_20261009/DA_CLIENT_AUTH_RADAR_FORENSIC_20261009.md`.
Tests source : `services/api-nest/test/guest-capability.test.cjs` et `guest-session.service.test.cjs`.
Workflow de validation : `scripts/da_guest_checkout_stage1_gate.sh`.
Pas de secrets, credentials, données testeurs ni numéros bancaires dans les logs ou documents.

## 6. SCELLAGE PALIER 1 — 09/10/2026
Exécution officielle du script `scripts/da_guest_checkout_stage1_gate.sh` dans le worktree isolé, sans production.
`FINAL_DA_GUEST_CHECKOUT_STAGE1_GATE=PASS`, code de sortie 0.
- Tests jeton (4) + scellement Preview (3) = 7 PASS / 0 FAIL.
- `pnpm --dir services/api-nest exec tsc --noEmit --incremental false` : PASS.
- `pnpm --dir apps/client exec tsc --noEmit --incremental false` : PASS.
- Contrôles de présence OrdersAuthGuard/PaymentsAuthGuard : PASS.
- `git diff --check` : PASS.
Log VPS : `/tmp/da_guest_stage1_gate_20261009.log`.
**Décision : gate de fondation PASS, gate de livraison Guest Checkout FAIL/PENDING (pas encore de parcours paiement invité).**

## 7. MISE A JOUR P2 - 09/10/2026
- Le ledger PostgreSQL d'invité est codé et simulé avec 5 tests supplémentaires.
- Migration SQL uniquement préparée ; stockage réel non encore testé ni activé.
- Gate consolidé PASS 12/12 ; ne pas confondre avec un Guest Checkout fonctionnel.
- Rapport d'étape : docs/guest-checkout/ROADBOOK_GUEST_CHECKOUT_STAGE2_20261009.md.
- Prochaine porte P3 : catalog policy authoritative + Stripe + commit postgres outbox unique + tests DB réels.

## 8. PALIER 3 — FINANCIER LAB
- 6 scénarios d’intégration via Postgres isolé, réponses Stripe simulées, transactions sérialisées et rollback.
- Code sécurisé mais aucune nouvelle route publique. P4 reste indispensable.
- Rapport : docs/guest-checkout/ROADBOOK_GUEST_CHECKOUT_STAGE3_20261009.md.

## 9. PALIER 4 — VAULT
- Coffre chiffré et préparation du devis avec transaction PG testée, non déployée.
- Rapport P4 : docs/guest-checkout/ROADBOOK_GUEST_CHECKOUT_STAGE4_20261009.md.
