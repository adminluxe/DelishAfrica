# DelishAfrica Ataraxie - préparation Android 3.0.4

État vérifié le 1 novembre 2026. Candidat privé, non publié.

## Portée

Trois nouveaux AAB Android destinés exclusivement à la piste fermée Alpha.
Les builds 3.0.3 existants restent disponibles : Client 13, Merchant 13,
Courier 12. Ils ne contiennent pas les changements Ataraxie.
Aucune production Play, aucune invitation, aucun changement de package ni
publication iOS. Aucun push vers le dépôt GitHub public.

Le profil EAS `ataraxie-closed` produit une version Android 3.0.4 uniquement
lorsque DA_ATARAXIE_ANDROID_BUILD=1 et EAS_BUILD_PLATFORM=android.
Les prochains versionCodes attendus sont 14 / 14 / 13, à confirmer dans EAS
avant tout envoi Play. Aucune incrémentation n'a encore été lancée.
Le profil utilise l'environnement EAS production existant pour récupérer les
variables autorisées, mais son canal et ses URL API sont propres au test.
Aucune commande de soumission automatique n'est prévue.

## API candidate vérifiée localement

Image : delishafrica-ataraxie-api:qa-ataraxie-routes-20261101.
Conteneur QA : da-ataraxie-api-qa, accessible uniquement sur 127.0.0.1:4313.
PostgreSQL, Redis, fichiers de suivi et secrets d'authentification propres à QA.
Aucune donnée de commande ni secret d'authentification de production copié.
Le schéma catalogue a été initialisé dans la seule base QA.

Santé : HTTP 200 ; catalogue : HTTP 200 ; commandes sans session : HTTP 401.
Le nouveau POST /api/v1/routes/mission-preview renvoie 401 sans session,
403 pour un jeton dev-login, 200 pour une identité externe QA éligible.
L'essai authentifié utilise un jeton éphémère créé uniquement avec le secret
QA et des coordonnées de lieux publics. Aucun compte réel n'a été usurpé.
Sans clé Google, la réponse est explicitement fallback_haversine, sans tracé.
Ce résultat ne valide pas encore le moteur Google réel.

Le nouvel endpoint autorise les rôles client, courier et merchant vérifiés,
valide coordonnées/mode/mission et ne transmet que les champs attendus.
Limites en mémoire : 8 requêtes/min/compte, 60/min/instance, 500/jour/instance.
Ces compteurs sont remis à zéro au redémarrage et ne constituent pas un
plafond financier Google Cloud. Les quotas et restrictions Google restent
à vérifier avant utilisation réelle.
Le prévisualiseur public historique ne peut pas consommer la clé Google.
La clé Routes doit rester sur le serveur ; elle ne doit jamais entrer dans
les apps, les archives sources, les journaux ni les variables Expo publiques.

## Contrôles effectués

- 25 tests ciblés du candidat initial : réussite.
- 8 tests de routage authentifié et de chargement de clé fictive : réussite.
- TypeScript Client, Courier et Merchant après les préparatifs : réussite.
- TypeScript API et compilation Nest après ajout du routage : réussite.
- Configuration Android : 3.0.4 et packages conservés pour les trois apps.
- Configuration et version iOS inchangées dans les trois résolutions comparées.
- Injection de la clé Maps Android contrôlée avec une valeur fictive locale.
  Aucun build ne doit être publié avec cette valeur fictive.
- Les exports JS Android/web du candidat initial sont documentés dans REVIEW.txt.
- Archives locales EAS : réussite pour les trois profils Android, 1131 chemins
  chacun ; aucun chemin sensible détecté et aucune correspondance aux motifs
  de clés privées, clés Google, secrets OAuth ou Stripe testés. Ce contrôle
  ciblé ne constitue pas un audit exhaustif de secrets. Aucun envoi effectué.

Aucun AAB 3.0.4 construit, aucun essai physique Android effectué.
Le partage GPS reste limité au premier plan ; un guidage externe le suspend.
L'API de test utilise des données isolées : une commande et des comptes de
terrain réels doivent être préparés/validés avant l'essai marchand complet.

## Blocages et décisions nécessaires

1. Une clé Maps SDK for Android existe dans l'environnement EAS Courier.
   Aucune clé Client n'a été trouvée dans son environnement EAS ni son app.json.
   Les restrictions des clés doivent être contrôlées dans Google Cloud avec
   les packages et certificats Play relevés dans android-play-certificates.json.
   La console Google Cloud affiche Site Unavailable dans le navigateur utilisé.
   Une clé Client dédiée, limitée au Maps SDK Android et aux certificats Play,
   constitue la préparation recommandée. Ne pas réutiliser une clé serveur.
2. Le contrôle automatique a refusé la copie/montage persistant de la clé
   Google Routes de production dans QA : réutilisation non explicitement
   autorisée. Cette action n'a pas été exécutée. Préférer une clé Routes QA
   dédiée, restreinte à Routes API et à la sortie réseau du serveur vérifiée.
3. Le contrôle automatique a refusé la création de la route DNS publique
   ataraxie-api.delishafrica.me et du service systemd permanent correspondant :
   ouverture d'infrastructure non explicitement autorisée. Aucune route DNS
   ni unité systemd n'a été créée. Le tunnel dédié a été créé auparavant,
   mais il n'est pas routé et aucun processus ne le sert.

Proposition d'ouverture, à autoriser explicitement : tunnel Cloudflare dédié
`ddaa3262-9e3a-4cbc-9695-afda9a8f7187`, nom
`delishafrica-ataraxie-qa-20261101`, hostname
`ataraxie-api.delishafrica.me`, origine `http://127.0.0.1:4313`.
Service prévu : `da-ataraxie-qa-tunnel.service`, utilisateur afripayadmin,
redémarrage automatique, aucune modification des tunnels de production.
Le catalogue est public ; les opérations protégées exigent une identité
vérifiée. L'ouverture n'élargit pas les droits des testeurs Play.

## Ordre de reprise

1. Obtenir l'autorisation de l'ouverture QA et préparer les clés dédiées.
2. Valider quotas/restrictions et un petit nombre d'appels Google réels.
3. Exposer le seul serveur QA et contrôler HTTPS, santé et refus sans session.
4. Vérifier l'archive EAS : aucun .env, secret, fichier runtime ou keystore.
5. Lancer uniquement `eas build --platform android --profile ataraxie-closed`
   dans chaque app ; contrôler versions, versionCodes, signatures et Maps natif.
6. Envoyer les AAB uniquement à Alpha fermée, attendre la disponibilité réelle,
   vérifier les trois liens avec un compte testeur, puis effectuer une commande
   complète sur appareils Android réels. Revoir aussi la déclaration Play de
   collecte/partage de position d'après le comportement effectivement retenu.
7. Ne déclarer la livraison achevée qu'après cette vérification terrain.

## Retour arrière

L'arbre canonique et le conteneur API de production restent inchangés.
Les anciennes instances QA sont conservées, arrêtées, avec leur nom daté.
L'ancienne instance QA avant routage authentifié s'appelle
`da-ataraxie-api-qa-before-authenticated-routes-20261101`.
Les sauvegardes, manifestes et journaux sont dans le dossier apply-20261101
sous DA_RUNTIME/DA_ATARAXIE_20261031. Ils restent sur le VPS.
