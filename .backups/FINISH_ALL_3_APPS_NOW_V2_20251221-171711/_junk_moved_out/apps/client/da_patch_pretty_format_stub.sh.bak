#!/usr/bin/env bash
# =====================================================================
# DelishAfrica – da_patch_pretty_format_stub.sh
#
# But :
#   Remplacer pretty-format (lib de formatage pour les logs) par
#   un stub minimal sans dépendances (ansi-styles, react-is, etc.)
#   afin de stopper les erreurs "Unable to resolve module ..." en dev.
#
#   - On trouve index.js de pretty-format dans node_modules
#   - On fait un backup
#   - On injecte un module minimal compatible.
# =====================================================================

set -euo pipefail

ROOT="/opt/delishafrica/monorepo"

log() { echo "[DA-PF-PATCH] $*"; }
err() { echo "[DA-PF-PATCH] ❌ $*" >&2; }

if [[ ! -d "${ROOT}" ]]; then
  err "Monorepo introuvable : ${ROOT}"
  exit 1
fi

cd "${ROOT}"

log "Recherche de pretty-format/build/index.js dans node_modules..."
PF_FILE="$(find node_modules -path '*pretty-format*/build/index.js' | head -n 1 || true)"

if [[ -z "${PF_FILE}" ]]; then
  err "Fichier pretty-format/build/index.js introuvable."
  exit 1
fi

log "Fichier trouvé : ${PF_FILE}"

# Backup
BACKUP="${PF_FILE}.bak_$(date +%Y%m%d-%H%M%S)"
cp "${PF_FILE}" "${BACKUP}"
log "Backup créé : ${BACKUP}"

log "Injection d'un stub minimal dans pretty-format/build/index.js..."

cat > "${PF_FILE}" << 'EOF'
/**
 * DelishAfrica – Patch pretty-format
 *
 * Stub minimal pour éviter les erreurs de dépendances (ansi-styles,
 * react-is, etc.) dans l'environnement Expo + pnpm.
 *
 * Ce module ne fait qu'un formatage simple, suffisant pour les logs
 * de développement. Il n'impacte pas le fonctionnement de l'app.
 */

function simpleFormat(value) {
  try {
    if (typeof value === 'string') {
      return value;
    }
    return JSON.stringify(value, null, 2);
  } catch (e) {
    try {
      return String(value);
    } catch {
      return '[Unformattable value]';
    }
  }
}

function format(value, options) {
  // options ignorées dans ce stub
  return simpleFormat(value);
}

// Export "classic" (require('pretty-format'))
module.exports = format;

// Export par défaut (import default from 'pretty-format')
module.exports.default = format;

// Quelques props que Jest / RN pourraient toucher
module.exports.plugins = {};
module.exports.format = format;
EOF

log "Patch pretty-format appliqué avec succès."
log "Redémarre maintenant le bundler Client."
