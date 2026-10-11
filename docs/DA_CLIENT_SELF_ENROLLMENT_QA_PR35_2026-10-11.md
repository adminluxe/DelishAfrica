# DELISHAFRICA — ROADBOOK CLIENT SELF-ENROLLMENT, EAS AND IPHONE QA
**Date : 2026-10-11 — PR #35 DRAFT, stacked on PR #32. NO LIVE CHANGE.**

## Situation prouvée, directement auditée
- Les 3 apps Client/Merchant/Courier sont visibles sur de vrais iPhones. Client affiche 3/3 preuves adresse/SMS/e-mail, mais le domaine Keycloak public ne propose pas de création de compte : le client n'obtient pas d'identifiants.
- Keycloak `afritaste` 26.4.7 : inscription OFF, vérification email OFF, récupération mot de passe OFF, SMTP absent. 33 utilisateurs actifs existants. Les applications OIDC sont activées et séparées par `azp`/`aud` ; le rôle de royaume `client` est explicitement obligatoire pour l'API. Le rôle `client` ne figure PAS dans les rôles par défaut du realm. **Ne pas activer l'auto-inscription globale.**
- Infrastructure après le nettoyage précédent : API VPS HTTP200, zéro commande et zéro événement dans les tables consultées. Les commandes historiques Stripe TEST ont été archivées, sans suppression chez Stripe.
- Appareils enregistrés EAS internes sous équipe Apple AfriFood Global : iPhone XR + un autre iPhone. L'iPhone tiers Purple Eco-Value n'est pas identifié comme enregistré. Build Client IOS DEV existant du 19 septembre, version 3.0.0, EAS build ID `a3c88664-7c99-4834-9314-f78d2d47f8ef`.
- IPA téléchargé en local privé sur Toshiba et analysé : bundle `com.delishafrica.client.dev`, AIRMap présent en natif, RNMapsAirModule absent. L'alignement JS `react-native-maps=1.20.1` est candidat, **pas encore attesté tactilement**.

## Code candidat implémenté dans PR #35 (non déployé)
- Backend `services/api-nest/src/client-enrollment/` : endpoint GET readiness, POST register ; preuves email+SMS signées et validées par l'API, rôle fixe `client`, consentement, phrase secrète forte, UUID de requête.
- Base PostgreSQL : migration additive `services/api-nest/migrations/client-enrollment/20261011_001_client_enrollment_guarded.sql` ; e-mail/téléphone et preuves uniquement sous forme de HMAC, unicité, anti-rejeu et limitation du demandeur.
- Compte de service Keycloak dédié, futur : accès uniquement en Docker privé `http://afritaste-keycloak:8080`, rôle de royaume `client` vérifié. **Le compte créé reste désactivé jusqu'à la preuve de rôle puis activation finale.** Échec de provisionnement : blocage et désactivation, revue humaine.
- Frontend : `apps/client/app/activate-account.tsx`, lien depuis `client-space.tsx` et `secure-session.tsx`; confirmation 2 preuves, création compte et retour OIDC PKCE ; aucune requête de paiement déclenchée.
- Profil invité → nouveau compte : transfert seulement après `/auth/client/me` conforme, e-mail identique et preuves SMS + email attestées à nouveau. Pas de migration entre comptes différents.
- Feature flag fail-closed `DA_CLIENT_ENROLLMENT_ENABLED`, gate `DA_CLIENT_ENROLLMENT_SECURITY_GATE`, HMAC secret, service account credentials ; OFF sur serveur live.
- GitHub CI de la PR #35 : **SUCCESS**, compilation TS API + Client/Merchant/Courier, installation PNPM gelée, tests Keycloak mock (rôle Client et erreurs) et garde statique. À répéter après chaque modification.

## Machines et tests en cours
- Asus : copie de QA séparée `C:\Users\Valérie\Documents\DA_CLIENT_ENROLL_QA_20261011\workspace` ; 4 fichiers frontend PR #35 récupérés et hashes Git vérifiés, TypeScript Client PASS. Metro QA indépendant sur `http://192.168.1.5:8095`, manifeste iOS identifié DelishAfrica Client et bundle iOS à vérifier après correction des jonctions PNPM ; les serveurs officiels 8081/8082/8083 et QA 8091/8093 restent inchangés.
- Toshiba : IPA uniquement dans `/home/tontoncestcarre/work/DA_IPA_AUDIT_20261011/client_dev_20260919.ipa` — fichier binaire Apple propriétaire de notre application, garder privé.

## Gates stricts pour la mise à disposition
1. Examiner la sécurité de la migration, la rollback et les permissions fines du compte de service (Keycloak FGAP) : ne PAS attribuer `manage-users` global si l'on peut éviter.
2. Compléter un mécanisme sûr de récupération de compte sans accès à un quelconque secret utilisateur ; personnaliser la page et les e-mails DelishAfrica FR/EN (actuellement "Sign in to afritaste").
3. Tester véritablement un nouveau compte Client, `GET /auth/client/me` rôle/issuer/aud/azp/subject et cross-role 401/403 ; ajouter tests d'abus/réutilisation identité.
4. Test manuel iPhone autorisé, nouveau profil isolé, panier préservé, connexion, checkout, bouton paiement Stripe TEST seulement. Jamais de paiement réel ni d'exécution automatique au callback.
5. L'iPhone tiers nécessite un enregistrement Apple si absent ; option `eas build:resign` sur IPA compatible sans recompilation, après vérification des dépendances natives et expiration profile. Ne rien déclencher de payant maintenant.
6. Enregistrer un ID unique de transaction Stripe TEST, puis le suivre sur Merchant et Courier, suivi GPS/ETA, confirmations et vérification des tableaux de bord, Android ensuite.
7. **HOLD** : PR #35 DRAFT, PR #32 DRAFT, aucun merge, aucune EAS build, aucun Store push, aucune configuration Keycloak realm modifiée, aucun Stripe live.

Liens : https://github.com/adminluxe/DelishAfrica/pull/35 ; https://github.com/adminluxe/DelishAfrica/issues/33 ; https://github.com/adminluxe/DelishAfrica/issues/34