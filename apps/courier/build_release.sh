#!/usr/bin/env bash

# ====================== DelishAfrica Build & Release Script ======================
# Ce script automatise la préparation et le build des applications Expo (Coursier & Client),
# ainsi que la soumission sur TestFlight/Play Store si demandé.
# Utilisation: ./build_release.sh [--clean] [--submit] [--verbose]
# Options:
#   --clean    : Nettoie l'environnement (arrêt PM2, suppression dist/ .expo/ artefacts existants)
#   --submit   : Soumet les builds iOS/Android aux stores (TestFlight, Google Play) après build
#   --verbose  : Mode verbeux (affiche chaque commande exécutée pour debug)
# ================================================================================

# Préparation des variables d'options
SUBMIT=false
CLEAN=false
VERBOSE=false
for arg in "$@"; do
  case "$arg" in
    --submit)  SUBMIT=true ;;
    --clean)   CLEAN=true ;;
    --verbose|-v) VERBOSE=true ;;
  esac
done

# Activer l'affichage détaillé si demandé
if $VERBOSE; then
  set -x  # mode debug, affiche chaque commande
fi

# Initialiser le fichier de log
LOG_FILE="build_$(date +%Y%m%d_%H%M%S).log"
# Rediriger stdout et stderr vers le log tout en conservant l'affichage à l'écran
exec > >(tee -a "$LOG_FILE") 2>&1

echo "=== 🚀 Démarrage du script de build DelishAfrica ==="
echo "Heure: $(date '+%Y-%m-%d %H:%M:%S')"
echo

# 1. Option --clean : nettoyage de l'environnement avant build
if $CLEAN; then
  echo "🧹 Option --clean détectée : nettoyage de l'environnement..."
  # Arrêter tous les processus PM2 en cours (API, etc.)
  if command -v pm2 >/dev/null 2>&1; then
    pm2 stop all || echo "PM2 : aucun process en cours (ou échec d'arrêt)."
  fi
  # Supprimer les dossiers de build des apps mobiles (s'ils existent)
  rm -rf apps/coursier/dist apps/client/dist
  rm -rf apps/coursier/.expo apps/client/.expo
  rm -rf apps/coursier/.next apps/client/.next 2>/dev/null  # si Next.js caches (peu probable pour apps RN)
  # Supprimer d'éventuels artefacts .apk/.aab/.ipa traînant à la racine ou dans apps
  find . -maxdepth 2 -type f \( -name "*.apk" -o -name "*.aab" -o -name "*.ipa" \) -exec rm -f {} \;
  echo "✔️  Nettoyage terminé."
  echo
fi

# 2. Connexion (ou inscription) au compte Expo
echo "🔑 Vérification de la session Expo..."
EXPO_LOGIN_FAILED=false
# Vérifier si on est déjà connecté à Expo
expo whoami | grep -q "Not logged in"
if [ $? -eq 0 ]; then
  echo "👤 Aucun utilisateur Expo connecté. Tentative de connexion..."
  # Si des identifiants Expo sont fournis en variables d'environnement, on peut tenter de les utiliser
  if [[ -n "$EXPO_USERNAME" && -n "$EXPO_PASSWORD" ]]; then
    expo login -u "$EXPO_USERNAME" -p "$EXPO_PASSWORD" --non-interactive || EXPO_LOGIN_FAILED=true
  else
    # Pas d'identifiants fournis, on lance la connexion interactive
    expo login || EXPO_LOGIN_FAILED=true
  fi

  if $EXPO_LOGIN_FAILED; then
    echo "❌ Échec de la connexion avec le compte Expo existant."
    echo "💡 Tentative de création d'un nouveau compte Expo..."
    # Tenter de créer un compte via la CLI Expo (interactive)
    # La CLI Expo peut demander une adresse email, un nom d'utilisateur et un mot de passe.
    # On ne peut pas tout automatiser facilement sans 'expect', on invite donc l'utilisateur à suivre les invites.
    if command -v expect >/dev/null 2>&1; then
      # Automatisation via expect si disponible (à adapter si nécessaire)
      expect <<EOF
      log_user 1
      spawn expo register
      expect "Email:" { send "mon.email+bot$(date +%s)@exemple.com\r" }
      expect "Username:" { send "delishuser$(date +%s)\r" }
      expect "Password:" { send "Delish@123\r" }
      expect eof
EOF
    else
      echo "Veuillez suivre les instructions ci-dessus pour créer un compte Expo."
      expo register
    fi
    # Après inscription, on retente un login (il se peut que register log automatiquement)
    expo whoami | grep -q "Not logged in" && expo login
  fi
else
  echo "👤 Utilisateur Expo déjà connecté ($(expo whoami | awk -F': ' '/Username/ {print $2}'))."
fi

# Récupérer le token Expo (session) si besoin (pour usage ultérieur dans CI par ex.)
EXPO_TOKEN_FILE="/tmp/expo_token.txt"
expo whoami && expo token:access > "$EXPO_TOKEN_FILE" 2>/dev/null
# Note: expo token:access génère un token d'accès de courte durée. Alternativement, on pourrait extraire 'sessionSecret'.

echo

# 3. Connexion (ou avis) Apple Developer
echo "🔑 Vérification de la session Apple Developer..."
APPLE_SESSION_ACTIVE=false
# On tente une commande qui nécessite la connexion Apple pour voir si la session est valide.
# Par exemple, lister les certificates ou profiles via eas (non critique).
if eas credentials > /dev/null 2>&1; then
  APPLE_SESSION_ACTIVE=true
fi

if ! $APPLE_SESSION_ACTIVE; then
  echo "🔒 Aucune session Apple active. Avant de builder pour iOS, une connexion Apple Developer est requise."
  echo "Veuillez vous assurer d'être connecté via EAS CLI ou d'avoir configuré vos identifiants Apple."
  echo "- Si vous utilisez un identifiant Apple avec 2FA, générez un **mot de passe d'application** dédié pour Expo (nécessaire pour la soumission App Store Connect)."
  echo "- Si vous avez oublié votre mot de passe Apple (par ex. généré aléatoirement et stocké dans iCloud), vous pouvez le régénérer depuis un appareil iOS (voir la doc Apple 🔗 **HT204397**)."
  echo "💡 Conseil : Vous pouvez préconfigurer ces infos via les variables EXPO_APPLE_ID, EXPO_APPLE_TEAM_ID, EXPO_APPLE_APP_SPECIFIC_PASSWORD pour éviter les invites interactives."
  echo
  # Optionnel: on pourrait lancer eas build:configure ou eas device:create pour déclencher une connexion interactive ici.
fi

# 4. Validation des profils de build dans eas.json
echo "📝 Vérification de la configuration des profils de build (eas.json)..."
# Déterminer le(s) fichier(s) eas.json à vérifier (monorepo : soit global, soit un par app)
EAS_FILES=()
if [ -f "eas.json" ]; then
  # Un fichier eas.json global existe
  EAS_FILES+=("eas.json")
fi
if [ -f "apps/coursier/eas.json" ]; then
  EAS_FILES+=("apps/coursier/eas.json")
fi
if [ -f "apps/client/eas.json" ]; then
  EAS_FILES+=("apps/client/eas.json")
fi
# S'il n'y a pas de eas.json du tout, on en crée un global par défaut
if [ ${#EAS_FILES[@]} -eq 0 ]; then
  EAS_FILES=("eas.json")
  cat > "eas.json" <<'JSON'
{
  "cli": {
    "version": ">= 3.0.0"
  },
  "build": {
    "production": {
      "distribution": "store",
      "android": {
        "buildType": "app-bundle"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    }
  }
}
JSON
  echo "✅ Fichier eas.json créé avec des profils 'production' et 'preview' par défaut."
fi

# Parcourir chaque fichier de config EAS pour s'assurer des profils
for EAS_CFG in "${EAS_FILES[@]}"; do
  NEED_SAVE=false
  # Créer une copie de sauvegarde
  cp "$EAS_CFG" "${EAS_CFG}.bak"
  # Vérifier présence des mots "production" et "preview" dans le fichier
  if ! grep -q '"production"' "$EAS_CFG"; then
    NEED_SAVE=true
    echo "⚠️  Profil 'production' manquant dans $EAS_CFG – il va être ajouté."
    # Ajouter la section production (simple insertion avant la fermeture de l'object build)
    sed -i '/"build": {/a\    "production": {\n      "distribution": "store",\n      "android": {\n        "buildType": "app-bundle"\n      }\n    },' "$EAS_CFG"
  fi
  if ! grep -q '"preview"' "$EAS_CFG"; then
    NEED_SAVE=true
    echo "⚠️  Profil 'preview' manquant dans $EAS_CFG – il va être ajouté."
    sed -i '/"build": {/a\    "preview": {\n      "distribution": "internal",\n      "android": {\n        "buildType": "apk"\n      }\n    },' "$EAS_CFG"
  fi
  if $NEED_SAVE; then
    echo "ℹ️  $EAS_CFG a été mis à jour avec les profils de build par défaut (voir ${EAS_CFG}.bak pour la version précédente)."
  else
    echo "✔️  $EAS_CFG contient déjà les profils requis ('production' et 'preview')."
  fi
done
echo

# 5. Exécution du seed Prisma de démonstration
echo "🌱 Génération des données de démonstration (seed Prisma)..."
SEED_DIR=""
if [ -f "apps/coursier/prisma/seed_demo.ts" ]; then
  SEED_DIR="apps/coursier"
elif [ -f "services/api/prisma/seed_demo.ts" ]; then
  SEED_DIR="services/api"
fi

if [ -n "$SEED_DIR" ]; then
  echo "→ Exécution du seed Prisma dans '$SEED_DIR'..."
  if (cd "$SEED_DIR" && pnpm exec ts-node prisma/seed_demo.ts); then
    echo "✅ Données de démo insérées avec succès."
  else
    echo "⚠️  Le seed a rencontré une erreur dans '$SEED_DIR'. (Vérifiez les messages ci-dessus)"
    # Si l'erreur est MODULE_NOT_FOUND ou chemin incorrect, on conseille l'utilisateur
    echo " Astuce : assurez-vous que les dépendances sont installées et que le chemin du script est correct."
  fi
else
  echo "ℹ️  Aucun script 'seed_demo.ts' trouvé, étape ignorée."
fi
echo

# 6. Build des applications Expo (Coursier & Client) pour Android et iOS
echo "📦 Début des builds Expo pour les apps mobiles..."
ARTIFACTS=()  # liste pour stocker les chemins des artefacts générés
# Construire un tableau des applis à builder
APPS=("coursier" "client")
for APP in "${APPS[@]}"; do
  # Android build
  echo "🔨 Build Android pour l'app '$APP'..."
  if pnpm --filter="apps/$APP" run build:android; then
    echo "✅ Build Android ($APP) terminé."
    # Tenter de télécharger l'artefact Android
    ARTIFACT_PATH="build-${APP}-latest.aab"
    # S'il s'agit du profil preview (distribution internal), l'artefact pourrait être un APK:
    if grep -q '"preview"' <<< "$(grep -A1 "\"$APP\"" eas.json 2>/dev/null)"; then
      ARTIFACT_PATH="build-${APP}-latest.apk"
    fi
    eas build:download --platform android --latest -o "$ARTIFACT_PATH" 2>/dev/null
    if [ -f "$ARTIFACT_PATH" ]; then
      ARTIFACTS+=("$ARTIFACT_PATH")
      echo "📥 Artefact Android récupéré : $ARTIFACT_PATH"
    else
      echo "ℹ️  Artefact Android non téléchargé automatiquement. Consultez les logs EAS pour le lien de téléchargement."
    fi
  else
    echo "❌ Échec du build Android pour '$APP'. Arrêt du script."
    exit 1
  fi

  # iOS build
  echo "🔨 Build iOS pour l'app '$APP'..."
  if pnpm --filter="apps/$APP" run build:ios; then
    echo "✅ Build iOS ($APP) terminé."
    # Télécharger l'artefact iOS
    ARTIFACT_PATH="build-${APP}-latest.ipa"
    eas build:download --platform ios --latest -o "$ARTIFACT_PATH" 2>/dev/null
    if [ -f "$ARTIFACT_PATH" ]; then
      ARTIFACTS+=("$ARTIFACT_PATH")
      echo "📥 Artefact iOS récupéré : $ARTIFACT_PATH"
    else
      echo "ℹ️  Artefact iOS non téléchargé automatiquement. Consultez les logs EAS pour le lien de téléchargement."
    fi
  else
    echo "❌ Échec du build iOS pour '$APP'. Arrêt du script."
    exit 1
  fi

  echo "----"
done

echo "✔️  Tous les builds sont terminés."
echo

# 7. Soumission aux stores (si --submit)
if $SUBMIT; then
  echo "📤 Option --submit activée : soumission des apps aux stores..."
  for APP in "${APPS[@]}"; do
    # Soumission iOS (TestFlight)
    echo "🚀 Soumission iOS de l'app '$APP' vers TestFlight..."
    if eas submit --platform ios --latest --non-interactive; then
      echo "✅ Soumission iOS ($APP) réussie (consultez App Store Connect pour vérifier la disponibilité sur TestFlight)."
    else
      echo "⚠️  La soumission iOS pour '$APP' a échoué. Vérifiez les identifiants Apple et les paramètres de projet."
    fi
    # Soumission Android (Play Store)
    echo "🚀 Soumission Android de l'app '$APP' vers Google Play..."
    if eas submit --platform android --latest --non-interactive; then
      echo "✅ Soumission Android ($APP) réussie (consultez la console Google Play pour vérifier la publication)."
    else
      echo "⚠️  La soumission Android pour '$APP' a échoué. Vérifiez la configuration de la CLI Google Play (service account JSON, etc.)."
    fi
    echo "----"
  done
  echo "✔️  Tâches de soumission terminées."
else
  echo "ℹ️  Option --submit non fournie : aucune soumission automatique effectuée."
fi

echo

# 8. Récapitulatif final
echo "=== 🏁 Récapitulatif de l'exécution ==="
# Lister les artefacts générés et téléchargés
if [ ${#ARTIFACTS[@]} -gt 0 ]; then
  echo "Artefacts générés :"
  for FILE in "${ARTIFACTS[@]}"; do
    if [[ "$FILE" == *.apk ]]; then
      echo " - APK Android : $FILE"
    elif [[ "$FILE" == *.aab ]]; then
      echo " - AAB Android : $FILE"
    elif [[ "$FILE" == *.ipa ]]; then
      echo " - IPA iOS : $FILE"
    else
      echo " - Fichier : $FILE"
    fi
  done
else
  echo "Aucun artefact n'a été téléchargé automatiquement. (Consultez les logs de build pour les URLs de téléchargement sur Expo.)"
fi

# Statut soumission
if $SUBMIT; then
  echo "Soumissions effectuées : Oui (voir détails ci-dessus pour le statut de chaque plateforme)."
else
  echo "Soumissions effectuées : Non (vous pouvez exécuter manuellement 'eas submit' ou relancer le script avec --submit)."
fi

echo
echo "📄 Logs complets de ce run : $LOG_FILE"
echo "✨ Fin du script. Merci d'avoir utilisé l'automatisation DelishAfrica !"
