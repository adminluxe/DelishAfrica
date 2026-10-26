# DELISHAFRICA R6E — REPRISE FINALE CLIENT 26-10-2026

## Décision immédiate
Clôture des frictions UX qui empêchaient le parcours 2/2 preuves → adresse, sur la branche Client QA. Ne pas confondre l'attestation des contacts de l'iPhone, le brouillon SecureStore et une inscription OIDC réelle.

## Preuves réelles
- Capture iPhone reçue à 20h12 : SMS confirmé, e-mail confirmé ; avant patch, une alerte bloquante « Contact confirmé » demandait encore OK. Ne pas diffuser le code OTP ou les coordonnées visibles sur la capture.
- Correctif R6E : succès SMS/e-mail désormais signalé sans popup modale ; après vérification du deuxième contact, navigation automatique à l'étape livraison, sans revalidation et sans nouvelle saisie.
- Preuves signées, attestation API, SecureStore et isolation par identité inchangés.
- TypeScript QA sur VPS et ASUS : PASS. Expo Metro ASUS `http://192.168.1.5:8095` : bundles iOS et Android HTTP 200.
- Client Enrollment API de production : `GET readiness enabled=false`, `POST register` HTTP 503. Base `da_client_enrollments` sans inscription de ce module. Aucune prétention de nouvelle création de compte.
- Keycloak production : 10 comptes possèdent le rôle Client et sont actifs + e-mail vérifié. Le contact e-mail employé sur la capture correspond à une identité Keycloak professionnelle **Merchant**, sans rôle Client et avec e-mail Keycloak non vérifié. Cette vérification n'expose ni adresse e-mail ni utilisateur dans ce rapport. Son statut ne peut être changé automatiquement par le parcours Client. Ne pas mélanger rôles/répertoires ou lier son profil local à une autre identité sans autorisation.
- Catalogue API `/api/v1/partners` : cinq fiches ; THIEYP et LA BOULE BLEUE disponibles avec respectivement 13 et 46 éléments de menu. Routes QA `/restaurants` et `/restaurant/[id]` puis `/menu?restaurantSlug=...` inspectées.
- Tests de sécurité Client Enrollment mockés : 11/11 PASS (ordre de commit, échec DB, désactivation compensatoire, rôle Client strict et Endpoint Keycloak privé).
- Twilio R6D déjà récupéré/jeton remplacé ; inchangé dans cette étape.

## Source et garde-fous
- Branche QA isolée : `qa/r6c-client-simplified-20261026`.
- Commit UX R6E : `61932e9`, PR #75 DRAFT.
- Fichier complet : `apps/client/app/client-space.tsx` de cette branche ; source synchronisée sur ASUS et VPS QA.
- Restaurations : `/home/afripayadmin/DA_EXPORTS/DA_R6E_CLIENT_UX_20261026/client-space.tsx.before` et copie ASUS du fichier précédent.
- Aucun reset du monorepo production, aucun rôle Keycloak modifié, aucun paiement Stripe LIVE, aucune suppression de profils ou de comptes, aucun Store push.

## Critères restant à prouver pour ouverture publique
1. Architecture sûre de création des seuls comptes Client : compte technique encore absent et FGAP pas certifié pour gérer seulement les identités Client. Les rôles universels `realm-admin`/`manage-users` demeurent interdits. Environnement activé uniquement après preuve négative de droits Merchant/Courier et récupération email réelle.
2. Ne pas réemployer un principal Merchant comme Client. L'app doit rester honnête : contacts confirmés ≠ compte créé. Compte Client existant seulement quand le token JWT signé et le backend `/auth/client/me` valident le rôle.
3. Parcours tactile iPhone + Android : sans popups superflues, carte restaurant réelle → menu → panier → checkout TEST → Merchant → Courier → livraison et tracking, même ID.
4. Publication Stores uniquement depuis un candidat reproductible, avec historique de QA et approbation de sécurité. R6E n'est pas une version Store.

## Décision
UX CONTACTS=PASS_QA, BUILD_IOS_AND_ANDROID=PASS.
CLIENT_ONBOARDING_PUBLIC=NO_GO (enrollment intentionally off; service account not scoped).
PRODUCTION_TRANSACTIONAL_RELEASE=NOT_YET_CERTIFIED.
