#!/usr/bin/env bash
# =====================================================================
# DelishAfrica – da_full_stack_boot.sh
# Boot complet API + tmux/Expo (monorepo)
# Emplacement : /opt/delishafrica/monorepo/da_full_stack_boot.sh
# Usage : sudo /opt/delishafrica/monorepo/da_full_stack_boot.sh
# =====================================================================

set -euo pipefail

MONOREPO_ROOT="/opt/delishafrica/monorepo"
API_BOOT_SCRIPT="${MONOREPO_ROOT}/da_api_autoboot.sh"
MUX_SCRIPT="${MONOREPO_ROOT}/da_mux_v3.sh"

log()  { echo -e "[DA-FULL] $*"; }
ok()   { echo -e "[DA-FULL] ✅ $*"; }
warn() { echo -e "[DA-FULL] ⚠️  $*"; }
err()  { echo -e "[DA-FULL] ❌ $*"; }

if [[ ! -d "${MONOREPO_ROOT}" ]]; then
  err "Monorepo introuvable : ${MONOREPO_ROOT}"
  exit 1
fi

cd "${MONOREPO_ROOT}"

# 1) API (NestJS + Docker + PM2) via da_api_autoboot.sh
if [[ ! -x "${API_BOOT_SCRIPT}" ]]; then
  err "Script API introuvable ou non exécutable : ${API_BOOT_SCRIPT}"
  exit 1
fi

log "Démarrage / vérification de l'API via ${API_BOOT_SCRIPT} ..."
"${API_BOOT_SCRIPT}"

ok "API opérationnelle (health OK)."

# 2) tmux + Expo (da_mux_v3.sh)
if [[ -x "${MUX_SCRIPT}" ]]; then
  log "Lancement de la stack tmux/Expo via ${MUX_SCRIPT} ..."
  "${MUX_SCRIPT}"
  ok "Session tmux 'delish' démarrée (shell, api-logs, client, courier, merchant)."
else
  warn "Script tmux ${MUX_SCRIPT} non trouvé ou non exécutable."
  warn "Tu pourras le lancer manuellement plus tard si besoin."
fi

ok "Boot complet terminé. Tu peux te connecter aux apps sur l'iPhone."
