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

## 9. PALIER P4 - COFFRE ET PREPARATION PRIVEE
- AES-256-GCM dossier Client (coordonnées et contraintes alimentaires) + devis canonique, sans PII en clair en base.
- Le trigger SQL requiert un dossier chiffré avant toute transition payment_pending.
- Finalisation financière confirmée -> préparation privée unique et outbox marquée ready, jamais Merchant/Courier.
- Gate cumulatif : 27/27 PASS sur PostgreSQL lab + Stripe simulé, TypeScript API/Client PASS.
- Détails : docs/guest-checkout/ROADBOOK_GUEST_CHECKOUT_STAGE4_20261009.md.
- Ne pas déployer ni soumettre build iOS/Android tant que le Client guest checkout n'est pas relié et testé.

## 10. PALIER P5-A — CATALOGUE + ADRESSE
- Parcours interne de devis canonique serveur et relecture Google Place + MerchantCoverage pour vérification de zone, sans prix client fiable.
- Réutilise P2 Ledger et P4 PrivateVault, ne touche pas au module alternatif P4.
- Validation sur base Postgres isolée; 8 tests supplémentaires P5-A, cumul 39 tests, gate script P5 = PASS.
- Aucun endpoint guest Stripe ou order n'a été activé.
- Document : docs/guest-checkout/ROADBOOK_GUEST_CHECKOUT_STAGE5A_20261009.md.

## 11. P5-B COUVERTURE MERCHANT FAIL-CLOSED 09-10-2026
- Service de vérification de la desserte publié, confirmé, opt-in explicite par restaurant et approuvé Ops.
- Vérifie le pays + code postal + distance maximum, refuse par défaut en l'absence de couverture.
- Gate 45/45 PASS avec sorties EAS et production strictement intactes.
- Détails : docs/guest-checkout/ROADBOOK_P5B_MERCHANT_COVERAGE_20261009.md.
- Ne pas présenter le Guest Checkout comme accessible aux utilisateurs.

## 12. P5-B APPROBATION OPS INDEPENDANTE — 09/10/2026
- Audit : un simple attribut Ops dans les données éditables par un restaurant peut être forgé.
- Solution : `PostgresGuestCoverageOpsApprovals`, vérification d'empreinte versionnée depuis un registre Ops séparé.
- 52/52 tests cumulés PASS, PostgreSQL lab réel, services Stripe/Google simulés.
- Aucun flux de paiement Guest ni migration PostgreSQL production ni EAS exécuté.
- Pour les nouveaux tests, voir docs/guest-checkout/ROADBOOK_P5B_MERCHANT_COVERAGE_20261009.md.

## 13. P5-C SECURITY ACCEPTANCE GATE
- Une autorisation géographique peut être révoquée ENTRE la création du devis et l'appel Stripe. Recontrôler couverture Merchant+Ops avant l'intention de paiement.
- Étendre les preuves d'adresse/révision dans la charge PII chiffrée de façon versionnée, jamais dans des paramètres de prix fournis par le Client.
- Comparer les deux branches P5B sans écraser leur historique; un seul schéma sera canonique.
- Rapport de contrôle : docs/guest-checkout/P5C_CROSS_BRANCH_SECURITY_REVIEW_20261009.md.

## 14. P5-C OPS GATED — LAB VALIDÉ LE 09/10/2026
- Prototype P5C Stripe reconcilié avec la zone Ops indépendante P5B, sans toucher au worktree parallèle.
- Preuve geographique du panier scellee dans AES et revalidée avec Ops avant/apres Stripe; debit réel interdit.
- 19 tests P5C PASS, cumul P1-P5C 71/71 PASS, TypeScript API/Client PASS. Base PostgreSQL laboratore distincte port 55439.
- Roadbook: docs/guest-checkout/ROADBOOK_P5C_OPS_INTEGRATED_20261009.md.
- Activation Guest Checkout finale toujours NON, aucune route publique ouverte.

## 15. P5-D — RECOVERY & COMPENSATION 09-10-2026
- P5-D a ajouté des annulations Stripe simulées et une quarantaine PostgreSQL en cas de risque de double paiement.
- Scénarios supplémentaires testés : disparition de réseau après création, annulation incertaine, conflit de bail, échec/ACK perdu de COMMIT, expiration de fenêtre idempotente, demande concurrente.
- Gate final P1–P5-D : 82/82 PASS, TypeScript API/Client PASS, PostgreSQL lab 127.0.0.1:55440, sans opération bancaire réelle.
- Il reste nécessaire de construire la reconciliation opérationnelle, l'adaptateur Stripe test, la projection métier et l'UX Guest de production.
- Voir docs/guest-checkout/ROADBOOK_P5D_20261009.md et ARCHITECTURE_PIN_P5D_20261009.md.

## 16. P5-E FINANCIAL OPS RECONCILIATION 09-10-2026
- Le moniteur financier Ops, la file durable PostgreSQL de réconciliation et l'adaptateur Stripe HTTP TEST (non connecté au fournisseur réel) sont validés en laboratoire.
- Vérification P1-P5E : 112/112 tests PASS, TypeScript API et les trois apps PASS, 55441 isolé, zéro paiement externe.
- Aucun worker planifié en production, aucune nouvelle route Guest Checkout publique.
- Roadbook : docs/guest-checkout/ROADBOOK_P5E_20261009.md ; architecture : ARCHITECTURE_PIN_P5E_20261009.md.
- Priorités P0 : Stripe TEST réel sous gestion des secrets, annulation/refund post-secret, console/alertes Ops, commande Merchant/Courier et suivi Guest.

## 17. Stripe TEST externe vérifié — 09/10/2026
Provider GET account, CREATE 0,50 EUR confirm=false, replay même Intent,
GET, CANCEL et GET canceled : PASS sur Stripe TEST réel. Aucun débit.
Dossier journal root-only unique à l'état cancelled.
112/112 tests applicatifs simulés toujours distincts de cette preuve externe.
Le système Guest Checkout n'est toujours pas activé en production.
Voir ROADBOOK_P5E_STRIPE_REAL_PROVIDER_PASS_20261009.md.
