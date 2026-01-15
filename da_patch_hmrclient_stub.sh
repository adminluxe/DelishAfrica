#!/usr/bin/env bash
# =====================================================================
# DelishAfrica – da_patch_hmrclient_stub.sh
#
# But :
#   Neutraliser HMRClient de React Native (hot reload) pour éviter
#   les erreurs de dépendances (invariant, etc.) dans l'environnement
#   Expo + pnpm, sans impacter le fonctionnement de l'app.
#
#   - On trouve HMRClient.js dans node_modules
#   - On fait un backup
#   - On remplace par un stub minimal (no-op)
# =====================================================================

set -euo pipefail

ROOT="/opt/delishafrica/monorepo"

log() { echo "[DA-HMR-PATCH] $*"; }
err() { echo "[DA-HMR-PATCH] ❌ $*" >&2; }

if [[ ! -d "${ROOT}" ]]; then
  err "Monorepo introuvable : ${ROOT}"
  exit 1
fi

cd "${ROOT}"

log "Recherche de HMRClient.js dans node_modules..."
HMR_FILE="$(find node_modules -path '*react-native*Libraries/Utilities/HMRClient.js' | head -n 1 || true)"

if [[ -z "${HMR_FILE}" ]]; then
  err "Fichier HMRClient.js introuvable dans node_modules."
  exit 1
fi

log "Fichier trouvé : ${HMR_FILE}"

# Backup
BACKUP="${HMR_FILE}.bak_$(date +%Y%m%d-%H%M%S)"
cp "${HMR_FILE}" "${BACKUP}"
log "Backup créé : ${BACKUP}"

log "Injection d'un stub minimal dans HMRClient.js..."

cat > "${HMR_FILE}" << 'EOF'
/**
 * DelishAfrica – Patch HMRClient.js
 *
 * Ce stub désactive simplement le Hot Module Reload (HMR) côté JS
 * pour éviter les erreurs de dépendances (invariant, etc.)
 * dans l'environnement Expo + pnpm.
 *
 * Le fonctionnement normal de l'app (rendu, navigation, API...) n'est pas impacté.
 */

function noop() {}

const HMRClient = {
  enable() {
    // no-op
  },
  disable() {
    // no-op
  },
  registerBundle() {
    // no-op
  },
  registerConfig() {
    // no-op
  },
  on() {
    // no-op
  },
};

module.exports = HMRClient;
EOF

log "Patch appliqué avec succès."
log "Tu peux maintenant redémarrer le bundler Client."
