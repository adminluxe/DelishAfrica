#!/usr/bin/env bash
set -euo pipefail

MONO_DIR="/opt/delishafrica/monorepo"
OLD_DIR="/opt/delishafrica/compose"

log() {
  echo ">>> $*"
}

ensure_env_dir() {
  # $1 = répertoire (ex: services/api)
  local dir="$1"
  local example="$dir/.env.example"
  local target="$dir/.env"

  if [ -f "$target" ]; then
    log "[$dir] .env déjà présent (OK)."
    return 0
  fi

  if [ -f "$example" ]; then
    log "[$dir] Copie de .env.example -> .env"
    cp "$example" "$target"
  else
    log "[$dir] ATTENTION : ni .env ni .env.example trouvés."
    log "[$dir] Tu pourras créer $target à partir de la doc si besoin."
  fi
}

log "Vérification du répertoire monorepo..."
if [ ! -d "$MONO_DIR" ]; then
  echo "Le répertoire $MONO_DIR n'existe pas. Abandon."
  exit 1
fi

cd "$MONO_DIR"

log "Arrêt des processus liés à l'ancienne configuration 'compose'..."
if [ -d "$OLD_DIR" ]; then
  if command -v docker >/dev/null 2>&1; then
    ( cd "$OLD_DIR" && docker compose down || true )
  fi
else
  log "Aucun dossier 'compose' à gérer (OK)."
fi

log "Suppression de l'ancien dossier $OLD_DIR..."
if [ -d "$OLD_DIR" ]; then
  rm -rf "$OLD_DIR"
  log "Dossier 'compose' supprimé."
else
  log "Aucun dossier 'compose' à supprimer (OK)."
fi

log "Nettoyage des références à '/opt/delishafrica/compose' dans les configs..."
# On corrige les scripts locaux (idempotent)
FILES_TO_SCAN=(
  "/usr/local/bin/da_mux"
  "/usr/local/bin/da_url"
  "/usr/local/bin/da_qr"
  "$MONO_DIR/da_reset_and_mux.sh"
)
for f in "${FILES_TO_SCAN[@]}"; do
  if [ -f "$f" ]; then
    sed -i "s#/opt/delishafrica/compose#/opt/delishafrica/monorepo#g" "$f"
  fi
done
log "Chemins mis à jour vers '$MONO_DIR'."

log "Vérification/Configuration des identifiants de projet Expo (EAS) dans les apps..."
if [ -f "apps/courier/app.config.ts" ]; then
  if grep -q "projectId" apps/courier/app.config.ts; then
    log "Identifiant EAS Courier déjà configuré (OK)."
  else
    log "ATTENTION : ajoute extra.eas.projectId dans apps/courier/app.config.ts."
  fi
fi
if [ -f "apps/merchant/app.config.ts" ]; then
  if grep -q "projectId" apps/merchant/app.config.ts; then
    log "Identifiant EAS Merchant déjà configuré (OK)."
  else
    log "ATTENTION : ajoute extra.eas.projectId dans apps/merchant/app.config.ts."
  fi
fi

log "Configuration des variables d'environnement..."
ensure_env_dir "services/api"
ensure_env_dir "apps/client"
ensure_env_dir "apps/coursier"
ensure_env_dir "apps/merchant"
ensure_env_dir "apps/dashboard"

log "Reset terminé. Tu peux maintenant relancer la stack tmux/Expo avec :"
log "./da_reset_and_mux.sh"

exit 0
