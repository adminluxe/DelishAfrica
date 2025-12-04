#!/usr/bin/env bash

# Ce script automatise la reconstruction complète des applications Expo Router
# DelishAfrica‑Courier et DelishAfrica‑Merchant. Il nettoie l'environnement,
# réinstalle les dépendances avec Yarn, vérifie les configurations EAS,
# applique un correctif pour le paramètre de fallback Expo (updates.fallbackToCacheTimeout)
# afin d'embarquer un bundle JavaScript en cas d'absence de serveur Metro,
# puis lance des builds Android et iOS via EAS. Les builds iOS utilisent le
# profil « development » pour rester en dessous des limites de temps des serveurs
# EAS, tandis que les builds Android utilisent le profil « preview » pour
# générer des APK autonomes.

set -euo pipefail

# === Variables globales ===
# Répertoire racine contenant les projets Expo Router
ROOT_DIR="/opt/delishafrica/compose/apps"
# Liste des applications à traiter
APPS=("courier" "merchant")
# Point de terminaison de l'API à utiliser dans les builds
API_BASE_URL="http://194.164.72.250:4001"
# Identifiants EAS (à adapter en cas de modification dans le repo)
declare -A EAS_PROJECT_IDS=(
  [courier]="b6ed6df5-cd75-48ff-99f9-fc5adcaec479"
  [merchant]="ac87e7fa-1e43-4baa-813e-6174797314a1"
)

# Vérifie que les commandes essentielles sont disponibles
required_tools=(node yarn eas expo jq sed curl)
for tool in "${required_tools[@]}"; do
  if ! command -v "$tool" &>/dev/null; then
    echo "❌ Outil requis absent : $tool. Veuillez l’installer avant d’exécuter ce script."
    exit 1
  fi
done

# Force Node.js en version 20 (ou supérieur) afin d’éviter des incompatibilités
REQUIRED_NODE_MAJOR=20
CURRENT_NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if (( CURRENT_NODE_MAJOR < REQUIRED_NODE_MAJOR )); then
  echo "❌ Node.js >= $REQUIRED_NODE_MAJOR est requis. Version actuelle : $CURRENT_NODE_MAJOR"
  exit 1
fi

# Fonction utilitaire pour appliquer un correctif de configuration sur app.config.ts
patch_config() {
  local app_name=$1
  local config_file="$ROOT_DIR/$app_name/app.config.ts"
  local project_id="${EAS_PROJECT_IDS[$app_name]}"

  if [[ ! -f "$config_file" ]]; then
    echo "⚠️  Fichier de configuration introuvable : $config_file"
    return
  fi

  # Ajoute updates.fallbackToCacheTimeout à 0 si absent, afin d’utiliser le bundle intégré
  if ! grep -q "fallbackToCacheTimeout" "$config_file"; then
    # Insère la propriété dans la section updates, ou crée la section si absente
    if grep -q "updates:" "$config_file"; then
      sed -i "/updates:/a\ \ \ \ fallbackToCacheTimeout: 0," "$config_file"
    else
      sed -i "/export default/ a\\n\nexport const updates = { fallbackToCacheTimeout: 0 }" "$config_file"
    fi
    echo "✅ Ajout de fallbackToCacheTimeout: 0 dans $config_file"
  fi

  # Vérifie la présence du projectId EAS dans la partie extra.eas
  if ! grep -q "$project_id" "$config_file"; then
    # Insère ou met à jour la clé projectId dans extra.eas
    if grep -q "extra: {" "$config_file"; then
      # remplace ou ajoute le projectId dans le bloc extra.eas
      if grep -q "projectId" "$config_file"; then
        sed -i "s/projectId: \".*\"/projectId: \"$project_id\"/" "$config_file"
      else
        sed -i "/extra: {/,/}/ s/eas: {/&\n      projectId: \"$project_id\",/" "$config_file"
      fi
    fi
    echo "✅ projectId mis à jour dans $config_file"
  fi
}

# Fonction de reconstruction pour une application donnée
rebuild_app() {
  local app_name=$1
  local app_dir="$ROOT_DIR/$app_name"
  local project_id="${EAS_PROJECT_IDS[$app_name]}"

  echo "\n🔧 Reconstruction de l’application $app_name"
  cd "$app_dir"

  # Nettoyage des dépendances et installation avec Yarn pour optimiser le bundling EAS
  echo "→ Nettoyage des installations Node"
  rm -rf node_modules && rm -f yarn.lock package-lock.json pnpm-lock.yaml
  yarn install --silent

  # Vérifie ou crée un fichier .env.production pour forcer l’API
  if [[ ! -f ".env.production" ]]; then
    echo "EXPO_PUBLIC_API_URL=$API_BASE_URL" > .env.production
    echo "✅ Fichier .env.production créé avec EXPO_PUBLIC_API_URL=$API_BASE_URL"
  else
    # Met à jour la variable si elle n’existe pas ou diffère
    if ! grep -q "EXPO_PUBLIC_API_URL" .env.production; then
      echo "EXPO_PUBLIC_API_URL=$API_BASE_URL" >> .env.production
    fi
  fi

  # Appliquer le correctif de config (fallback + projectId)
  patch_config "$app_name"

  # Vérification de la santé de l’API pour s'assurer qu'elle répond avant le build
  echo "→ Vérification de l’API ($API_BASE_URL/api/health)"
  if curl -sf "$API_BASE_URL/api/health" >/dev/null; then
    echo "✅ API opérationnelle"
  else
    echo "⚠️  Avertissement : Impossible de joindre l’API à $API_BASE_URL."
  fi

  # Build Android (APK autonome) en profil preview afin d’embarquer le bundle JS
  echo "→ Lancement du build Android (profil preview)"
  if ! eas build --platform android --profile preview --non-interactive; then
    echo "❌ Le build Android a échoué pour $app_name. Consultez les logs ci-dessus."
  else
    echo "✅ Build Android réussi pour $app_name"
  fi

  # Build iOS en profil development (dev client) pour respecter la limite EAS (2h)
  # Ce build nécessitera un serveur Metro en cours d’exécution pour fonctionner.
  echo "→ Lancement du build iOS (profil development)"
  if ! eas build --platform ios --profile development --non-interactive; then
    echo "⚠️  Échec du build iOS pour $app_name. Cela peut être dû à la limite EAS de 2 heures."
    echo "   Envisagez un build local via 'eas build --local' sur un Mac, ou une montée en gamme EAS."
  else
    echo "✅ Build iOS (dev client) terminé pour $app_name"
  fi

  # Exporte les liens des builds terminés
  echo "→ Extraction des liens d'installation"
  if BUILD_INFO=$(eas build:list --status=finished --platform android --limit=1 --json --non-interactive 2>/dev/null); then
    APK_URL=$(echo "$BUILD_INFO" | jq -r '.[0].artifacts.buildUrl')
    if [[ -n "$APK_URL" && "$APK_URL" != "null" ]]; then
      echo "📦 APK pour $app_name : $APK_URL"
    fi
  fi
  if BUILD_INFO=$(eas build:list --status=finished --platform ios --limit=1 --json --non-interactive 2>/dev/null); then
    IPA_URL=$(echo "$BUILD_INFO" | jq -r '.[0].artifacts.buildUrl')
    if [[ -n "$IPA_URL" && "$IPA_URL" != "null" ]]; then
      echo "🍎 IPA (dev client) pour $app_name : $IPA_URL"
      echo "   ⚠️  Ce binaire iOS est un Dev Client : il nécessitera un serveur Metro via 'expo start --dev-client' pour charger le JS."
    fi
  fi
}

# Boucle sur toutes les applications et lance la reconstruction
for app in "${APPS[@]}"; do
  rebuild_app "$app"
done

echo "\n🎉 Fin du script. Toutes les reconstructions sont terminées."
