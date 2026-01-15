#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
SESSION="delish"

echo "==[ DelishAfrica – MUX MONOREPO ]=="

# 0) Vérifier le dossier racine
if [ ! -d "$ROOT" ]; then
  echo "[ERREUR] Dossier monorepo introuvable : $ROOT"
  exit 1
fi

cd "$ROOT"

# 1) Tuer les anciennes sessions tmux qui traînent
for s in delish delish-demo delish-tunnel; do
  tmux kill-session -t "$s" >/dev/null 2>&1 || true
done

# 2) Créer la nouvelle session 'delish' avec seulement des shells
# Fenêtre 0 : shell général
tmux new-session -d -s "$SESSION" -n shell "cd $ROOT && bash"

# Fenêtre 1 : API (shell, on lancera la commande API à la main)
tmux new-window -t "$SESSION":1 -n api "cd $ROOT && bash"

# Fenêtre 2 : Client (shell dans apps/client)
tmux new-window -t "$SESSION":2 -n client "cd $ROOT/apps/client && bash"

# Fenêtre 3 : Courier (shell dans apps/courier)
tmux new-window -t "$SESSION":3 -n courier "cd $ROOT/apps/courier && bash"

# Fenêtre 4 : Merchant (shell dans apps/merchant)
tmux new-window -t "$SESSION":4 -n merchant "cd $ROOT/apps/merchant && bash"

# Revenir sur la fenêtre 0
tmux select-window -t "$SESSION":0

# Attacher
tmux attach -t "$SESSION"
