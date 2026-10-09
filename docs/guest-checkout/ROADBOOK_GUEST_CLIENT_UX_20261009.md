# DELISHAFRICA — GUEST CLIENT UX PREVIEW / SECURITY GATE
Date : 9 octobre 2026.
Statut : SDK Mobile local codé et vérifié ; aucune modification du paiement en production.

## Séparation des chantiers
Branche backend Guest Checkout : feature/client-guest-checkout-secure-20261009 (commit P4 1427703).
Un travail financier parallèle apparaît dans ce worktree ; aucun fichier extérieur non identifié n'a été écrasé ou commité.
Branche UI isolée : feature/client-guest-ux-preview-20261009.
Worktree UI : /home/afripayadmin/worktrees/guest-client-ux-20261009.
Le dépôt actif /opt/delishafrica/monorepo n'a pas été modifié.

## Fichiers mobiles complets
- apps/client/utils/guestCheckoutDraftVault.ts
- apps/client/utils/guestCheckoutDraftSecureStore.ts
- apps/client/tests/guest-checkout-draft.test.cjs
- scripts/da_guest_client_draft_gate.sh

## Ce qui est réellement validé
- Le jeton d'une commande invitée peut être conservé localement dans SecureStore, jamais dans les logs, URLs, AsyncStorage ou statistiques.
- Aucun nom, courriel, numéro ou adresse n'est mémorisé dans ce jeton.
- Refus d'un jeton malformé, de la dégradation des états ou du remplacement silencieux d'une commande en paiement.
- Lorsqu'une session de paiement est expirée, elle reste disponible localement pour la reprise serveur. Un brouillon sans paiement est effacé à expiration.
- Tests unitaires Node : 5/5 PASS.
- TypeScript de l'application Client : PASS.
- Aucun bouton cassé ni écran de paiement guest prématurément montré au client.

## Suite P5 indispensable
- Attendre le contrat serveur Guest Checkout complet : start / quote / payment-intent / receipt / tracking.
- Ajouter le branchement mobile derrière un drapeau de lancement sous contrôle.
- Préserver le design DelishAfrica nombre d'or, gestes, paiement Stripe et sécurité.
- Empêcher un double paiement lorsque Client récupère une commande après fermeture.
- Tests iOS + Android physiques, en mode laboratoire avant build/revue.
- Aucun retrait forcé de Keycloak tant que Guest Checkout complet n'est pas prêt et audité.

## Décision
Le chantier UI est découplé pour accélérer sans collisions. La fluidité finale est encore un objectif, pas une promesse déjà livrée. Le stage UI est une fondation testée, sans intégration de production.
