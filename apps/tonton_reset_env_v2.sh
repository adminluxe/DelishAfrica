#!/usr/bin/env bash
# tonton_reset_env_v2.sh
# Version allégée : nettoie l'environnement et crée une session tmux prête sans lancer automatiquement npm/expo.
# À utiliser quand les scripts d'installation échouent (ex. erreurs "workspace:") et qu'on veut garder les fenêtres ouvertes.

SESSION_NAME="DA_REL"
ROOT="/opt/delishafrica/monorepo"

# 1. Fermer l'ancienne session tmux si présente
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  tmux kill-session -t "$SESSION_NAME"
fi

# 2. Nettoyer caches et ports
watchman watch-del-all 2>/dev/null || true
rm -rf /tmp/metro-* /tmp/haste-map-* /tmp/react-native-* 2>/dev/null || true
PORTS=(8081 19000 19001 19002 3000 3001 3002)
for PORT in "${PORTS[@]}"; do
  PID=$(lsof -ti tcp:$PORT || true)
  if [[ -n "$PID" ]]; then
    kill -9 $PID || true
  fi
done

# 3. Supprimer les node_modules des apps (facultatif) et réinstaller
for APP in client merchant courier; do
  APP_DIR="$ROOT/apps/$APP"
  if [[ -d "$APP_DIR" ]]; then
    rm -rf "$APP_DIR/node_modules"
    (cd "$APP_DIR" && npm install --legacy-peer-deps || true)
  fi
done

# Racine
cd "$ROOT"
rm -rf node_modules
npm install --legacy-peer-deps || true

# 4. Créer la session tmux et les fenêtres
# Première fenêtre : shell général
 tmux new-session -d -s "$SESSION_NAME" -n '0:cmd' -c "$ROOT" 

# Fenêtre 1 : vide (shell supplémentaire)
tmux new-window -t "$SESSION_NAME:1" -n '1:shell' -c "$ROOT"

# Fenêtre 2 : API (shell dans apps/api)
if [[ -d "$ROOT/apps/api" ]]; then
  tmux new-window -t "$SESSION_NAME:2" -n '2:api' -c "$ROOT/apps/api" 
fi

# Fenêtre 3 : Health (shell dans apps/health)
if [[ -d "$ROOT/apps/health" ]]; then
  tmux new-window -t "$SESSION_NAME:3" -n '3:health' -c "$ROOT/apps/health" 
fi

# Fenêtre 4 : Ports (affiche les ports en écoute à intervalles réguliers)
tmux new-window -t "$SESSION_NAME:4" -n '4:ports' -c "$ROOT" 
tmux send-keys -t "$SESSION_NAME:4" "while true; do ss -tulpn | grep LISTEN; sleep 5; clear; done" C-m

# Fenêtre 5 : Client (shell dans apps/client)
if [[ -d "$ROOT/apps/client" ]]; then
  tmux new-window -t "$SESSION_NAME:5" -n '5:client' -c "$ROOT/apps/client" 
fi

# Fenêtre 6 : Merchant (shell dans apps/merchant)
if [[ -d "$ROOT/apps/merchant" ]]; then
  tmux new-window -t "$SESSION_NAME:6" -n '6:merchant' -c "$ROOT/apps/merchant" 
fi

# Fenêtre 7 : Courier (shell dans apps/courier)
if [[ -d "$ROOT/apps/courier" ]]; then
  tmux new-window -t "$SESSION_NAME:7" -n '7:courier' -c "$ROOT/apps/courier" 
fi

# Fenêtre 8 : Platform (shell dans apps/platform)
if [[ -d "$ROOT/apps/platform" ]]; then
  tmux new-window -t "$SESSION_NAME:8" -n '8:platform' -c "$ROOT/apps/platform" 
fi

# Fenêtre 9 : Shell supplémentaire
 tmux new-window -t "$SESSION_NAME:9" -n '9:shell' -c "$ROOT" 

# Attacher à la session
tmux attach -t "$SESSION_NAME"
