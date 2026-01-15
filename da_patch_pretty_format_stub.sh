#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/opt/delishafrica/monorepo"
cd "$ROOT_DIR"

log() { echo "[DA-PF-PATCH] $*"; }

log "Recherche de pretty-format/build/index.js dans node_modules ..."

PF_FILES=$(find node_modules -path "*pretty-format*/build/index.js" | sort || true)

if [ -z "${PF_FILES}" ]; then
  log "Aucun fichier pretty-format/build/index.js trouvé."
  exit 1
fi

for PF in $PF_FILES; do
  BACKUP="${PF}.bak_$(date +%Y%m%d-%H%M%S)"
  log "Patch de ${PF} (backup -> ${BACKUP})"
  cp "$PF" "$BACKUP"

  cat > "$PF" <<'EOF'
/**
 * DelishAfrica – Patch pretty-format
 *
 * Stub minimal pour éviter les erreurs de dépendances (ansi-styles,
 * react-is, etc.) dans l'environnement Expo + pnpm.
 *
 * Ce module ne fait qu'un formatage très simple, suffisant pour les logs
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
    } catch (e2) {
      return '[unformattable value]';
    }
  }
}

module.exports = {
  format: simpleFormat,
  plugins: [],
};
EOF
done

log "Patch pretty-format appliqué sur toutes les versions détectées."
