#!/usr/bin/env bash

# 1. Arrêt sur erreur (optionnel, à activer si on veut stopper net en cas de problème critique):
set -e

# 2. Vérification des outils de base
required_tools=(tmux pnpm docker)
for tool in "${required_tools[@]}"; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Erreur: l’outil '$tool' est requis mais n’est pas installé. Aborting."
    exit 1
  fi
done
# Vérifier Expo CLI (non bloquant, on préviendra juste si absent)
if ! command -v expo >/dev/null 2>&1; then
  echo "⚠️  Expo CLI non trouvé dans PATH. Le script continuera, mais assurez-vous de pouvoir lancer Expo via npx ou d'installer expo-cli:contentReference[oaicite:14]{index=14}."
fi

# 3. Nettoyage des caches de développement (Metro, Watchman, etc)
echo "🔄 Nettoyage des caches Expo/Metro/Watchman…"
# Réinitialiser les watchers Watchman si disponible (évite les erreurs liées à Watchman)
if command -v watchman >/dev/null 2>&1; then
  watchman watch-del-all 2>/dev/null || echo "(Watchman non actif ou déjà nettoyé)"
fi
# Supprimer les caches Metro (fichiers temporaires commençant par metro- ou haste-map-)
rm -rf /tmp/metro-* /tmp/haste-map-* 2>/dev/null || true

# (Optionnel) Nettoyage des builds web précédents 
rm -rf apps/marchand/.next apps/dashboard/.next 2>/dev/null || true

# 4. Libération des ports potentiellement occupés
echo "🔎 Libération des ports 3010, 4001, 3000, 3001, 19000-19002 si occupés…"
ports=(3010 4001 3000 3001 19000 19001 19002)
for port in "${ports[@]}"; do
  pid_list=$(lsof -t -i:"$port")
  if [[ -n "$pid_list" ]]; then
    echo "→ Port $port occupé par PID(s) $pid_list, terminaison…"
    kill -9 $pid_list 2>/dev/null || true
  fi
done
# Double-vérification (affiche les ports toujours à l'écoute, pour info)
echo "Ports encore à l'écoute :"
ss -ltnp | grep -E ':3010|:4001|:3000|:3001|:19000|:19001|:19002' || echo "Aucun des ports critiques n'est occupé 🎉"

# 5. (Re)Démarrage des services de base via Docker (Postgres, Redis, etc.)
echo "🐳 Démarrage des conteneurs de base (DB, Redis)…"
docker compose up -d  # assume docker-compose.yml is present at repository root
if [[ $? -ne 0 ]]; then
  echo "❌ Échec du démarrage Docker. Vérifiez Docker (ou docker-compose) et réessayez."; exit 1
fi

# 6. Initialisation de la session tmux et des fenêtres
SESSION="delish"
echo "🖥️  Création de la session tmux '$SESSION' avec les fenêtres 0-9…"
tmux new-session -d -s "$SESSION" -n Shell0  # fenêtre 0
tmux new-window -t "$SESSION":1 -n Cmd      # fenêtre 1: shell vide pour commandes manuelles
tmux new-window -t "$SESSION":2 -n API      # fenêtre 2: API NestJS
tmux new-window -t "$SESSION":3 -n Health   # fenêtre 3: health-check en continu
tmux new-window -t "$SESSION":4 -n Ports    # fenêtre 4: monitoring des ports
tmux new-window -t "$SESSION":5 -n Client   # fenêtre 5: app Client (Expo)
tmux new-window -t "$SESSION":6 -n Marchand # fenêtre 6: app Marchand (web)
tmux new-window -t "$SESSION":7 -n Coursier # fenêtre 7: app Coursier (Expo)
tmux new-window -t "$SESSION":8 -n Dashboard # fenêtre 8: app Dashboard (admin)
tmux new-window -t "$SESSION":9 -n Shell9   # fenêtre 9: shell supplémentaire

# Empêcher la fermeture automatique des fenêtres si un process se termine (CTRL+C ou exit):contentReference[oaicite:15]{index=15}
tmux set-option -t "$SESSION" remain-on-exit on

# 7. Envoi des commandes de démarrage dans chaque fenêtre correspondante
# Chemin de base du monorepo (adapter si nécessaire)
MONOREPO_DIR="$HOME/delishafrica-monorepo"
# - Fenêtre 2: Lancer l'API NestJS (services/api, port 3010)
tmux send-keys -t "$SESSION":2 "cd $MONOREPO_DIR && pnpm --filter=services/api dev" C-m

# - Fenêtre 3: Lancer une boucle de health-check (ping API toutes les 5s)
tmux send-keys -t "$SESSION":3 "while sleep 5; do curl -sf http://localhost:3010/api/health && echo ' ✅ API OK'; done" C-m

# - Fenêtre 4: Lancer une surveillance des ports actifs (rafraîchissement toutes les 5s)
tmux send-keys -t "$SESSION":4 "watch -n 5 'ss -ltnp | grep -E \"3010|3000|3001|1900\"'" C-m

# - Fenêtre 5: Lancer l'app mobile Client (Expo):contentReference[oaicite:16]{index=16}
tmux send-keys -t "$SESSION":5 "cd $MONOREPO_DIR && pnpm --filter=apps/client dev" C-m

# - Fenêtre 6: Lancer l'app web Marchand (Next.js/Vite):contentReference[oaicite:17]{index=17}
tmux send-keys -t "$SESSION":6 "cd $MONOREPO_DIR && pnpm --filter=apps/marchand dev" C-m

# - Fenêtre 7: Lancer l'app mobile Coursier (Expo):contentReference[oaicite:18]{index=18}:contentReference[oaicite:19]{index=19}
tmux send-keys -t "$SESSION":7 "cd $MONOREPO_DIR && pnpm --filter=apps/coursier dev" C-m

# - Fenêtre 8: Lancer l'app Dashboard Admin (plateforme ops):contentReference[oaicite:20]{index=20}
tmux send-keys -t "$SESSION":8 "cd $MONOREPO_DIR && pnpm --filter=apps/dashboard dev" C-m

# (Fenêtres 1, 9 sont laissées vides pour usage manuel; fenêtre 0 peut afficher des logs global ou rester shell)

# 8. Attacher la session tmux pour prendre la main
tmux attach-session -t "$SESSION"
