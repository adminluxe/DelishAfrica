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

## Zero-Leak Gate contract V1.4
- La première frontière de confidentialité est désormais locale dans `useConfluenceSuggestion`.
- Si une preuve ou la suggestion locale ressemble à une donnée sensible, le hook doit rester en mode `embedded` et court-circuiter l appel HTTP Confluence.
- Le serveur conserve ses propres gardes `requestContainsSensitiveEvidence` + scrub : défense en profondeur obligatoire.
- Le texte UI peut affirmer `transit serveur bloqué localement avant tout envoi` uniquement lorsque le garde local a effectivement court-circuité la requête.
- Les trois hooks Client/Courier/Merchant doivent rester byte-identical.

## ADDENDUM 2026-10-09 — GUEST CHECKOUT (BRANCHE ISOLÉE)
- Nouvelle architecture cible Client : commande sans compte obligatoire, principal invité scellé, validation Stripe serveur, récupération sûre des commandes.
- Palier 1 codé en worktree indépendant : guest-capability HMAC, preview interdite en production, tests P0 et copy Radar clarifiée.
- ZÉRO déploiement et zéro paiement invité activé.
- Document canonique de ce palier : docs/guest-checkout/ARCHITECTURE_GUEST_CHECKOUT_PIN_20261009.md.
- Voir docs/guest-checkout/ROADBOOK_GUEST_CHECKOUT_20261009.md pour les gates manquants avant activation.

## ADDENDUM 2026-10-09 - GUEST LEDGER P2
- P2: stockage invité PostgreSQL préparé, sans PII ni token brut ; contrôle par SHA256 du jeton signé.
- Migration SQL : migrations/20261009_guest_checkout_ledger.sql (NON APPLIQUÉE).
- Nouveau ledger : transitions atomiques ISSUED -> QUOTED -> PAYMENT_PENDING, devis immuable, PaymentIntent unique, tests en mémoire.
- Le ledger n'est exposé à AUCUNE route REST ; Stripe réel et Order commit non branchés.
- Source canonique : docs/guest-checkout/ARCHITECTURE_PIN_STAGE2_20261009.md.

## ADDENDUM 2026-10-09 — GUEST FINALIZER P3
- Chaîne serveur Stripe HMAC -> récupération Stripe API -> vérifications de charge -> transaction PG unique payment/outbox.
- Ledger financier invité non expédiable, aucune PII et aucun compte pro impacté.
- SQL production non migré. Architecture : docs/guest-checkout/ARCHITECTURE_PIN_STAGE3_20261009.md.

## ADDENDUM 2026-10-09 — P4 ENCRYPTED ORDER CONTEXT
- Le contexte de livraison est chiffré AES-256-GCM avec AAD orderId et empreinte HMAC.
- Devis imposé par catalogue serveur, context+état de devis écrits en transaction PG.
- Aucune exposition HTTP et aucune livraison/commande réelle activée à ce stade.
- Architecture : docs/guest-checkout/ARCHITECTURE_PIN_STAGE4_20261009.md.

## ADDENDUM 2026-10-09 - GUEST P4 AES VAULT
- Dossier privé de commande invité chiffré AES-256-GCM, avec AEAD AAD (orderId et quote), MAC et clé de versionnage.
- Trigger DB bloquant tout PAYMENT_PENDING/PAID/COMMITTED sans payload de livraison scellé et concordant.
- Payment P3 confirmé -> préparation interne d'ordre P4, transaction unique, aucun dispatch public.
- Interdiction de contact professionnel, une route publique ou un suivi client tant que les flux P5 n'ont pas été validés.
- Architecture détaillée : docs/guest-checkout/ARCHITECTURE_PIN_STAGE4_20261009.md.

## CONFLIT P4 RESOLU — 2026-10-09
- Deux modules P4 ont été produits dans deux worktrees et conservés dans la branche Guest Checkout.
- CANONIQUE FUTUR : GuestPrivateFulfillmentVault + Ledger P2 + finalizer P3 + preparer P4.
- ALTERNATIVE LAB : GuestCheckoutQuoteContext/guest-delivery-vault (non câblé en production, ne pas dupliquer les données personnelles).
- Décision : docs/guest-checkout/CONSOLIDATION_P4_DEUX_COFFRES.md.
- Notes historiques restaurées : docs/guest-checkout/history/.

## ADDENDUM 2026-10-09 — GUEST P5-A
- Nouvel orchestrateur interne `GuestCanonicalCheckoutStager` : quote uniquement côté CatalogOrderPolicyService, relecture Google Place via LocationTrustService backend, couverture Merchant dédiée avant scellement AES-GCM.
- Les valeurs `amount`, `city` et `address` envoyées par le téléphone ne font jamais autorité.
- Pilotage territorial conservateur Bruxelles, codes postaux définis, puis couverture par partenaire à implémenter.
- Aucun PaymentIntent, aucune route public guest, aucune commande pro exposée.
- Architecture épinglée : docs/guest-checkout/ARCHITECTURE_PIN_STAGE5A_20261009.md.

## ADDENDUM P5-B STRICT MERCHANT COVERAGE 2026-10-09
- Vérification couverture réelle propriétaire par restaurant: Catalogue publié, statut actif, livraison activée, zone V1 approuvée Merchant ET Ops, code postal + rayon GPS.
- Pas d'autorisation fondée sur `serviceAreaLabel`; aucun fallback de livraison par défaut.
- Contrat de configuration : `delivery.guestCheckoutCoverage`. Tant que non renseigné/approuvé, toutes les commandes invitées sont refusées.
- Aucun endpoint public, Stripe Intent, migration prod ni autorisation de commande Guest activé.
- Voir `docs/guest-checkout/ARCHITECTURE_PIN_P5B_MERCHANT_COVERAGE.md`.

## CORRECTIF DE SÉCURITÉ 09/10/2026 : APPROBATION OPS INDÉPENDANTE P5-B
- Le champ marchand `approvedByOps` n'est plus une preuve : ses éventuelles mentions antérieures sont OBSOLÈTES.
- La zone est calculée depuis le catalogue publié et actif, avec pays, code postal, rayon, révision, approbation marchand.
- La permission finale exige une entrée PostgreSQL **Ops distincte**, portant le SHA-256 du contrat normalisé et du partenaire, ni révoquée ni expirée.
- L'adaptateur checkout ne peut que lire les approbations. Le workflow Ops RBAC pour écrire ces autorisations reste À CONSTRUIRE.
- En absence de preuve indépendante : REFUS, aucun contournement par libellé `serviceAreaLabel`.
- Architecture canonique : docs/guest-checkout/ARCHITECTURE_PIN_P5B_MERCHANT_COVERAGE.md.

## P5-C CROSS-BRANCH GATE : LIVE COVERAGE RECHECK
- Deux modèles distincts de périmètre Ops: `da_guest_coverage_ops_approvals` par empreinte versionnée ET `da_guest_merchant_coverage` par zone Ops directe. Les deux sont des prototypes, jamais les activer simultanément.
- Avant tout PaymentIntent invité, relire la couverture RESTAURANT+OPS au moment exact de la réservation pour couvrir la révocation entre devis et paiement.
- Le coffre P4 ne porte pas encore toutes les preuves de position (placeId, coord. GPS, code postal, révision/digest d'autorisation); un schéma versionné chiffré est nécessaire pour la revalidation.
- Tests P0 attendus avant merge: Ops révoqué à T1, tentative paiement à T2, refuse sans créer Stripe; base Postgres indisponible => fail closed.
- Note: docs/guest-checkout/P5C_CROSS_BRANCH_SECURITY_REVIEW_20261009.md.
