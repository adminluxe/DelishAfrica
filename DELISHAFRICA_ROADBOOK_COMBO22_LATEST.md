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
