#!/usr/bin/env bash
# =====================================================================
# DelishAfrica – da_mux_v3.sh
# Lance la stack tmux/Expo "delish" depuis le monorepo.
#
# Rôle :
#   - Se placer dans /opt/delishafrica/monorepo
#   - Utiliser en priorité da_reset_and_mux.sh (script officiel récent)
#   - Sinon fallback sur /usr/local/bin/da_mux (ancienne version globale)
#
# Fenêtres attendues dans tmux "delish" :
#   0: shell
#   1: api-logs
#   2: client
#   3: courier
#   4: merchant
# =====================================================================

set -euo pipefail

ROOT_DIR="/opt/delishafrica/monorepo"

log()  { echo -e "[DA-MUX-V3] $*"; }
warn() { echo -e "[DA-MUX-V3] ⚠️  $*"; }
err()  { echo -e "[DA-MUX-V3] ❌ $*"; }

# Se placer dans le monorepo
if [[ -d "${ROOT_DIR}" ]]; then
  cd "${ROOT_DIR}"
else
  err "Dossier monorepo introuvable : ${ROOT_DIR}"
  exit 1
fi

log "Racine monorepo : ${ROOT_DIR}"

# On ne tue pas la session ici : c'est géré par da_reset_and_mux.sh
# ou par tmux kill-session si on passe en fallback.

# 1) Chemin privilégié : script monorepo da_reset_and_mux.sh
if [[ -x "./da_reset_and_mux.sh" ]]; then
  log "Utilisation de ./da_reset_and_mux.sh (routine complète tmux + Expo)..."
  ./da_reset_and_mux.sh "$@"
  log "Stack tmux/Expo lancée via da_reset_and_mux.sh."
  exit 0
fi

# 2) Fallback : ancien script global /usr/local/bin/da_mux (s'il existe)
if command -v da_mux >/dev/null 2>&1; then
  warn "da_reset_and_mux.sh introuvable ou non exécutable, fallback sur da_mux global."
  log "Kill éventuelle de la session tmux 'delish'..."
  tmux kill-session -t delish >/dev/null 2>&1 || true

  log "Lancement de da_mux..."
  da_mux "$@"

  log "da_mux_v3.sh a terminé (fallback da_mux)."
  exit 0
fi

err "Aucun script tmux trouvé (ni da_reset_and_mux.sh, ni da_mux dans le PATH)."
err "Vérifie que les outils DelishAfrica sont bien installés."
exit 1
