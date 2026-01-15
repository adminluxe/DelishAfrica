#!/usr/bin/env bash
# =====================================================================
# DelishAfrica – da_reset_and_mux.sh (V4 robuste, sans send-keys)
# Objet :
#   - Kill proprement l’ancienne session tmux "delish"
#   - Créer une nouvelle session avec 5 fenêtres :
#       0: shell
#       1: api-logs   (pm2 logs delish-api)
#       2: client     (pnpm start)
#       3: courier    (pnpm start)
#       4: merchant   (pnpm start)
#
#   - Chaque fenêtre lance un bash qui :
#       * exécute la commande
#       * puis fait "exec bash" pour rester ouvert même si ça plante
# =====================================================================

set -euo pipefail

SESSION_NAME="delish"
MONOREPO="/opt/delishafrica/monorepo"

CLIENT_DIR="${MONOREPO}/apps/client"
COURIER_DIR="${MONOREPO}/apps/courier"
MERCHANT_DIR="${MONOREPO}/apps/merchant"

log()  { echo -e "[DA-MUX] $*"; }
warn() { echo -e "[DA-MUX] ⚠️  $*"; }
err()  { echo -e "[DA-MUX] ❌ $*"; }

# --- Vérif de base ----------------------------------------------------
if [[ ! -d "${MONOREPO}" ]]; then
  err "Monorepo introuvable : ${MONOREPO}"
  exit 1
fi

cd "${MONOREPO}"

# --- Kill ancienne session tmux ---------------------------------------
if tmux has-session -t "${SESSION_NAME}" 2>/dev/null; then
  log "Ancienne session tmux '${SESSION_NAME}' détectée – suppression..."
  tmux kill-session -t "${SESSION_NAME}" || true
fi

# --- Nouvelle session : fenêtre 0 = shell général ---------------------
log "Création de la nouvelle session tmux '${SESSION_NAME}'..."

# Fenêtre 0 : shell de travail
tmux new-session -d -s "${SESSION_NAME}" -n "shell" -c "${MONOREPO}"

# --- Fenêtre 1 : api-logs (pm2 logs) ---------------------------------
tmux new-window -t "${SESSION_NAME}":1 -n "api-logs" -c "${MONOREPO}" \
  "bash -lc 'pm2 logs delish-api || echo \"[api-logs] pm2 logs delish-api a échoué (pm2 non installé ? Aucun process ?).\"; exec bash'"

# --- Fenêtre 2 : client -----------------------------------------------
if [[ -d "${CLIENT_DIR}" ]]; then
  tmux new-window -t "${SESSION_NAME}":2 -n "client" -c "${CLIENT_DIR}" \
    "bash -lc 'pnpm start || echo \"[client] pnpm start a échoué (voir les messages ci-dessus)\"; exec bash'"
else
  warn "Dossier client introuvable : ${CLIENT_DIR} – fenêtre 2 créée dans ${MONOREPO}"
  tmux new-window -t "${SESSION_NAME}":2 -n "client" -c "${MONOREPO}" \
    "bash -lc 'echo \"[client] Dossier apps/client introuvable\"; exec bash'"
fi

# --- Fenêtre 3 : courier ----------------------------------------------
if [[ -d "${COURIER_DIR}" ]]; then
  tmux new-window -t "${SESSION_NAME}":3 -n "courier" -c "${COURIER_DIR}" \
    "bash -lc 'pnpm start || echo \"[courier] pnpm start a échoué (voir les messages ci-dessus)\"; exec bash'"
else
  warn "Dossier courier introuvable : ${COURIER_DIR} – fenêtre 3 créée dans ${MONOREPO}"
  tmux new-window -t "${SESSION_NAME}":3 -n "courier" -c "${MONOREPO}" \
    "bash -lc 'echo \"[courier] Dossier apps/courier introuvable\"; exec bash'"
fi

# --- Fenêtre 4 : merchant ---------------------------------------------
if [[ -d "${MERCHANT_DIR}" ]]; then
  tmux new-window -t "${SESSION_NAME}":4 -n "merchant" -c "${MERCHANT_DIR}" \
    "bash -lc 'pnpm start || echo \"[merchant] pnpm start a échoué (voir les messages ci-dessus)\"; exec bash'"
else
  warn "Dossier merchant introuvable : ${MERCHANT_DIR} – fenêtre 4 créée dans ${MONOREPO}"
  tmux new-window -t "${SESSION_NAME}":4 -n "merchant" -c "${MONOREPO}" \
    "bash -lc 'echo \"[merchant] Dossier apps/merchant introuvable\"; exec bash'"
fi

# --- Focus sur fenêtre 0 et attach ------------------------------------
tmux select-window -t "${SESSION_NAME}":0
log "Session tmux '${SESSION_NAME}' prête. Fenêtres : 0:shell 1:api-logs 2:client 3:courier 4:merchant."
tmux attach-session -t "${SESSION_NAME}"
