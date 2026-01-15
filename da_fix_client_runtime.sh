#!/usr/bin/env bash
# =====================================================================
# DelishAfrica – da_fix_client_runtime.sh
# Objet :
#   Réparer tous les runtimes nécessaires au dev Client (Expo Router)
#   dans un monorepo pnpm :
#     - @babel/runtime
#     - expo-modules-core
#     - whatwg-fetch
#     - invariant
#     - pretty-format
# =====================================================================

set -euo pipefail

MONOREPO="/opt/delishafrica/monorepo"

log()  { echo -e "[DA-CLIENT-FIX] $*"; }
err()  { echo -e "[DA-CLIENT-FIX] ❌ $*"; }

if [[ ! -d "${MONOREPO}" ]]; then
  err "Monorepo introuvable : ${MONOREPO}"
  exit 1
fi

cd "${MONOREPO}"

log "Installation / mise à jour des dépendances runtime pour le workspace..."

# On installe tout au niveau du workspace (-w)
pnpm add -w @babel/runtime expo-modules-core whatwg-fetch invariant pretty-format

log "Dépendances runtime installées / mises à jour."
log "Tu peux maintenant :"
log "  1) Aller dans la fenêtre tmux 2:client -> Ctrl+C"
log "  2) Relancer le bundler avec : pnpm start -- --clear"
log "  3) Forcer la fermeture de l'app Client sur l'iPhone, puis la relancer."

log "Si un message 'Unable to resolve module ...' persiste, copie-le pour qu'on l'analyse."
