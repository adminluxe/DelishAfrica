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
- Gate P3 consolidé attendu 18/18 tests.
- Finalizer NON BRANCHÉ aux routes publiques. Livraison et création des vraies commandes en attente P4.
- Voir docs/guest-checkout/ROADBOOK_GUEST_CHECKOUT_STAGE3_20261009.md.

## ADDENDUM 2026-10-09 — P4 DELIVERY VAULT
- P4 : coffre de livraison AES-256-GCM, devis serveur fixé et transaction PostgreSQL. 4 tests P4 réussis.
- Gate P1-P4 : 22 tests au total, TypeScript propre, aucune production modifiée.
- API Client encore soumise au système de connexion existant ; fonctionnalité guest checkout non activée.
- Voir docs/guest-checkout/ROADBOOK_GUEST_CHECKOUT_STAGE4_20261009.md.

## ADDENDUM 2026-10-09 — GUEST CLIENT DRAFT SDK
- Branche Client UX isolée; récupération locale Guest Checkout via SecureStore.
- 5 tests locaux PASS + TypeScript Client PASS. Aucun paiement invité activé.
- Rapport : docs/guest-checkout/ROADBOOK_GUEST_CLIENT_UX_20261009.md.
