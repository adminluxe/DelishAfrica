# DELISHAFRICA ARCHITECTURE PIN - POST COMBO 21 / COMBO 22 QUIET LUXURY
Date: 20260920_202116
Repo officiel: /opt/delishafrica/monorepo

## DEV LAB
- Client DEV: tmux 5 / port 8081
- Merchant DEV: tmux 6 / port 8083
- Courier DEV: tmux 7 / port 8082
- API: 3010
- Development Clients .dev side-by-side conservés

## Visual stack
1. Hero Depth
2. Deep Continuity
3. Network Organism
4. Refractive Intelligence
5. Signal Pearl / Caustic Core
6. Active Thread / Living Focus
7. Decision Bloom / Liquid Aperture
8. Hydrodynamic Veil / Soft Interference
9. Multi-Octave Surf / Feathered Caustics
10. Subsurface Continuum / Seamless Fusion
11. Capillary Fusion / Surface Memory
12. Osmotic Seam / Emergent Surfaces
13. Phase Decoherence / Boundary Evaporation
14. Deep Osmosis / Chromatic Continuity
15. Interaction Osmosis / Material Breathing
16. Edgeless Continuity / Legacy Spectral Cleanup
17. QUIET LUXURY / OPTICAL RHYTHM

## Combo 22 R1 rendering contract
- STATIC STYLE ONLY.
- No new View / Animated.View.
- No new Animated.Value / loop / timer.
- No package or native dependency.
- No fetch / persistence / state / route mutation.
- No EAS build required.
- The pass reduces decorative contrast and edge fatigue while keeping the existing H2O engine untouched.

## Frozen
Auth/OIDC contracts, API business logic, Stripe, Dispatch, Orders state machine, Route Oracle business logic, Store metadata, EAS/native build.

---

# ARCHITECTURE PIN UPDATE - 2026-10-01 - CONFLUENCE TRUST CURRENT V1

## Couche IA explicable commune aux triplettes
- UI canonique du contrat : `apps/{client,courier,merchant}/ui/confluence/ConfluenceOracleLens.tsx`.
- Hook canonique : `apps/{client,courier,merchant}/ui/confluence/useConfluenceSuggestion.ts`.
- Les trois copies doivent rester byte-identical sauf décision architecturale documentée.
- Le serveur Confluence reste source de vérité pour `mode`, `evidenceIndexes`, `uncertainty`, `generatedAt`, `humanBoundary` et `actionSideEffects`.

## Contrat Trust Current
1. L IA ne décide pas : elle suggère.
2. Toute suggestion montre son moteur réel.
3. Toute suggestion montre combien de preuves ont été réellement utilisées.
4. Les preuves citées sont distinguées des signaux seulement disponibles.
5. L incertitude n est jamais maquillée en score de confiance.
6. Les facteurs qui peuvent faire changer la lecture sont rendus visibles localement.
7. Aucun nouveau call provider n est nécessaire pour cette transparence.
8. Client/Courier/Merchant conservent la frontière humaine et `actionSideEffects=false`.

## Frozen inchangé
- Auth/OIDC, Stripe, Dispatch, Orders state machine et actions métier restent FROZEN.
- Route Oracle business logic n est pas modifiée : uniquement sa couche explicative.
- Les builds actuellement soumis aux stores ne sont pas modifiés et aucun OTA n est poussé.

## Uncertainty taxonomy V1.1
- `facts_only` = uniquement des preuves classées fact.
- `contains_context` = au moins un signal contextuel et aucune estimation.
- `contains_estimates` = au moins une estimation.
- `insufficient_evidence` = aucune preuve exploitable.
- Interdiction architecturale : ne jamais afficher CONTEXTE comme FAIT et ne jamais convertir cette taxonomie en pseudo-probabilité sans calibration réelle.

## AI Passport contract V1.2
- Toute réponse Confluence contient `meta.providerStore=false`.
- Toute réponse Confluence contient `meta.sensitiveEvidenceTransit=false`.
- Ces champs sont des garanties de transport/stockage, pas des slogans marketing : le provider est appelé avec `store:false` et la détection d évidence sensible bascule en fallback local avant transit fournisseur.
- Le client ne doit jamais afficher « aucune donnée envoyée » : des preuves non sensibles peuvent être envoyées au provider lorsque le mode IA est réellement actif.
- Formulation UI autorisée : données sensibles bloquées / stockage fournisseur désactivé.

## Human agency layer V1.3
### Client / Counterflow
- La découverte alternative doit rester issue d une règle éditoriale transparente et de l intention courante, jamais d un profil sensible ou d une inférence culturelle.
- Le changement de courant est une action utilisateur explicite et réversible.

### Courier / Decision Sandbox
- Toute prévisualisation avant Accept/Reject reste 100% locale et sans side effect.
- Le texte doit décrire le contrat métier existant, jamais prédire un résultat futur non garanti.
- Aucun bouton de prévisualisation ne peut appeler les endpoints accept/reject.
- Accept, pickup et delivered restent trois gestes séparés.

## Integration discipline
- Les synchronisations avec `origin/master` doivent désormais être validées dans un `git worktree` sous `$HOME/DA_WORKTREES/`, jamais par rebase direct du worktree runtime `/opt/delishafrica/monorepo` tant que des sous-répertoires root-owned subsistent.
- Aucune modification chmod/chown opportuniste du repo runtime : corriger la propriété séparément, avec une opération dédiée et auditable si nécessaire.

## Mandatory Confluence preflight
- Commande canonique : `/home/afripayadmin/DA_WORKTREES/confluence-trust-current-integration-20261001/scripts/da_confluence_trust_gate.sh --full` dans la couveuse actuelle.
- Une fois mergé dans le repo officiel, utiliser `/opt/delishafrica/monorepo/scripts/da_confluence_trust_gate.sh --full`.
- Un échec du gate interdit merge, OTA et rebuild Store jusqu à correction.

## Zero-Leak Gate contract V1.4
- La première frontière de confidentialité est désormais locale dans `useConfluenceSuggestion`.
- Si une preuve ou la suggestion locale ressemble à une donnée sensible, le hook doit rester en mode `embedded` et court-circuiter l appel HTTP Confluence.
- Le serveur conserve ses propres gardes `requestContainsSensitiveEvidence` + scrub : défense en profondeur obligatoire.
- Le texte UI peut affirmer `transit serveur bloqué localement avant tout envoi` uniquement lorsque le garde local a effectivement court-circuité la requête.
- Les trois hooks Client/Courier/Merchant doivent rester byte-identical.

## Explainable fallback contract V1.5
- Tout fallback Confluence connu doit avoir une traduction humaine stable côté app ; ne pas masquer un guardrail derrière un message générique si le serveur fournit `fallbackReason`.
- Les messages doivent décrire le mécanisme réel (blocage, budget, indisponibilité, preuve insuffisante) sans inventer de diagnostic ni de probabilité.
- Le fallback reste une lecture déterministe sans side effect et ne doit jamais pousser l utilisateur à contourner un garde de sécurité.

## Blind-spot disclosure contract V1.6
- Confluence peut déclarer une inconnue uniquement lorsqu une preuve visible porte explicitement une valeur d absence ou de non-disponibilité reconnue.
- Interdiction de déduire un angle mort à partir d une identité, d une préférence sensible ou d une donnée non collectée.
- ANGLE MORT reste en progressive disclosure, jamais comme alerte anxiogène sur le parcours principal.
- L absence de donnée ne peut jamais être convertie en fait, score de confiance ou probabilité implicite.
- Les trois ConfluenceOracleLens.tsx doivent rester byte-identical.

---

# ARCHITECTURE PIN UPDATE - 2026-10-01 - PRIVATE CURRENT V1

## User-controlled AI transport
- Chaque Oracle expose un controle de session dans `ConfluenceOracleLens` : serveur autorise ou local uniquement.
- La source de verite du transport est un state local a l ecran ; elle alimente `useConfluenceSuggestion(enabled=...)`.
- `enabled=false` interdit toute nouvelle requete Confluence et conserve le fallback embarque.
- Toute requete en vol utilise `AbortController`; le cleanup annule le transport lors d un changement de contexte/mode ou demontage.
- Une annulation voulue ne doit jamais devenir un fallback d erreur visible.

## Invariants
1. Le mode local doit toujours etre utilisable sans compte IA fournisseur.
2. Le controle utilisateur ne doit jamais muter une commande, mission, paiement ou statut.
3. Le choix n est pas persiste tant qu une politique produit explicite ne l exige pas.
4. Les trois copies `ConfluenceOracleLens.tsx` et `useConfluenceSuggestion.ts` restent byte-identical.
5. Le gate doit verifier le controle local-only, l AbortSignal et les trois branchements ecrans.
6. Aucun build Store actuellement en review ne doit etre touche par ce laboratoire.

## Private Current V1.1 invariant
- enabled=false doit produire une copie explicite Local uniquement et ne jamais reutiliser un libelle ambigu de fallback serveur.

---

# ARCHITECTURE PIN UPDATE - 2026-10-01 - PROJECT MASTER CONVERGENCE

## Lignes de source actuelles
- `main`: branche GitHub par defaut, source historique Landing/public/legal/Courier framework.
- `master`: source historique Mobile 3 apps + API/runtime hardening.
- `reconcile/project-master-20261001`: laboratoire propre reunissant les deux lignes + Confluence Private Current; candidat au futur tronc unique, NON deploye.

## Invariant de convergence
1. Aucun futur travail Mobile/API ne doit supposer que `main` et `master` sont equivalentes tant que la reconciliation n'est pas mergee.
2. Aucun futur travail Landing ne doit ecraser les garanties Mobile/API venant de `master`.
3. Toute promotion du tronc reconcilie exige: API build, TSC 3 apps, Expo 3x2, Landing Node22 check/build, Confluence full gate.
4. Les builds actuellement devant Apple/Google restent geles; aucune innovation ne doit les modifier via OTA ou rebuild implicite.
5. Les worktrees experimentaux sont des sources d'information, jamais des sources de verite sans comparaison au tronc reconcilie.
6. Les quatre divergences Nightshift Client documentees dans le Roadbook restent HOLD jusqu'a arbitrage explicite.

## Runtime authority verifiee
- Orders/Payments authority: PostgreSQL primaire avec projection runtime de compatibilite.
- OrchidPay F3: transport prive Unix socket, role bounded evidence bridge, peer synchronization source-controlled.
- Confluence: suggestion-only, provider store disabled, sensitive transit fail-closed, user-selectable Local uniquement, no business side effects.


---

# ARCHITECTURE PIN UPDATE - 2026-10-01 - ALGORITHMIC RED LINE V1

## Contrat d'exclusion algorithmique
- `ConfluenceOracleLens` accepte `excludedSignals?: string[]` et rend ces exclusions uniquement dans la divulgation progressive.
- Une exclusion visible doit correspondre a une limite produit/code connue; ne jamais inventer une exclusion a partir d'une intention marketing.
- Les libelles sont scopes a "cette proposition" / "cette lecture" afin d'eviter toute generalisation excessive.

## Invariants Courier
1. `acceptanceRate` peut rester observable pour diagnostic, mais ne doit pas entrer dans `scoreCourier`.
2. Un refus de mission ne doit pas reduire l'acces futur aux missions via le score d'affectation.
3. Le gate Confluence doit echouer si `courier.acceptanceRate` reapparait dans le bloc de scoring.
4. La mention visible `Taux de refus` hors lecture ne peut etre conservee que tant que l'invariant de code reste verifie.

## Invariants transverses
- Client: ne pas utiliser identite sensible, origine supposee, historique cache ou donnees de paiement pour la lecture Taste Oracle.
- Courier: ne pas utiliser taux de refus, identite personnelle ou donnees de paiement pour la lecture Route Oracle.
- Merchant: ne pas utiliser identite client, donnees de paiement ou profilage historique pour la lecture Service Oracle.
- Aucun de ces affichages ne donne l'autorisation de collecter ces donnees; au contraire, ils documentent une frontiere.


---

# ARCHITECTURE PIN UPDATE - 2026-10-01 - EVIDENCE FIREWALL V1

## Contrat de preuve double-frontiere
- Frontiere appareil: `apps/{client,courier,merchant}/ui/confluence/useConfluenceSuggestion.ts::EVIDENCE_CONTRACT`.
- Frontiere serveur: `services/api-nest/src/confluence-ai/confluence-ai.policy.ts::ALLOWED_LABELS`.
- Les deux contrats doivent rester semantiquement alignes pour `taste`, `route` et `service`.

## Invariants
1. Tout label de preuve non autorise doit rester local et court-circuiter le reseau Confluence.
2. Un doublon de label ou un nombre de preuves superieur au scope autorise doit rester local.
3. Le garde Evidence Firewall doit s'executer avant `daOrdersFetch`.
4. Le garde de donnees sensibles reste independant et actif: Evidence Firewall ne le remplace pas.
5. Le serveur continue a normaliser, scrubber et allowlister meme si le client a deja valide le contrat.
6. Une extension future du perimetre de preuves exige une modification explicite des deux contrats + gate FULL GREEN.
7. En cas de divergence, le comportement attendu est fail-closed local, jamais un transit opportuniste.

---

# ARCHITECTURE PIN UPDATE - 2026-10-01 - SOVEREIGN SILENCE V1

## Confluence user-control contract
- Type canonique UI : `ConfluenceAiMode = server | local | silent`.
- Le state appartient à chaque écran Oracle et reste session-only.
- `server` => `useConfluenceSuggestion(enabled=true)` si l Oracle métier est actif.
- `local` => `useConfluenceSuggestion(enabled=false)` et la suggestion embarquée reste visible.
- `silent` => `useConfluenceSuggestion(enabled=false)` et `ConfluenceOracleLens` ne rend aucune suggestion/preuve Confluence ; uniquement le contrôle de réactivation.

## Invariants Sovereign Silence
1. SILENCE ne doit déclencher aucun appel Confluence réseau.
2. SILENCE ne doit afficher aucune suggestion Confluence, y compris un fallback local.
3. Le parcours métier sous-jacent doit rester totalement utilisable.
4. Le mode est non persistant tant qu aucune décision produit explicite ne change ce contrat.
5. La sortie du silence doit rester disponible sur le même écran sans navigation vers Settings.
6. Les trois Lens doivent rester byte-identical.
7. Le gate doit échouer si `confluenceNetworkEnabled` réapparaît ou si le tri-state n est plus branché sur une app.
8. Les builds Store actuellement en review restent gelés ; aucune promotion de ce laboratoire sans QA visuelle et décision explicite.

---

# ARCHITECTURE PIN UPDATE - 2026-10-01 - ATTENTION COVENANT V1

## Attention contract
- `ConfluenceOracleLens` maintient uniquement en mémoire React un `acknowledgedFingerprint`.
- `attentionFingerprint` = `JSON.stringify([aiMode, evidence(label,value,kind)])`.
- Après acknowledgement, si le fingerprint courant est identique : rendu compact `EN RETRAIT`.
- Si le fingerprint diverge : rendu complet automatique + rail `NOUVEAU SIGNAL`.
- Le texte généré, `generatedAt` et les variations de formulation fournisseur ne font pas partie du fingerprint : seule une variation du mode ou des preuves visibles regagne automatiquement l attention.

## Invariants Attention Covenant
1. Aucun état d attention ne doit être persisté entre sessions.
2. La réduction visuelle ne doit jamais masquer un changement de preuve.
3. `RELIRE` doit toujours permettre la reprise manuelle de la proposition.
4. Sovereign Silence reste prioritaire sur le Pacte d attention.
5. Aucun signal nouveau ne peut être ajouté au fingerprint hors Evidence Firewall sans mise à jour explicite du contrat.
6. Les trois Lens restent byte-identical.
7. Le gate vérifie Pacte, état de retrait, retour sur nouveau signal et absence de persistence.
8. Aucun binaire Store actuellement en review ne doit être modifié par cette branche.
