#!/usr/bin/env bash
# =============================
# 🎯 Script de Finalisation DelishAfrica – Transition Thieyp -> Production
# Description : Purge les données de démo, pointe les apps vers l'API prod,
#               et effectue les build finaux pour Client, Courier, Merchant.
# Exécution   : À lancer depuis la racine du repo monorepo.
# =============================

set -e  # 1. Arrêt sur erreur pour sécurité

echo "1️⃣ Mise à jour de la configuration API (EXPO_PUBLIC_API_BASE_URL)..."
# Remplace l'URL de base API dans tous les .env des apps par l'URL de production
API_URL="https://api.delishafrica.me"
for app in client courier marchand; do
  ENV_FILE="apps/$app/.env"
  if [[ -f "$ENV_FILE" ]]; then
    sed -i.bak -E "s@EXPO_PUBLIC_API_URL=.*@EXPO_PUBLIC_API_URL=$API_URL@" "$ENV_FILE" 2>/dev/null || \
    sed -i.bak -E "s@EXPO_PUBLIC_API_BASE_URL=.*@EXPO_PUBLIC_API_BASE_URL=$API_URL@" "$ENV_FILE"
    echo "   - $ENV_FILE mis à jour."
  else
    echo "   (⚠️  $ENV_FILE introuvable, saut de l'étape pour $app)"
  fi
done

echo "2️⃣ Purge des contenus de démonstration dans le code..."
# Retire toute ligne contenant 'demo' dans les fichiers critiques (routes/app)
DEMO_GREP="demo"
# Liste des fichiers connus où "demo" doit être purgé ou renommé
FILES_TO_CLEAN=(
  "apps/client/app/orders-demo.tsx"
  "apps/client/app/thieyp-demo.tsx"
  "apps/courier/app/orders-demo.tsx"
  "apps/courier/app/thieyp-demo.tsx"
  "apps/marchand/app/orders-demo.tsx"
  "apps/marchand/app/thieyp-demo.tsx"
)
for file in "${FILES_TO_CLEAN[@]}"; do
  if [[ -f "$file" ]]; then
    # On crée un backup par sécurité
    cp "$file" "${file}.bak_final"
    # Suppression des mentions 'demo' dans le fichier (commentaires et textes UI)
    sed -i -E "s/[Dd][eé]mo//g" "$file"
    echo "   - Nettoyage de '$file' (backup -> ${file}.bak_final)"
  fi
done

# Optionnel : renommer les fichiers de routes demo en routes finales (si on décide de les garder en production)
# Par exemple, si on conserve la logique de orders-demo.tsx en la basculant sur orders.tsx
# for file in apps/*/app/orders-demo.tsx; do 
#   [ -f "$file" ] && git mv "$file" "$(echo $file | sed 's/orders-demo.tsx/orders.tsx/')"
# done

echo "3️⃣ Vérification des endpoints utilisés dans le code..."
# Cherche d'anciennes routes (merchants, demo-orders) encore présentes par inadvertance
grep -R "api/merchants" apps/ || true
grep -R "api/demo-orders" apps/ || true
echo "   (Si des occurences s'affichent ci-dessus, il faudra les traiter manuellement)"

echo "4️⃣ Nettoyage des caches Expo/Metro..."
# Supprime les caches Metro pour éviter toute persistance de données de démo
if command -v watchman >/dev/null 2>&1; then
  watchman watch-del-all || true
fi
rm -rf /tmp/metro-* /tmp/haste-map-* || true
echo "   - Caches Metro nettoyés."

echo "5️⃣ Reconstruction des bundles Expo (Client, Courier, Merchant)..."
# On utilise les commandes Expo pour générer des builds de production en local (ou préproduction)
cd apps/client && npx expo export --force && cd ../../
cd apps/courier && npx expo export --force && cd ../../
cd apps/marchand && npm run build || pnpm --filter=apps/marchand build && cd ../../
echo "   - Bundles web/mobile générés localement (vérifier le dossier dist ou web-build si applicable)."

echo "6️⃣ (Optionnel) Génération des builds iOS/Android via EAS..."
# Ces commandes nécessitent d'être connectées à EAS et d'avoir les credentials Apple/Google configurés.
# npx eas-cli build -p ios --profile production --non-interactive
# npx eas-cli build -p android --profile production --non-interactive

echo "7️⃣ Nettoyage final et vérifications..."
# Supprimer les backups de ce script pour ne pas laisser de fichiers sensibles
find apps -name "*.bak_final" -delete
echo "   - Fichiers backup .bak_final supprimés."
echo ""
echo "✅ Transition terminée. Pensez à exécuter les tests manuels de vérification (point 8 du rapport)."
echo "🚀 Vos applications sont prêtes pour le déploiement en production !"

