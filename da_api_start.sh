#!/usr/bin/env bash
# da_api_start.sh – démarrage API DelishAfrica (port 4001) via pnpm --filter=services/api dev

set -euo pipefail

BASE_DIR="/opt/delishafrica/monorepo"
LOG_DIR="/opt/delishafrica/logs"
API_PORT=4001

mkdir -p "$LOG_DIR"

echo "== da_api_start.sh – démarrage API DelishAfrica =="

# 0) Si le port 4001 est déjà ouvert, on ne fait rien
if (echo > /dev/tcp/127.0.0.1/${API_PORT}) &>/dev/null; then
  echo "API déjà UP sur ${API_PORT}, rien à faire."
  exit 0
fi

# 1) Vérifier le monorepo
if [ ! -d "$BASE_DIR" ]; then
  echo "ERREUR : monorepo introuvable à $BASE_DIR"
  exit 1
fi

cd "$BASE_DIR"

if [ ! -f "pnpm-workspace.yaml" ]; then
  echo "ERREUR : pnpm-workspace.yaml introuvable dans $BASE_DIR."
  echo "Vérifie que tu es bien à la racine du monorepo."
  exit 1
fi

# 2) Vérifier pnpm
if ! command -v pnpm >/dev/null 2>&1; then
  echo "ERREUR : pnpm n'est pas disponible dans le PATH."
  echo "Installe pnpm puis relance ce script."
  exit 1
fi

# 3) Installer les deps globales du monorepo si besoin
if [ ! -d "node_modules" ]; then
  echo "node_modules absent à la racine → pnpm install (monorepo)…"
  pnpm install
else
  echo "node_modules déjà présent → pas de pnpm install global."
fi

# 4) Vérifier que le package services/api existe bien dans le workspace
if ! grep -q "services/api" pnpm-workspace.yaml 2>/dev/null; then
  echo "ATTENTION : aucun package 'services/api' référencé dans pnpm-workspace.yaml."
  echo "Si l'API est ailleurs, on adaptera la commande manuellement."
fi

# 5) Lancer l’API via le script workspace
echo "Lancement de l'API avec : pnpm --filter=services/api dev"
echo "(les logs seront dans $LOG_DIR/api_manual.log)"

# On laisse pnpm/PM2 gérer l'API en arrière-plan
nohup pnpm --filter=services/api dev > "$LOG_DIR/api_manual.log" 2>&1 &

# 6) Attendre et vérifier que le port répond
sleep 8

if (echo > /dev/tcp/127.0.0.1/${API_PORT}) &>/dev/null; then
  echo "✅ API démarrée, port ${API_PORT} OK."
  echo "Healthcheck possible : curl -s http://127.0.0.1:${API_PORT}/api/health"
  echo "Logs API : $LOG_DIR/api_manual.log"
  exit 0
else
  echo "❌ API ne répond toujours pas sur ${API_PORT}."
  echo "Consulte les logs : $LOG_DIR/api_manual.log"
  exit 1
fi
