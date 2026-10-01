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

## Integration gate - current master 2026-10-01
- La branche innovation a été fusionnée dans un worktree de couveuse basé sur `origin/master` ecb432d, sans modifier le repo runtime principal.
- Merge d intégration : 440799b avant annotation.
- API Nest build sur base master courante : PASS.
- TypeScript Client/Courier/Merchant : PASS.
- Expo export iOS + Android des 3 apps sur base master courante : PASS.
- `git diff --check` : PASS.
- Cette validation remplace une tentative de rebase impossible dans le worktree runtime à cause d un répertoire historique `payments/` non inscriptible par le groupe. Aucune élévation de privilège ni modification de permissions n a été effectuée.
- Les anciens dossiers `(tabs)` nettoyés dans le worktree runtime étaient des résidus de routes supprimées par les commits de sanitation historiques d602f12/d6dc5d3 ; les routes canoniques trackées restent intactes.

## Confluence Trust Gate - one-shot
- Nouveau garde-frontière versionné : `scripts/da_confluence_trust_gate.sh`.
- Mode `quick` : parité byte-identical des composants/hooks 3 apps + garanties privacy/side-effects + ordre du sensitive guard + présence Counterflow et Decision Sandbox.
- Mode `--full` : ajoute build API, TypeScript 3 apps et exports Expo iOS/Android des 3 apps.
- Première exécution FULL sur base master courante : GREEN intégral.
- Ce gate devient obligatoire avant promotion de la branche Confluence vers master ou avant tout rebuild Store contenant ces surfaces.

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

## Trust Current V1.5 - fallback explainability
- Les fallbacks serveur ne sont plus un silence générique : l utilisateur peut comprendre pourquoi Confluence est repassé en lecture déterministe.
- Raisons désormais rendues lisibles : preuve sensible détectée, parcours terminal, plafond de budget IA, compteur budget indisponible, fournisseur indisponible, sortie sensible bloquée, précision numérique non prouvée, sortie insuffisamment reliée aux preuves visibles.
- L objectif est de montrer qu un refus ou un fallback est une décision de sécurité, pas une panne cachée.
- Aucun nouvel appel réseau, aucune nouvelle persistance et aucune nouvelle surface de navigation.

### Validation V1.5
- Gate quick : GREEN avec vérification explicite des principaux fallbacks provider.
- Gate FULL : GREEN.
- API Nest build : PASS.
- TypeScript Client/Courier/Merchant : PASS.
- Expo export iOS + Android : PASS pour les 3 apps.
- Aucun Store build, OTA update ou déploiement runtime déclenché.

## Trust Current V1.6 - Angles morts explicites
- Confluence expose désormais ce qu il ne sait pas encore lorsque les preuves visibles contiennent un signal absent ou non reçu.
- La lentille détecte uniquement des absences explicites déjà présentes dans les preuves : Non reçu, Non reçue, Indisponible, Inconnu, À actualiser, Sans signal, tiret ou N/A.
- Aucun manque n est inventé et aucun score de confiance n est dérivé.
- L angle mort est affiché seulement dans le panneau explicatif : zéro surcharge de la lecture principale.
- Message contractuel : L absence de donnée reste une absence de donnée ; elle n est jamais transformée en certitude.
- Intérêt Courier/Merchant : ETA, score dispatch ou état serveur manquant deviennent visibles comme inconnues au lieu d être absorbés silencieusement dans une recommandation.

### Validation V1.6
- Lens byte-identical Client/Courier/Merchant : PASS.
- Gate quick : GREEN avec présence Angle Mort + copy de vérité vérifiée.
- Gate FULL : GREEN.
- API build : PASS.
- TypeScript 3 apps : PASS.
- Expo iOS + Android 3 apps : PASS.
- Aucun Store build, OTA update ou déploiement runtime déclenché.

---

# DELISHAFRICA ROADBOOK UPDATE - 2026-10-01 - CONFLUENCE PRIVATE CURRENT V1
Branch: innovation/confluence-private-current-20261001
Base: origin/innovation/confluence-trust-current-20261001 @ 10a0d59

## Intention
- Donner a l utilisateur un vrai pouvoir de retrait sans retirer la valeur de l IA.
- Ne pas ajouter un ecran de parametres, un chatbot ou une permission opaque : le choix vit directement dans le Passeport IA, au moment ou la suggestion est visible.

## Innovation livree
- Le Passeport IA expose maintenant un controle de session `CHOIX IA`.
- `SERVEUR AUTORISE` conserve Confluence serveur et ses guardrails.
- `LOCAL UNIQUEMENT` coupe les lectures Confluence reseau pour cet Oracle et maintient instantanement la suggestion embarquee.
- Client / Taste Oracle, Courier / Route Oracle et Merchant / Service Oracle partagent exactement le meme contrat.
- Une requete Confluence deja en vol recoit maintenant un AbortSignal et est annulee lors d un changement de mode, de contexte ou de demontage.
- Une annulation voulue n est pas requalifiee en panne : aucun message d erreur artificiel n est genere.

## Pourquoi c est different
- L utilisateur n a pas a croire une promesse de confidentialite cachee dans un menu : il peut couper le transit IA a l endroit meme ou il voit l IA.
- La valeur locale reste toujours disponible ; refuser le serveur ne degrade pas le parcours en impasse.
- L IA devient un service reversible, pas une dependance obligatoire.

## Securite / performance
- Aucune nouvelle dependance native.
- Aucune persistence du choix : controle de session volontaire, sans nouveau profilage.
- Aucun nouvel appel reseau ; au contraire, le mode local peut supprimer les appels Confluence.
- AbortController coupe les requetes devenues inutiles.
- Aucun changement des actions metier, paiements, dispatch, commandes ou auth.
- Aucun OTA et aucun rebuild Store declenche.

## Validation
- `scripts/da_confluence_trust_gate.sh --full` = GREEN.
- API Nest build = PASS.
- TypeScript Client / Courier / Merchant = PASS.
- Expo export iOS + Android sur les 3 apps = PASS.
- Parite byte-identical Lens + Hook entre les triplettes = PASS.

## Private Current V1.1 - verite du mode local
- Quand l utilisateur choisit LOCAL UNIQUEMENT, le Passeport IA indique explicitement qu aucun appel Confluence n est envoye.
- Le texte de secours ne peut plus laisser croire qu un serveur a ete consulte alors que le transport est coupe.
- Gate rapide + TypeScript 3 apps : GREEN apres ce durcissement de verite UX.

---

# DELISHAFRICA ROADBOOK UPDATE - 2026-10-01 - PROJECT MASTER CONVERGENCE AUDIT

## Etat des deux lignes historiques
- `main` reste la branche par defaut GitHub et porte la ligne publique Landing/Courier/legal jusqu'a `161f7d5`.
- `master` porte la ligne Mobile/API/runtime jusqu'a `ecb432d`, incluant P0F PostgreSQL authority et la synchronisation privee OrchidPay F3.
- Les deux lignes divergeaient depuis `791203e`, ce qui devenait une dette de pilotage dangereuse avant les finitions.

## Reconciliation executee en laboratoire
- Worktree isole: `/home/afripayadmin/DA_WORKTREES/project-master-reconcile-20261001`.
- Branche: `reconcile/project-master-20261001`.
- Merge `origin/master` dans `origin/main`: automatique, ZERO conflit.
- Commit de convergence: `de07dc7`.
- Merge Confluence Private Current sur la convergence: `d44b636`.
- Aucun merge vers `main`, aucun OTA, aucun rebuild Store, aucun redeploiement runtime.

## Validation de la convergence
- `git diff --check`: PASS.
- API Nest build: PASS.
- TypeScript Client / Courier / Merchant: PASS.
- Expo export Client iOS + Android: PASS.
- Expo export Courier iOS + Android: PASS.
- Expo export Merchant iOS + Android: PASS.
- `scripts/da_confluence_trust_gate.sh --full`: GREEN sur le tronc reconcilie.
- Landing Node `v22.23.3` verifie via bootstrap portable + checksum officiel.
- Landing `astro check`: PASS.
- Landing `astro build`: PASS.

## Runtime live audite sans mutation
- API `delish-api` UP; `/health` et `/api/v1/health` = 200.
- Confluence `/api/v1/confluence/ai/health` = `ai_ready`, cle fournisseur non exposee, sortie structuree, `store=false`, side effects=false, transit sensible fail-closed, budget provider disponible.
- Payments `/api/v1/payments/health` = production; Stripe configure, webhook signature required, autorite financiere PostgreSQL primaire, 6 orders / 1 payment au snapshot, OrchidPay F3 ready via socket prive.
- Landing publique `/`, `/courier/`, `/en/courier/`, `/devenir-coursier/` = HTTP 200.
- `courier.delishafrica.me` repond toujours sur une surface Expo distincte; conserver la navigation publique canonique vers `delishafrica.me/courier/` tant que le routage infra n'est pas arbitre.

## Nightshift Client - audit anti-regression
Le worktree `reconcile/client-nightshift-20261001` contient 18 fichiers Client stages. 14 sont byte-identiques a `origin/master`; 4 divergent et restent HOLD avant integration:
- `apps/client/app.config.js`: retire la variante DEV side-by-side et modifie splash/plugins.
- `apps/client/app/checkout-preflight.tsx`: retire le redirect automatique vers Secure Session sur session requise.
- `apps/client/app/index.tsx`: modifie la hierarchie visuelle et retire des metadonnees explicatives du rail marche.
- `apps/client/app/orders.tsx`: retire la grammaire tactile GALA et modifie fortement les surfaces.
Decision: NE PAS absorber ce worktree en bloc. Arbitrage fichier par fichier uniquement apres comparaison avec le tronc reconcilie.


---

# DELISHAFRICA ROADBOOK UPDATE - 2026-10-01 - CONFLUENCE ALGORITHMIC RED LINE V1

## Intention
- Aller plus loin que l'explicabilite classique: ne pas seulement montrer ce que l'IA utilise, mais aussi les criteres volontairement tenus hors de la proposition.
- Transformer une promesse ethique abstraite en limite visible, inspectable et testable dans le produit.

## Innovation livree
- La lentille Confluence expose maintenant, dans la divulgation progressive, une section `LIGNE ROUGE · HORS LECTURE`.
- Client / Taste Oracle declare hors de la proposition: identite sensible, origine supposee, historique cache et donnees de paiement.
- Courier / Route Oracle declare hors de la proposition: taux de refus, nom/identite personnelle et donnees de paiement.
- Merchant / Service Oracle declare hors de la proposition: identite client, donnees de paiement et profilage historique.
- La formulation reste strictement bornee a la proposition/lecture courante; elle ne pretend pas decrire toute l'application.

## Garde-fou Courier source-code
- Le moteur de dispatch conserve `acceptanceRate` comme signal observable de diagnostic, mais il est exclu du calcul de score d'affectation.
- Le gate extrait le bloc `scoreCourier` et echoue si `courier.acceptanceRate` y reapparait.
- La promesse visible "Taux de refus hors lecture" est donc liee a une verification de code, pas a un simple texte marketing.

## Cout / securite
- Zero nouvelle dependance.
- Zero nouvel appel reseau.
- Zero nouvelle persistance ou donnee personnelle collectee.
- Aucun changement des actions metier, paiements, statuts, dispatch ou auth.
- La section reste repliee par defaut avec les autres preuves afin d'eviter toute surcharge visuelle.
- Aucun OTA, rebuild Store ou redeploiement runtime declenche.

## Validation
- `scripts/da_confluence_trust_gate.sh --full` = GREEN.
- API Nest build = PASS.
- TypeScript Client / Courier / Merchant = PASS.
- Expo export iOS + Android Client = PASS.
- Expo export iOS + Android Courier = PASS.
- Expo export iOS + Android Merchant = PASS.
- Parite byte-identical de `ConfluenceOracleLens.tsx` entre les triplettes = PASS.
- Gate specifique `courier_refusal_rate_excluded_from_assignment_score` = PASS.


---

# DELISHAFRICA ROADBOOK UPDATE - 2026-10-01 - CONFLUENCE EVIDENCE FIREWALL V1

## Intention
- Empecher le perimetre de donnees IA de grandir silencieusement au fil d'une evolution UI ou d'un refactor.
- Faire du contrat de preuve une frontiere de securite executable avant le reseau, pas seulement une convention de developpement.

## Defense en profondeur livree
- Le serveur Confluence possedait deja un `ALLOWED_LABELS` strict par Oracle dans `confluence-ai.policy.ts`.
- Les trois apps appliquent maintenant le meme principe localement via `EVIDENCE_CONTRACT` dans `useConfluenceSuggestion.ts`.
- Taste Oracle n'autorise vers Confluence que: Intention choisie, Intensite editoriale, Fraicheur editoriale, Voyage propose.
- Route Oracle n'autorise que: Statut commande, Fenetre de remise, ETA dispatch, Score dispatch.
- Service Oracle n'autorise que: Commande, Statut serveur, Charge observee, Article visible.
- Un label inattendu, duplique ou un depassement du nombre de preuves autorise fait basculer immediatement la lecture en mode embarque avant tout appel HTTP.
- Le Passeport IA dit alors explicitement: `Evidence Firewall · schema de preuve inattendu bloque avant reseau`.

## Pourquoi ce palier compte
- Une future fonctionnalite ne peut plus ajouter par accident un nom, profil, signal marketing ou nouveau champ au transit IA sans modifier deliberement le contrat.
- Le garde local protege le premier hop; le garde serveur reste actif en second rideau.
- La securite devient fail-closed des deux cotes sans supprimer la valeur locale pour l'utilisateur.

## Cout / securite
- Zero nouvelle dependance.
- Zero appel reseau supplementaire; un contrat non conforme supprime l'appel.
- Zero persistence supplementaire.
- Hook byte-identical Client / Courier / Merchant conserve.
- Aucun OTA, rebuild Store ou deploiement runtime declenche.

## Validation
- Gate quick: GREEN.
- `scripts/da_confluence_trust_gate.sh --full`: GREEN.
- API Nest build: PASS.
- TypeScript Client / Courier / Merchant: PASS.
- Expo export iOS + Android sur Client / Courier / Merchant: PASS.
- Verifications nouvelles: evidence_firewall_contract, validator, user truth copy et ordre du garde avant reseau = PASS.

---

# DELISHAFRICA ROADBOOK UPDATE - 2026-10-01 - CONFLUENCE SOVEREIGN SILENCE V1
Branch: innovation/confluence-sovereign-silence-20261001
Base: reconcile/project-master-20261001 @ 7970e9c

## Intention
- Faire de la confiance IA un droit de retrait réel, visible et immédiatement réversible.
- Ne pas forcer une recommandation locale ou serveur lorsqu un utilisateur veut simplement utiliser le produit sans couche Confluence visible.
- Conserver le parcours métier intact : couper Confluence ne doit jamais bloquer commande, service, mission ou navigation.

## Innovation livrée
- Le Passeport IA évolue vers un choix de session à trois états : SERVEUR / LOCAL / SILENCE.
- SERVEUR : Confluence peut appeler le backend sous Evidence Firewall, Zero-Leak Gate et guardrails serveur.
- LOCAL : aucune requête Confluence n est envoyée ; la lecture embarquée reste visible.
- SILENCE : aucune requête Confluence n est envoyée ET aucune suggestion Confluence n est affichée sur l écran.
- Le mode SILENCE conserve uniquement un rail souverain compact permettant de réactiver SERVEUR ou LOCAL à tout moment.
- Le choix reste volontairement session-only et n est pas mémorisé : aucun nouveau profilage ni nouvelle préférence persistée.

## Triplettes
- Client / Taste Oracle : Sovereign Silence actif.
- Courier / Route Oracle : Sovereign Silence actif.
- Merchant / Service Oracle : Sovereign Silence actif.
- `ConfluenceOracleLens.tsx` reste byte-identical entre les trois apps.

## Garde-fous techniques
- `enabled` du hook n est vrai qu en mode SERVEUR.
- Le gate vérifie que le short-circuit `!enabled` précède tout `daOrdersFetch`.
- Les contrôles booléens historiques `confluenceNetworkEnabled` sont interdits par le gate afin d éviter un retour silencieux à un modèle binaire incomplet.
- Evidence Firewall, Zero-Leak Gate, Algorithmic Red Line, Blind Spots, AbortController et actionSideEffects=false restent intacts.
- Aucun endpoint, permission native, package, stockage ou collecte personnelle ajouté.

## Validation
- `scripts/da_confluence_trust_gate.sh` quick : GREEN.
- API Nest build : PASS.
- TypeScript Client / Courier / Merchant : PASS.
- Expo export Client iOS + Android : PASS.
- Expo export Courier iOS + Android : PASS.
- Expo export Merchant iOS + Android : PASS.
- `scripts/da_confluence_trust_gate.sh --full` : GREEN.
- Aucun OTA, aucun rebuild Store et aucun déploiement runtime déclenché.

## Positionnement produit
- DelishAfrica ne demande pas une confiance aveugle envers l IA.
- L utilisateur peut choisir une IA serveur contrôlée, une intelligence locale sans réseau, ou aucun conseil IA affiché du tout.
- La souveraineté utilisateur devient une capacité produit, pas une promesse de confidentialité cachée dans des réglages.

---

# DELISHAFRICA ROADBOOK UPDATE - 2026-10-01 - CONFLUENCE ATTENTION COVENANT V1
Branch: innovation/confluence-attention-covenant-20261001
Base: innovation/confluence-sovereign-silence-20261001 @ fa299d3

## Intention
- Une IA digne de confiance ne doit pas seulement savoir parler, expliquer et se taire sur demande : elle doit aussi savoir quitter l écran quand elle n apporte plus rien de nouveau.
- Réduire la dette cognitive et la compétition visuelle sans cacher un changement utile.
- Ne pas transformer ce comportement en profil utilisateur : la lecture reste entièrement session-only.

## Innovation livrée - Pacte d attention
- Chaque Lens propose `PACTE D’ATTENTION · C’est clair · Confluence peut se retirer`.
- Après acknowledgement humain, le Lens se replie en rail compact `CONFLUENCE · EN RETRAIT`.
- Tant que les preuves et le mode IA restent identiques, Confluence n occupe plus l espace principal.
- `RELIRE` permet de rouvrir volontairement la dernière proposition à tout moment.
- Si une preuve change, le Lens revient automatiquement en taille complète avec `NOUVEAU SIGNAL`.
- Le fingerprint est dérivé uniquement du mode courant et des preuves déjà visibles (`label`, `value`, `kind`) : aucun historique externe, identifiant ou profilage ajouté.
- Sovereign Silence garde la priorité : en mode SILENCE aucune recommandation Confluence n est affichée.

## Pourquoi c est différent
- Le modèle dominant consiste à maximiser la présence de l assistant. DelishAfrica impose au contraire un droit de retrait de l IA après compréhension humaine.
- L IA doit gagner ses pixels : une situation déjà comprise ne reste pas artificiellement au premier plan.
- Elle revient sur changement de preuve, pas sur simple changement de formulation fournisseur.

## Sécurité / sobriété
- Aucun stockage persistant du consentement de lecture.
- Le gate échoue si `SecureStore`, `AsyncStorage`, `localStorage` ou une logique de persistence apparaît dans le Lens.
- Aucun nouvel endpoint, provider call, package, permission ou collecte personnelle.
- Evidence Firewall, Zero-Leak Gate, Algorithmic Red Line, Blind Spots, Sovereign Silence et frontière humaine restent intacts.
- Aucun OTA, rebuild Store ou déploiement runtime déclenché.

## Validation
- Lens byte-identical Client / Courier / Merchant : PASS.
- `scripts/da_confluence_trust_gate.sh` quick : GREEN.
- API Nest build : PASS.
- TypeScript Client / Courier / Merchant : PASS.
- Expo export Client iOS + Android : PASS.
- Expo export Courier iOS + Android : PASS.
- Expo export Merchant iOS + Android : PASS.
- `scripts/da_confluence_trust_gate.sh --full` : GREEN.
- `git diff --check` : PASS.

---

# DELISHAFRICA ROADBOOK UPDATE - 2026-10-01 - CONFLUENCE FRUGAL CURRENT V1
Branch: innovation/confluence-frugal-current-20261001
Base: innovation/confluence-attention-covenant-20261001 @ 58a8f5c

## Intention
- Faire gagner chaque appel IA avant de le payer.
- Ne jamais recalculer une recommandation fournisseur si les preuves normalisees sont identiques.
- Garder la fraicheur utile : toute variation de preuve produit un nouveau fingerprint et reautorise un calcul frais.
- Ne pas transformer l economie en dette UX : les fallbacks locaux et serveur restent actifs.

## Innovation livree - Frugal Current
### Mobile / session
- Le cache mobile Confluence devient un LRU de session borne a 96 etats.
- Un etat deja resolu dans le meme process mobile ne reveille plus le serveur uniquement parce qu une minute s est ecoulee.
- Le cache reste cle par Oracle + preuves + suggestion locale : aucun etat persistant, aucun profilage, aucun risque de fuite inter-session.

### Serveur / provider
- Memo provider en memoire borne a 512 entrees, TTL 6 heures.
- Fingerprint SHA-256 base uniquement sur version du contrat, modele, Oracle, locale et preuves normalisees.
- `localSuggestion` est volontairement exclue du fingerprint provider : une variation de wording local ne doit pas acheter un nouveau calcul externe.
- Aucun texte de preuve brute n est utilise comme cle de Map : la cle est un hash.
- Les entrees memo ne survivent pas au redemarrage du process.

### Singleflight
- Si plusieurs requetes identiques arrivent pendant qu un calcul fournisseur est deja en vol, un seul appel fournisseur est execute.
- Les autres requetes attendent la meme Promise et recoivent la meme sortie deja gardee par les controles Confluence.
- Le budget provider n est consomme qu apres les chemins memo/singleflight : un hit memo ou coalesced ne consomme pas une nouvelle unite de budget.

### Observabilite cout
- `/confluence/ai/health` expose `frugalCompute` : memo size, in-flight, fresh calls, memo hits, coalesced hits et appels provider evites depuis le boot.
- `computeSource` est typé dans la meta serveur : `fresh`, `memoized`, `coalesced`.
- Le `generatedAt` d une sortie memoisee reste celui du calcul fournisseur original ; aucune fausse fraicheur n est affichee.

## Probe financier deterministe
- Script: `scripts/da_confluence_frugal_probe.cjs`.
- Scenario couveuse: 6 demandes logiques, 2 etats de preuve reels.
- Resultat: 2 appels provider frais / 2 consommations budget / 4 appels provider evites.
- Les 3 demandes concurrentes du second etat ont produit exactement 1 fresh + 2 coalesced.
- Ce ratio est une preuve de fonctionnement du mecanisme, pas une promesse de taux d economie production : le taux reel dependra de la repetition des etats de preuve.

## Garde-fous ajoutes
- Gate verifie que memo + singleflight precedent `consumeProviderBudget`.
- Gate verifie que le fingerprint provider ignore la copie locale.
- Gate interdit le retour a un polling cache base sur `CACHE_TTL_MS` cote mobile.
- Gate full execute le probe apres le build API.
- Evidence Firewall, Zero-Leak, Red Line, Sovereign Silence et Attention Covenant restent intacts.

## Validation
- Quick trust gate : GREEN.
- API Nest build : PASS.
- Frugal compute probe : PASS.
- TypeScript Client / Courier / Merchant : PASS.
- Expo export iOS + Android Client : PASS.
- Expo export iOS + Android Courier : PASS.
- Expo export iOS + Android Merchant : PASS.
- Full trust gate : GREEN.
- git diff --check : PASS.
- Aucun OTA, build Store ou deploiement runtime declenche.
