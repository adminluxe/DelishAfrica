# HF33 — Triplette QA 3.0.4, reprise avant essais partenaires

## État vérifié au 2 novembre 2026

Source mobile publiée : `4b6f79d77ba7a68ece345e313d575dc41860ef13`.
Branche privée : `fix/ataraxie-hf33-merchant-coherence-20261102`.
100/100 tests ; TypeScript Client/Merchant/Courier ; API compilée ; six exports.
Six mises à jour QA publiées et servies. Manifestes vérifiés (projet, canal,
runtime 3.0.4, API QA) et SHA256 des six bundles téléchargés vérifiés.
Les canaux et groupes de production ont été relus après publication : inchangés.

La réception et le fonctionnement sur les téléphones ne sont PAS encore attestés.
Le parcours payé Client → Merchant → Courier n'est PAS certifié.

| App | Plateforme | Canal | Groupe |
| --- | --- | --- | --- |
| merchant | ios | ataraxie-ios-qa | d4f5b1bc-dcda-4205-8c3a-340006907128 |
| merchant | android | ataraxie-closed | 04d9831a-dbc0-4392-a289-9621e4334074 |
| client | ios | ataraxie-ios-qa | ed55e399-34e7-44b7-81e5-e43370897a01 |
| client | android | ataraxie-closed | e76b3963-e2ce-49f2-9bf7-2591db053c85 |
| courier | ios | ataraxie-ios-qa | 7a231b45-edda-410d-a10b-d62d985fd758 |
| courier | android | ataraxie-closed | 5df2e33d-3a07-4bcb-bc72-2e765caf5d00 |

## Corrections

- Onze lecteurs d'environnement unifiés ; neuf appels compilés reproduits vers
  la production avant correction, puis vers QA après correction.
- Identité API Merchant strictement vérifiée contre le sujet OIDC ; distinction
  entre connexion, rattachement au catalogue et adhésion admissible.
- Portées de stockage par compte et environnement ; aucune migration automatique
  des anciennes preuves à provenance incertaine. Les anciennes clés sont conservées.
- Contrats JWT existants appliqués à Client/Courier ; protection des écritures
  de session, regroupement des refresh, refus des réponses tardives après logout.
- Merchant : invalidation immédiate des écrans lors d'un changement d'identité,
  contrôle des réponses JSON tardives, compteurs inconnus distincts d'une liste vide.
- Affichage monétaire uniquement sur des unités explicites dans les écrans corrigés.
- Conservation des alertes alimentaires existantes dans le lecteur Merchant.
  Le patch de projection API est préparé séparément, non déployé.
- Courier : absence d'ACK explicite du serveur ne confirme jamais la disponibilité.

## Blocages restants

1. Merchant : l'ancien interrupteur ne faisait qu'une écriture locale. Aucune
   route serveur d'ouverture/fermeture n'existe dans le contrôleur courant.
   Le correctif refuse donc de présenter cette écriture comme une ouverture.
   Un contrat serveur doit encore définir disponibilité, fermeture et incidence
   sur les nouvelles commandes, avec rattachement et adhésion vérifiés.
2. Paiements QA : `stripeConfigured=false`, `mockOrderCommitAllowed=false`.
   Il faut une configuration TEST valide, puis une confirmation réelle du prestataire.
   La fixture HF30 non payée ne doit jamais servir de preuve de paiement.
3. Recette physique : connexion réelle, même établissement et même commande dans
   les trois apps, montants/devise stables, préparation, retrait, trajet et remise
   confirmés par le serveur. Tester aussi coupure réseau et changement de compte.
4. Anciennes preuves : l'ancien lecteur pouvait choisir la production. Les données
   sont conservées, mais ne prouvent pas une vérification QA. Ne pas renvoyer des
   OTP en boucle ; établir d'abord la provenance et la réponse du serveur cible.

## Provenance du serveur QA et rapprochement ATM

Image QA observée :
`delishafrica-ataraxie-api:hf29-e00f9ca-sandbox-20261102`.
Commit correspondant retrouvé via GitHub :
`e00f9ca6436959ec766b2556deb1637795beca8a`.
Le Dockerfile HF29 ajoute un `dist` à l'image QA précédente.
Aucun remplacement de ce serveur n'a été réalisé dans HF33.

PR backend #77 : `d27b55e4b34a6dd67e876e9e530383b78535b936`, DRAFT.
PR ATM #50 : `2b4c96d08d23769c602942aa7f1cdbec85a22cb7`, DRAFT.
Ne pas remplacer ces travaux avec l'ancien snapshot de la triplette.
Le correctif de projection d'allergènes est isolé dans
`hf33-canonical-safety-only.patch` dans le dossier de preuves.
Son fichier de départ correspond au blob GitHub `ae2356d4`.

## Prendre la mise à jour

Ouvrir le build QA 3.0.4 avec Internet ; laisser le téléchargement se terminer ;
fermer complètement et relancer. Vérifier ensuite l'identité API et le véritable
établissement dans Merchant. La version native reste 3.0.4.

## Retour arrière

Aucun groupe QA antérieur n'était présent. Le retour préparé vise le code embarqué
du build natif, exclusivement sur le canal QA, la plateforme et le runtime 3.0.4 :

```bash
eas update:roll-back-to-embedded --channel ataraxie-ios-qa --platform ios --runtime-version 3.0.4 --message "Rollback HF33 QA" --non-interactive --json
eas update:roll-back-to-embedded --channel ataraxie-closed --platform android --runtime-version 3.0.4 --message "Rollback HF33 QA" --non-interactive --json
```

Exécuter seulement depuis l'app concernée, après vérification du projet EAS.
Aucun rollback n'a été exécuté.

## Preuves

Répertoire privé VPS : `/home/afripayadmin/DA_RUNTIME/DA_ATARAXIE_20261031/audit-hf33-20261102`.
Checkpoint : `HF33_CHECKPOINT.json`.
Tests : `all-regressions-final.log`.
Canaux : `ota-channel-preflight.json`.
Manifestes : `ota-published-manifests.json`.
Rapport : https://chatgpt.com/library?file_id=libfile_2f24ca4124a88191beb46a0cffa450e5&account_id=300b6b60-b5cc-4726-9551-c496cdb842ca
Action interne : `recy6pdo9ZQB2BTQ9` ; preuve : `recBDbfVVWVItHor4`.

Inventaire automatisé : 569 fichiers / 84 744 lignes. Lecture ciblée des parcours
critiques ; cette passe ne vaut pas revue manuelle exhaustive de tout le code.
