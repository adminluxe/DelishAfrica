#!/bin/bash
set -e  # arrêter le script en cas d'erreur

# 1. Lancer la base de données et Redis (via Docker Compose)
docker compose up -d   # Démarre les conteneurs PostgreSQL et Redis

# 2. Appliquer les migrations Prisma à la base de données de dev
pnpm -C services/api exec prisma migrate dev --name init_local --skip-seed

# 3. (Optionnel) Exécuter le seed de données de dev (ajoute un marchand de démo et des plats)
pnpm -C services/api exec prisma db seed || echo "Seed non disponible ou déjà effectué"

# 4. Démarrer l’API NestJS en arrière-plan avec PM2
pm2 delete delish-api 2>/dev/null || true   # Stoppe l'API s'il y en a une en cours
pm2 start "bash -lc 'cd services/api && set -a; . prisma/.env; set +a; PORT=4001 pnpm exec ts-node --transpile-only src/main.ts'" --name delish-api   # Démarre l'API NestJS (port 4001)
pm2 save

# (Vérification rapide de la santé de l'API)
curl -s http://127.0.0.1:3010/api/health | jq . || curl -s http://127.0.0.1:3010/api/health

# 5. (Optionnel) Réinitialiser tmux et lancer les bundlers Expo (Client, Courier, Merchant)
tmux kill-session -t delish >/dev/null 2>&1 || true 
/usr/local/bin/da_mux &   # Lance Expo (Metro bundlers) via tmux en arrière-plan

# 6. Vérifier la connexion à Expo/EAS (login si nécessaire)
npx eas-cli whoami || npx eas-cli login

# 7. Lier chaque app mobile au projet EAS (ajoute projectId si besoin)
cd /opt/delishafrica/monorepo/apps/courier && npx eas-cli build:configure
cd /opt/delishafrica/monorepo/apps/merchant && npx eas-cli build:configure

# 8. Enregistrer l'iPhone pour la distribution interne (ajout UDID)
export EXPO_APPLE_APP_SPECIFIC_PASSWORD='xxxx-xxxx-xxxx-xxxx'   # <-- Remplacez par le mot de passe d'app Apple
cd /opt/delishafrica/monorepo/apps/courier && npx eas-cli device:create
cd /opt/delishafrica/monorepo/apps/merchant && npx eas-cli device:create

# 9. Construire les Dev Clients iOS (profil development) pour Courier et Merchant
cd /opt/delishafrica/monorepo/apps/courier && npx eas-cli build -p ios --profile development
cd /opt/delishafrica/monorepo/apps/merchant && npx eas-cli build -p ios --profile development

echo "✅ Builds iOS lancées sur EAS. Attendez qu'elles soient terminées, puis installez les apps sur l'iPhone de test."

# 10. Une fois les apps installées sur l'iPhone, afficher les URLs Expo à ouvrir via Open from Clipboard :
/usr/local/bin/da_url courier --dc | tee /dev/tty   # URL Expo Dev Client pour Courier
/usr/local/bin/da_url merchant --dc | tee /dev/tty  # URL Expo Dev Client pour Merchant

echo "📋 Copiez ces URLs et utilisez *Open from Clipboard* dans les apps installées sur l’iPhone pour lancer les bundles Expo."
