#!/bin/bash
# Vérifier si la session "delish" existe déjà ; si oui, s'y attacher
if tmux has-session -t delish 2>/dev/null; then
    tmux attach -t delish
    exit 0
fi

# Créer une nouvelle session tmux détachée nommée "delish" avec une 1ère fenêtre "shell"
tmux new-session -d -s delish -n shell -c /opt/delishafrica/monorepo

# Configurations de session tmux :
tmux set-option -t delish history-limit 10000          # Scrollback étendu 10000 lignes:contentReference[oaicite:0]{index=0}
tmux set-option -t delish status-bg black              # Barre d’état fond noir:contentReference[oaicite:1]{index=1}
tmux set-option -t delish status-fg white              # Barre d’état texte blanc lisible:contentReference[oaicite:2]{index=2}
tmux set-option -t delish status-right "%H:%M"         # Affichage de l’heure en format 24h:contentReference[oaicite:3]{index=3}
tmux set-option -t delish base-index 1                 # Facultatif : indexer les fenêtres à partir de 1

# Fenêtre 1: shell (terminal par défaut) avec prompt explicite
tmux send-keys -t delish:1 'export PS1="[SHELL] \$ "' C-m

# Fenêtre 2: api-logs – tail -f des logs de l'API DelishAfrica
tmux new-window -t delish:2 -n api-logs -c /opt/delishafrica/monorepo
tmux send-keys -t delish:2 'export PS1="[API-LOGS] \$ "' C-m
tmux send-keys -t delish:2 'tail -f /opt/delishafrica/monorepo/services/api/logs/api.log' C-m

# Fenêtre 3: client – lancement de l’app Client (Expo) via pnpm dev (port 8081, tunnel, cache clear)
tmux new-window -t delish:3 -n client -c /opt/delishafrica/monorepo/apps/client
tmux send-keys -t delish:3 'export PS1="[CLIENT] \$ "; pnpm dev -- --port 8081 --tunnel --clear' C-m

# Fenêtre 4: courier – lancement de l’app Courier (Expo) via pnpm dev (port 8082, tunnel, cache clear)
tmux new-window -t delish:4 -n courier -c /opt/delishafrica/monorepo/apps/coursier
tmux send-keys -t delish:4 'export PS1="[COURIER] \$ "; pnpm dev -- --port 8082 --tunnel --clear' C-m

# Fenêtre 5: merchant – lancement de l’app Merchant (Expo) via pnpm dev (port 8083, tunnel, cache clear)
tmux new-window -t delish:5 -n merchant -c /opt/delishafrica/monorepo/apps/marchand
tmux send-keys -t delish:5 'export PS1="[MERCHANT] \$ "; pnpm dev -- --port 8083 --tunnel --clear' C-m

# Fenêtre 6: platform – shell dédié pour scripts/commandes ops
tmux new-window -t delish:6 -n platform -c /opt/delishafrica/monorepo
tmux send-keys -t delish:6 'export PS1="[PLATFORM] \$ "' C-m

# Attacher la session "delish" pour afficher les fenêtres
tmux attach -t delish
