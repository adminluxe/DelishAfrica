# DELISHAFRICA — REPRISE QA IPHONE / AUTH FLUIDE / NATIVE MAPS — 2026-10-11

Statut : **CANDIDAT UNIQUEMENT** ; branche `fix/client-native-maps-auth-ux-20261011`, PR [#32](https://github.com/adminluxe/DelishAfrica/pull/32) **DRAFT**. Aucun merge, rebuild iOS, EAS Store, Stripe réel ou production modifiés.

## Incidents constatés sur dix captures iPhone

- La marketplace et le panier Client démarrent réellement ; panier La Boule Bleue, total 76 EUR ; progression jusqu'aux informations client et checkout.
- Checkout bloqué sans session OIDC : le serveur protège correctement le paiement mais la phrase « Session Client Keycloak requise » exposait un fournisseur technique à l'utilisateur.
- Erreur native `RNMapsAirModule could not be found` constatée sur deux captures. L'origine native exacte du binaire n'est pas prouvée. Le monorepo/Asus résolvaient néanmoins `react-native-maps@1.26.19` malgré `^1.20.1` ; le VPS conservait `1.20.1`. Ne pas attribuer automatiquement le crash à une seule cause sans test binaire.
- État actuel : **tests iPhone réels partiels**, mais **aucune validation de bout en bout des trois apps**. Merchant et Courier restent à confirmer sur appareil.

## Correctifs proposés PR #32

1. `apps/client/package.json` + `apps/courier/package.json` + `pnpm-lock.yaml` : version `react-native-maps` fixée exactement à `1.20.1` (intégrité du package référencée depuis la baseline verrouillée du VPS).
2. `apps/client/utils/daOrdersApi.ts` : erreur d'absence d'identité protégée et typée `DA_CLIENT_AUTH_REQUIRED`, aucune mention de Keycloak dans le message remonté.
3. `apps/client/app/checkout-preflight.tsx` : vérification OIDC avant préparation du paiement et avant les appels de vérification SMS/email/adresse ; invitation DelishAfrica, panier conservé ; retour uniquement au préflight après connexion ; **aucun paiement automatique**. Paiement déjà confirmé sans session : proposer reconnexion pour réconciliation **sans second débit**.
4. `apps/client/app/secure-session.tsx`, `auth-session.tsx`, `client-space.tsx` : wording DelishAfrica, message sûr sans code/token/Keycloak apparent, connexion réutilisant l'authentification existante.
5. `apps/client/hooks/useDaPkceAuth.ts` : suppression de `prompt=login` systématique pour autoriser SSO existant ; **PKCE + nonce + vérification identité conservés**.
6. `apps/client/app/maps-live-lab.tsx` : ne charge les sous-composants importateurs de Maps qu'après chargement natif protégé ; fallback de suivi déjà existant.
7. `apps/courier/app/courier-integrated-map.tsx` et `courier-native-map-smoke.tsx` : erreur d'import natif interceptée ; fallback de mission et indication explicite qu'un binaire compatible est nécessaire ; aucun faux PASS cartographique.
8. `.github/workflows/pr32-mobile-gate.yml` : vérification automatique `pnpm@9.15.4` lockfile gelé, types 3 apps, absence de Keycloak visible, intégrité maps.
9. Aucun accès backend/API/Stripe/Store/Cloudflare/Meta/Keycloak realm modifié.

## Contrôles et problèmes d'environnement

- Asus : source QA isolée `C:\Users\Valérie\Documents\DA_PR32_SAFE_QA_20261011\workspace` créée depuis une copie des apps et fichiers PR téléchargés avec empreintes Git vérifiées. Fichiers corrigés contrôlés 9/9, puis incréments 4/4 contrôlés. `tsc --noEmit` **Client PASS**, **Merchant PASS**, **Courier PASS**, relance Client/Courier **PASS** après ajout des garde-fous Maps.
- Les dépendances de la copie QA Windows pointent encore sur le `node_modules` antérieur (**Maps 1.26.19**) ; le succès TypeScript n'est pas un test de chargement natif Maps 1.20.1.
- Premier essai checkout Git Windows rejeté à cause d'anciens chemins racine contenant `:` incompatibles Windows. Git clone sparse Linux sur Toshiba a aussi signalé une corruption d'objet durant le checkout de fichiers (machine fragile). Aucun dépôt actif du VPS touché. La solution QA Asus utilise un export ciblé et des contrôles de hashes.
- GitHub CI : le premier essai de vérification avec `pnpm install --frozen-lockfile` a détecté un **lockfile obsolète pour apps/landing**, anomalie préexistante non liée aux cartes. Le workflow PR32 restreint temporairement la liste des workspaces mobiles **dans le runner uniquement**, conserve le lockfile gelé. Résultat du dernier job à confirmer.
- Keycloak : page réelle publique de login consultée en GET sur `keycloak.afritaste.delishafrica.me` ; titre affiché « Sign in to afritaste » et libellés par défaut en anglais. **La marque du formulaire hébergé n'est donc pas encore DelishAfrica.** Prévoir theme/realm branding contrôlé, en conservant issuer, PKCE et clés/claims existants. Aucune configuration Keycloak changée.
- Originaux Metro **toujours actifs** sur Asus `192.168.1.5:8081` Client, `8082` Merchant, `8083` Courier ; source PR32 **NON injectée sur Metro en cours**. Conventions ports VPS différentes : NE PAS intervertir.

## GATES avant intégration

- GitHub CI mobile complet PASS ; check pnpm lockfile + cache propre ; revue de la version native Maps réellement embarquée dans les binaires iOS.
- Test physique Client iPhone : parcours guest -> panier -> identité -> sign-in de marque -> retour au checkout sans paiement déclenché ; vérifier aussi logout / nouvelle identité, absence de réutilisation de données d'un autre compte.
- Test Maps sur iPhone Client/Courier ; si binaire sans module natif, créer DEV build certifié avec identifiants EAS contrôlés, sans Store submission et avec versions monotones.
- Merchant/Courier sur iPhone ; Android 13 ensuite ; paiement uniquement **sandbox**, vérifier anti-doublons et restitution du panier.
- Rebranding Keycloak de la page de login : séparé de l'interface. Pas de modification d'issuer ni d'auth backend tant que la stratégie DNS/theme n'est pas auditée.
- **INTERDIT :** publication store, Stripe réel, fusion PR, modification des ports canoniques, publication sociale avant validation explicite et preuves sur appareils.

— Passation DelishAfrica®, 2026-10-11
