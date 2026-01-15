#!/usr/bin/env bash
# =====================================================================
# DelishAfrica – da_api_autoboot.sh
# Script tout-en-un pour (re)lancer l'API NestJS du monorepo
# Emplacement attendu : /opt/delishafrica/monorepo/da_api_autoboot.sh
# Utilisation : sudo /opt/delishafrica/monorepo/da_api_autoboot.sh
# =====================================================================

set -euo pipefail

# --- CONFIG GLOBALE ---------------------------------------------------

MONOREPO_ROOT="/opt/delishafrica/monorepo"
API_DIR="${MONOREPO_ROOT}/services/api"

API_APP_NAME="delish-api"                   # Nom du process dans PM2
API_PORT="${API_PORT:-4001}"
API_HEALTH_PATH="${API_HEALTH_PATH:-/api/health}"

# Domaine public derrière Cloudflare (pour le check HTTPS)
API_PUBLIC_BASE_URL="${API_PUBLIC_BASE_URL:-https://api.delishafrica.me}"

# Docker compose (pour Postgres / Redis en arrière-plan)
DOCKER_COMPOSE_FILE="${MONOREPO_ROOT}/docker-compose.yml"

# --- UTILITAIRES D'AFFICHAGE -----------------------------------------

log()  { echo -e "[DA-API] $*"; }
ok()   { echo -e "[DA-API] ✅ $*"; }
warn() { echo -e "[DA-API] ⚠️  $*"; }
err()  { echo -e "[DA-API] ❌ $*"; }

# --- VÉRIFICATIONS DE BASE --------------------------------------------

if [[ ! -d "${MONOREPO_ROOT}" ]]; then
  err "Monorepo introuvable : ${MONOREPO_ROOT}"
  exit 1
fi

if [[ ! -d "${API_DIR}" ]]; then
  err "Répertoire API introuvable : ${API_DIR}"
  exit 1
fi

log "Monorepo       : ${MONOREPO_ROOT}"
log "Répertoire API : ${API_DIR}"
log "Port API       : ${API_PORT}"
log "Health path    : ${API_HEALTH_PATH}"
log "Domaine public : ${API_PUBLIC_BASE_URL}"

# --- 1) DÉMARRAGE INFRA (DB / REDIS VIA DOCKER) -----------------------

if command -v docker >/dev/null 2>&1; then
  if [[ -f "${DOCKER_COMPOSE_FILE}" ]]; then
    log "Démarrage des services Docker (db, redis...) via ${DOCKER_COMPOSE_FILE} ..."
    docker compose -f "${DOCKER_COMPOSE_FILE}" up -d || warn "docker compose up -d a retourné une erreur (à vérifier si nécessaire)."
  else
    warn "Aucun docker-compose.yml détecté à ${DOCKER_COMPOSE_FILE} – saut de l'étape DB/Redis."
  fi
else
  warn "Docker n'est pas installé/détecté – saut de l'étape DB/Redis."
fi

# --- 2) PRÉPARATION PNPM ----------------------------------------------

if ! command -v pnpm >/dev/null 2>&1; then
  warn "pnpm non détecté dans le PATH – tentative d'activation via corepack..."
  if command -v corepack >/dev/null 2>&1; then
    corepack enable pnpm || warn "Échec corepack enable pnpm – installe pnpm manuellement si l'API ne démarre pas."
  else
    warn "corepack indisponible – installe Node 18+ et pnpm globalement."
  fi
fi

# --- 3) GESTION PM2 POUR L'API ----------------------------------------

if ! command -v pm2 >/dev/null 2>&1; then
  warn "PM2 non détecté – installation globale..."
  npm install -g pm2 || {
    err "Impossible d'installer pm2 globalement – vérifie npm/node."
    exit 1
  }
  ok "PM2 installé."
fi

cd "${MONOREPO_ROOT}"

log "Arrêt de toute instance existante de l'API (${API_APP_NAME}) dans PM2 (si présente)..."
if pm2 describe "${API_APP_NAME}" >/dev/null 2>&1; then
  pm2 delete "${API_APP_NAME}" || warn "Échec pm2 delete ${API_APP_NAME} (peut être ignoré si déjà stoppé)."
fi

log "Démarrage de l'API via PM2 (pnpm -C services/api run start:prod)..."
pm2 start pnpm --name "${API_APP_NAME}" -- -C services/api run start:prod

# Sauvegarde de la config PM2 pour redémarrage auto au reboot (si pm2 startup configuré)
pm2 save || warn "pm2 save a échoué – pense à configurer pm2 startup plus tard."

ok "Processus PM2 ${API_APP_NAME} lancé."

# --- 4) HEALTHCHECK HTTP LOCAL ----------------------------------------

log "Attente du démarrage de l'API sur http://127.0.0.1:${API_PORT}${API_HEALTH_PATH} ..."

API_HEALTH_URL_LOCAL="http://127.0.0.1:${API_PORT}${API_HEALTH_PATH}"
API_READY=0

for i in $(seq 1 30); do
  if curl -fsS "${API_HEALTH_URL_LOCAL}" >/dev/null 2>&1; then
    API_READY=1
    break
  fi
  sleep 1
done

if [[ "${API_READY}" -ne 1 ]]; then
  err "L'API ne répond pas sur ${API_HEALTH_URL_LOCAL} après 30 secondes."
  log "Derniers logs PM2 :"
  pm2 logs "${API_APP_NAME}" --lines 50 || true
  exit 1
fi

ok "Healthcheck local OK : ${API_HEALTH_URL_LOCAL}"

# --- 5) HEALTHCHECK HTTPS PUBLIC (OPTIONNEL MAIS RECOMMANDÉ) ----------

if [[ -n "${API_PUBLIC_BASE_URL}" ]]; then
  API_HEALTH_URL_PUBLIC="${API_PUBLIC_BASE_URL}${API_HEALTH_PATH}"
  log "Test HTTPS public via ${API_HEALTH_URL_PUBLIC} ..."
  if curl -fsS -o /dev/null "${API_HEALTH_URL_PUBLIC}"; then
    ok "Healthcheck HTTPS public OK : ${API_HEALTH_URL_PUBLIC}"
  else
    warn "Le healthcheck HTTPS public a échoué – vérifie Cloudflare/tunnel plus tard."
  fi
else
  warn "API_PUBLIC_BASE_URL vide – saut du test HTTPS public."
fi

ok "da_api_autoboot.sh terminé avec succès. API opérationnelle 🎯"
exit 0
