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
