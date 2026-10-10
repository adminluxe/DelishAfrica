# DELISHAFRICA ROADBOOK UPDATE - GALA COMBO 22 R1 - QUIET LUXURY / OPTICAL RHYTHM
Date: 20260920_202116
Repo: /opt/delishafrica/monorepo
HEAD: 69b46bae228835eea2f2d9e4379815d40e2d44bd

## Terrain Combo 21 - Video QA
- Trois vidéos iPhone revues : Merchant ~55.8 s, Client ~76.0 s, Courier ~61.2 s.
- Combo 21 est un PASS très fort : Client Orders a rejoint l'univers teal, Merchant Control room est cohérent, Courier reste l'étalon.
- Le prochain plafond n'est plus une incohérence : c'est la micro-fatigue de quelques bordures, ombres et surfaces trop présentes.
- Contrainte finale : aucun alourdissement runtime. Combo 22 est donc un pass 100% styles statiques, sans nouveau composant, timer, animation ou dépendance.

## Combo 22 R1
- Shared GlassCard 3 apps : edge 0.75 -> 0.6, shadow 0.055 -> 0.04, elevation 2 -> 1, shadow plus diffus.
- Client Orders : décor statique, hero, ivory, gold et cartes d'actions respirent davantage ; bordures moins présentes.
- Merchant Control room : les quatre décors statiques deviennent presque subliminaux ; hero et surfaces profondes gagnent en perméabilité ; bords neutres réduits.
- Courier Auth : micro-polish uniquement, pour conserver l'étalon sans le sur-travailler.
- Aucune vue ajoutée, aucune animation ajoutée, aucune logique métier touchée.

## PASS contract
- Zéro coût runtime structurel supplémentaire.
- Les surfaces doivent paraître plus calmes et plus chères, sans devenir molles ni manquer de contraste.
- Client et Merchant doivent se rapprocher encore de la sérénité de Courier.
- Les actions principales restent immédiatement lisibles.
- Auth/OIDC, API, Stripe, Dispatch, Orders state machine, Route Oracle business logic, Store metadata et EAS/native build restent FROZEN.

---

# DELISHAFRICA ROADBOOK UPDATE - 2026-10-01 - CONFLUENCE TRUST CURRENT V1
Branch: innovation/confluence-trust-current-20261001
Scope: Client + Courier, harmonisé Merchant

## Intention
- Ne pas copier le marché des chatbots de commande ou assistants bavards.
- Faire de l IA un courant silencieux, explicable et réversible : elle doit gagner la confiance par les preuves, pas par l autorité.
- Aucun automatisme métier ajouté. Aucun choix utilisateur remplacé.

## Innovation livrée - Trust Current / Boucle de vérité
- Confluence Oracle expose maintenant le moteur réellement utilisé : IA bornée, serveur déterministe ou lecture embarquée.
- Le nombre exact de preuves utilisées est visible, sans inventer de score de confiance.
- L incertitude est affichée comme FAITS / ESTIMATIONS / PREUVES FAIBLES.
- Les preuves citées par l IA sont distinguées des signaux seulement visibles : UTILISÉE vs VISIBLE.
- Une Boucle de vérité indique quels signaux contextuels ou estimés pourraient faire changer la recommandation.
- L heure de génération serveur est rendue visible quand elle existe.
- La frontière humaine existante reste explicite : suggestion only, zéro side effect.

## Triplettes
- Client / Taste Oracle : Trust Current actif.
- Courier / Route Oracle : Trust Current actif.
- Merchant / Service Oracle : même contrat de transparence appliqué pour préserver la symétrie des triplettes.

## Coût / sécurité
- Zéro nouvelle dépendance native.
- Zéro nouvel appel réseau : la feature réutilise la réponse Confluence existante.
- Zéro nouvelle donnée personnelle collectée.
- Zéro mutation de commande, mission, disponibilité ou paiement.
- Les guardrails serveur existants restent intacts : preuves bornées, no sensitive transit, numerical claim guard, human boundary, actionSideEffects=false.
- Aucun build Store, OTA update ou déploiement runtime déclenché pendant ce palier.

## Validation
- TypeScript 0 erreur : Client PASS, Courier PASS, Merchant PASS.
- Expo export iOS : Client PASS, Courier PASS, Merchant PASS.
- Expo export Android : Client PASS, Courier PASS, Merchant PASS.
- git diff --check : PASS.

## Dette / prochain palier
- QA visuelle sur appareils avant toute promotion vers master.
- Mesurer la lisibilité de la bande de confiance sur petits écrans et Reduce Motion.
- Ne pas afficher de pseudo-confidence numérique : rester sur preuves, incertitude et fraîcheur observables.

## Trust Current V1.1 - précision CONTEXTE
- Correction de confiance : un signal `context` n est plus résumé comme `FAITS` lorsqu aucune estimation n est présente.
- Nouveau niveau : `CONTEXTE`, distinct de `FAITS`, `ESTIMATIONS` et `PREUVES FAIBLES`.
- Le backend Confluence, le schéma de sortie structurée et les trois hooks mobiles partagent désormais la même sémantique.
- Test fonctionnel policy compilée : facts=facts_only, context=contains_context, estimate=contains_estimates, empty=insufficient_evidence.
- API Nest build : PASS.
- TypeScript 3 apps : PASS.
- Expo exports : iOS + Android PASS pour Client, Courier et Merchant.
- Surcoût bundle mesuré vs Trust Current V1 : environ +177 à +201 octets selon app/plateforme ; aucune dépendance ni requête réseau ajoutée.

## Trust Current V1.2 - Passeport IA
- Ajout d un passeport de confidentialité compact directement dans la lentille Confluence.
- Le backend expose explicitement deux garanties structurelles : `providerStore=false` et `sensitiveEvidenceTransit=false`.
- En mode serveur, l UI affiche : données sensibles bloquées + stockage fournisseur désactivé.
- En secours embarqué, l UI rappelle qu aucune clé fournisseur n est présente dans l app et que la suggestion locale reste disponible.
- Le passeport complète le triptyque moteur / preuves / incertitude sans ajouter de chatbot ni de nouvelle navigation.
- Aucun nouvel appel réseau, aucun nouvel identifiant collecté, aucune persistance ajoutée.

### Validation V1.2
- API Nest build : PASS.
- TypeScript Client/Courier/Merchant : PASS.
- `git diff --check` : PASS.
- Expo export iOS + Android : PASS sur les 3 apps.
- Aucun Store build, OTA update ou déploiement runtime déclenché.

## Client V1.3 - Contre-courant sans profilage
- Taste Oracle propose désormais une bifurcation volontaire vers une autre intention éditoriale.
- Cette bifurcation ne lit aucun historique, aucun profil caché et aucune préférence sensible : elle part uniquement du choix explicite actuel.
- Un tap suffit pour changer de courant ; Confluence recalcule ensuite sa lecture sur les nouvelles preuves visibles.
- Objectif : éviter la bulle de recommandation tout en gardant la découverte entièrement sous contrôle humain.
- TypeScript Client : PASS.
- Expo export Client iOS + Android : PASS.
- Surcoût bundle mesuré vs AI Passport : ~2.2 KB.

## Courier V1.3 - SAS humain / Decision Sandbox
- Avant Accepter ou Décliner, le coursier peut ouvrir une prévisualisation locale des conséquences réelles de chaque choix.
- Le SAS n envoie aucun appel réseau et ne modifie aucune mission.
- Accepter est décrit comme entrée dans le cockpit uniquement ; retrait et livraison restent des confirmations humaines séparées.
- Décliner est décrit comme libération de la proposition pour poursuite du dispatch serveur.
- Le panneau est en progressive disclosure pour ne pas alourdir l interface.
- TypeScript Courier : PASS.
- Expo export Courier iOS + Android : PASS.
- Surcoût bundle mesuré vs AI Passport : ~3.7 KB.

## Positionnement innovation
- DelishAfrica ne poursuit pas le paradigme chatbot = IA.
- La ligne produit devient : preuve visible + confidentialité explicite + contre-factuel compréhensible + action humaine réversible.
- Aucun Store build, OTA update ou déploiement runtime déclenché pendant ce palier.

## Trust Current V1.4 - Zero-Leak Gate local
- Ajout d un garde de confidentialité dans les trois apps AVANT tout appel Confluence serveur.
- Les signaux ressemblant à email, URL, identifiant de commande DelishAfrica, UUID ou numéro de téléphone déclenchent un fallback embarqué immédiat.
- Dans ce cas, aucune requête Confluence n est envoyée : la recommandation locale reste active et le Passeport IA indique `transit serveur bloqué localement avant tout envoi`.
- Ce garde client complète le garde serveur déjà existant ; il ne le remplace pas.
- Aucun nouveau package, aucune permission native, aucune persistance et aucun endpoint supplémentaire.

### Validation V1.4
- `git diff --check` : PASS.
- TypeScript Client/Courier/Merchant : PASS.
- Expo export iOS + Android : PASS pour les 3 apps.
- Parité du hook Confluence maintenue sur les triplettes.
- Aucun Store build, OTA update ou déploiement runtime déclenché.
- PR de travail isolée : GitHub #17 (draft).

## ADDENDUM 2026-10-09 — CHANTIER GUEST CHECKOUT
- Origine : retour testeur Client, double contrat profil local / Keycloak, paiement impossible sans login.
- Branche isolée : feature/client-guest-checkout-secure-20261009.
- Parcours sécurisé invitée P0 en cours ; première capacité temporaire codée, mais sans liaison checkout/Stripe/Orders.
- Module preview fail-closed en production. Guards financiers intacts. Radar clarifié, placement conservé.
- Preuves et plan complet : docs/guest-checkout/ROADBOOK_GUEST_CHECKOUT_20261009.md.
- Ne pas merger/déployer ni payer en mode invité avant gate Stripe webhook -> commande durable.

## ADDENDUM 2026-10-09 - PALIER 2 GUEST CHECKOUT
- Palier 1 : capacité HMAC 4h + Radar pédagogique. 7 tests PASS.
- Palier 2 : PostgreSQL guest ledger en branche isolée et migration non exécutée. 5 nouveaux tests PASS.
- Gate consolidé : FINAL_DA_GUEST_CHECKOUT_STAGE2_GATE=PASS, 12/12 tests, TypeScript API/Client conforme.
- Test PostgreSQL réel et transaction webhook->ordre->outbox EN ATTENTE.
- Aucun code production / build EAS / OTA / connexion Keycloak existante modifié.
- Docs : docs/guest-checkout/ROADBOOK_GUEST_CHECKOUT_STAGE2_20261009.md.

## ADDENDUM 2026-10-09 — GUEST P3
- PostgreSQL isolé + preuve Stripe simulée : 6 scénarios PASS, y compris 8 webhooks concurrents, rollback et reprise après expiration.
- Gate P3 consolidé attendu 18/19 tests.
- Finalizer NON BRANCHÉ aux routes publiques. Livraison et création des vraies commandes en attente P4.
- Voir docs/guest-checkout/ROADBOOK_GUEST_CHECKOUT_STAGE3_20261009.md.

## ADDENDUM 2026-10-09 — P4 DELIVERY VAULT
- P4 : coffre de livraison AES-256-GCM, devis serveur fixé et transaction PostgreSQL. 4 tests P4 réussis.
- Gate P1-P4 : 22 tests au total, TypeScript propre, aucune production modifiée.
- API Client encore soumise au système de connexion existant ; fonctionnalité guest checkout non activée.
- Voir docs/guest-checkout/ROADBOOK_GUEST_CHECKOUT_STAGE4_20261009.md.

## ADDENDUM 2026-10-09 - GUEST P4 COMPLETE LAB
- P4 conçu et testé en branche isolée, 9 nouveaux tests PostgreSQL réels, sans fuite plaintext PII.
- Résultat final cumulatif : FINAL_DA_GUEST_CHECKOUT_STAGE4_GATE=PASS ; 31/31 tests + TS API/Client PASS.
- P3 a été renforcé pour sceller un dossier de livraison avant l'association Stripe ; ses 6 tests restent verts.
- ZÉRO changement d'API en production / de publication Stores / de branche principale.
- Livrable/plan : docs/guest-checkout/ROADBOOK_GUEST_CHECKOUT_STAGE4_20261009.md.
- Guest Checkout réellement disponible à l'utilisateur : EN ATTENTE des routes backend, montant calculé et paiement Stripe test, droits Merchant/Courier et parcours mobile.

## ADDENDUM P4 CONSOLIDE — 2026-10-09
- Chevauchement P4: commit alternatif 1427703 préservé + coffre primaire commit 2dc2bc7.
- Le test alternatif P4 (4/4) a été repris; gate consolidé P1-P4 (31/31) PASS.
- Un seul chemin de données invité devra être câblé P5 ; PAS de double stockage du profil.
- Preuves et schéma canonique : docs/guest-checkout/CONSOLIDATION_P4_DEUX_COFFRES.md.
- Test réel Stripe, validation géographique serveur, projection Merchant/Courier et UI Client sans Keycloak NON FINIS.

## ADDENDUM 2026-10-09 — GUEST P5-A TEST
- Feature séparée pour éviter les travaux concurrents: feature/client-guest-checkout-p5-20261009, base c722cf6.
- Quote serveur, Google Place server-side, validation de couverture Merchant injectable, scellement P4 en deux étapes reprenables.
- 8 nouveaux tests P5-A, cumul P1/P2/P3/P4/P5-A 39/39 PASS dans Postgres lab 127.0.0.1:55438 ; TypeScript API/Client PASS.
- Backends réels Google/Stripe non appelés; aucune commande invité ouverte au public.
- Roadbook source : docs/guest-checkout/ROADBOOK_GUEST_CHECKOUT_STAGE5A_20261009.md.
- Reste à bâtir P5-B : couverture réelle, CreateIntent Stripe, webhook branché, ordre durable Merchant/Courier, suivi privé et Client sans Keycloak obligatoire.

## ADDENDUM P5-B COVERAGE LAB PASS 2026-10-09
- Branche dédiée `feature/client-guest-coverage-strict-20261009` à partir de P5-A, code Coverage policy par zones approuvées.
- 6 tests ciblés + P1/P2/P3/P4/P5-A : `FINAL_DA_GUEST_P5B_COVERAGE_GATE=PASS`, total 45/45, TypeScript API/Client PASS.
- Aucun impact sur la vraie API ou le catalogue ; zone réelle Merchant non encore configurée.
- Suite prioritaire : couverture réelle gouvernée, Intent Stripe invité en mode test, compensation des interruptions, projection métier, Client sans Keycloak obligatoire.
- Voir `docs/guest-checkout/ROADBOOK_P5B_MERCHANT_COVERAGE_20261009.md`.

## SCELLAGE P5-B SECURITE OPS INDEPENDANTE — 09/10/2026
- Renforcement du validateur : approbation Ops sortie du JSON Merchant et conservée dans un registre indépendant.
- Migration lab `migrations/20261009_guest_coverage_ops_approvals.sql` exécutée sur PostgreSQL ISOLÉ uniquement.
- Revocation, expiration, changement de zone ou révision => permission immédiatement refusée.
- Nouveau gate P1→P5B : `FINAL_DA_GUEST_P5B_COVERAGE_GATE=PASS` ; **52/52** tests et TypeScript API/Client PASS.
- Le précédent résultat **45/45** reste historique ; 52/52 le remplace comme état actuel.
- Le parcours Stripe invité, la projection vers les apps professionnelles et l'expérience sans Keycloak restent NON LIVRÉS.
- Preuves : docs/guest-checkout/ROADBOOK_P5B_MERCHANT_COVERAGE_20261009.md.

## P5-C SECURITY MERGE GATE : REVOCATION BEFORE STRIPE
- Audit en lecture seule du chantier parallèle P5-C Stripe Test; aucun fichier ni migration de son worktree modifié.
- Décision: revalider l'autorisation Ops / couverture juste avant PaymentIntent; pas uniquement au devis. Un hôtel/adresse déjà scellé ne justifie pas un paiement si la zone vient d'être révoquée.
- Harmoniser les deux schémas de couverture et disposer d'UNE autorité Ops gouvernée, auditable.
- Rejouer P1-P5B (52 tests) + tests supplémentaires d'idempotence Stripe/crash/reprise après fusion; ne pas toucher aux stores ni au backend public.
- Détails : docs/guest-checkout/P5C_CROSS_BRANCH_SECURITY_REVIEW_20261009.md.

## ADDENDUM 2026-10-09 — P5-C OPS GATED INTEGRATED
- Branche indépendante: feature/client-guest-p5c-ops-integrated-20261009, copie instantanée du prototype P5-C depuis le worktree parallèle, sans toucher à ses fichiers.
- Intégration à la preuve Merchant+Ops indépendante et à la géométrie Google conservée exclusivement dans le coffre AES chiffré.
- Revérifie la couverture a l'entrée, juste avant l'appel Stripe et après la réponse, avant toute remise de secret.
- Tests: FINAL_DA_GUEST_P5C_OPS_INTEGRATED_GATE=PASS, 71/71 cumulés. PostgreSQL isolé 127.0.0.1:55439, fournisseurs Stripe et Google simulés, TypeScript API/Client PASS.
- Restent bloquants: annulation/reconciliation des intents orphelins, vrai Stripe mode test, suivi privé, bridge Merchant/Courier, activation UX sans Keycloak et approbations commerciales réelles.
- Roadbook détaillé: docs/guest-checkout/ROADBOOK_P5C_OPS_INTEGRATED_20261009.md.
- Aucun déploiement, migration PG production, build EAS, OTA ou soumission stores exécuté.

## DELISHAFRICA P5-D — INTENT COMPENSATION 09/10/2026
- Paiement invité : compensation du PaymentIntent en cas de révocation Merchant/Ops APRÈS la création Stripe, sous verrou de ligne et contrôle du bail ; une réponse `canceled` vérifiée est exigée.
- Échec d'annulation, statut non annulable, métadonnées douteuses et ACK PG de COMMIT perdu => `review_required` plutôt que recréation ou annulation hasardeuse.
- Clé idempotente unique réservée dans PostgreSQL ; pas de nouveau `createIntent` si la réservation initiale est antérieure à 23 h.
- **82/82 tests P1 à P5-D PASS**, TypeScript API + Client PASS sur PostgreSQL 16 de laboratoire exclusivement port 55440, Stripe/Google simulés.
- Aucun changement de production, de migration live, d'API publique, de profils Merchant/Courier, ni de build Store.
- Code source complet, migration lab, tests et gate : docs/guest-checkout/ROADBOOK_P5D_20261009.md.
- P0 NON RÉSOLUS : annulation/remboursement après remise du secret, worker alerte/reconciliation, Stripe réel en mode test, flux commande Merchant/Courier, Client sans Keycloak.

## ADDENDUM 2026-10-09 P5-E OPS FINANCIAL RECONCILIATION
- Branche isolée : `feature/client-guest-p5e-ops-reconciler-20261009`, héritée du P5-D scellé `88a0fd5`.
- Scanner Ops interne `GuestPaymentReconciliationMonitor` : réclamation PostgreSQL `SKIP LOCKED`, baux récupérables, rapprochement Stripe en lecture seule, alertes durables sans PII.
- Pour un Intent BOUND et Stripe `succeeded`, P3 peut revalider indépendamment la capture puis écrire paiement vérifié + outbox financière sous transaction, sans commande métier ni dispatch.
- Crash après commit P3 : récupération de l'alerte financière sans dédoublement de l'écriture ni création de nouvel Intent.
- Adaptateur Stripe HTTP REST créé : `sk_test_` / `rk_test_` uniquement, refus live/production, URL fixe, idempotence CREATE/CANCEL ; **11 tests via fake HTTP, aucun appel Stripe externe**.
- Gate laboratoire P1-P5E : **112/112 PASS**, TypeScript API + Client + Merchant + Courier PASS sur PostgreSQL isolé port 55441.
- Reste à faire : authentique Stripe TEST, scheduler/alerting Ops, RBAC, remboursement et révocation après remise du clientSecret, commandes métier et tracking Client sans Keycloak imposé.
- Aucun déploiement, migration SQL production, push OTA ni build Store.
- Passation : docs/guest-checkout/ROADBOOK_P5E_20261009.md.

## 2026-10-09 — Jalon Stripe TEST réel validé
La clé existante du VPS a authentifié Stripe TEST ; une intention de test
non confirmée de 0,50 EUR a été créée, relue et annulée avec état final
canceled, après démonstration du même identifiant au rejeu idempotent.
Aucune carte, aucun paiement réel et aucune modification de production.
Journal de reprise vérifié : unique état cancelled, permissions 0600.
Étape distincte des 112/112 tests du module P5-E de laboratoire.
Preuve : docs/guest-checkout/ROADBOOK_P5E_STRIPE_REAL_PROVIDER_PASS_20261009.md.

## JALON 2026-10-10 — P5-F GUEST STRIPE TEST INTEGRATION RÉELLE

- Paire existante de clés sk_test/pk_test du VPS CONFIRMÉE sur Stripe : lecture du même PaymentIntent précédemment annulé avec chacun des deux modes d'autorisation, client_secret en mémoire uniquement, aucune nouvelle création.
- Nouvelle branche isolée feature/client-guest-p5f-real-stripe-lab-20261010, parent fbf2ee4, PostgreSQL TEST indépendant sur 127.0.0.1:55442.
- Vrai service GuestStripeIntentReservation branché à GuestStripeHttpTestTransport : capability HMAC, quote 21,90 EUR, coffre AES, localisation de laboratoire, zone Merchant + approbation Ops synthétiques, key de réservation avant fournisseur, paiement Stripe TEST non confirmé, restauration idempotente, annulation GET Stripe confirmée canceled.
- Moniteur Ops réel relecture Stripe : cancellation_binding_conflict traité en operator_action_required, zéro ligne finance P3, zéro outbox, zéro dispatch.
- Provider readback distinct PASS (aucune carte, aucun latest_charge, 0 EUR encaissé).
- Régression P1-P5-E relancée : 112/112 PASS ; TypeScript API + Client + Merchant + Courier PASS.
- Journal provider de laboratoire 0700/0600 : un run unique cancelled ; launcher à SHA épinglé en prévol répétable, nouvelle exécution CREATE bloquée.
- AUCUN merge au dépôt exécuté, migration production, build Store, OTA, mutation OrchidPay ou paiement LIVE.
- Roadbook P5F : docs/guest-checkout/ROADBOOK_P5F_REAL_STRIPE_E2E_20261010.md.
- P0 ouverts : webhooks signés + capture TEST, annulation post-client_secret, PaymentSheet réel iPhone/Android, vraies zones Ops, Orders Merchant/Courier, suivi Guest sans Keycloak.

### 2026-10-10 P5-G Stripe TEST P3
Guest Checkout in isolated PG 55443 completed a Stripe TEST charge for 21.90 EUR using synthetic pm_card_visa. The signed event was LOCAL to the lab; P3 independently re-read the TEST Stripe intent, committed one verified payment and one financial outbox. Duplicate event did not double-write. No Merchant/Courier dispatch and no actual funds. One Node test PASS, live mode disabled. Repeat execution blocked. See docs/guest-checkout/ROADBOOK_P5G_REAL_TEST_CAPTURE_20261010.md. Public checkout remains OFF.
