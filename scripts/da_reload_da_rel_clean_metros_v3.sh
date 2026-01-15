#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
SESSION="DA_REL"

log(){ printf "\n\033[1;32m[DA]\033[0m %s\n" "$*"; }
warn(){ printf "\n\033[1;33m[DA]\033[0m %s\n" "$*"; }

cd "$ROOT"

log "0) Vérif session tmux: $SESSION"
tmux has-session -t "$SESSION" 2>/dev/null || { echo "❌ Session $SESSION introuvable"; exit 1; }

log "1) Stop expo/metro (global) + libère ports 8081/8082/8083"
pkill -f "expo start" || true
pkill -f "expo-dev-server" || true
pkill -f "metro" || true

for p in 8081 8082 8083; do
  lsof -tiTCP:${p} -sTCP:LISTEN | xargs -r kill -9 || true
done

rm -rf /tmp/metro-* /tmp/haste-map-* || true

log "2) Normalise les noms des fenêtres (indices 0..9)"
tmux rename-window -t "${SESSION}:0" "0-KEEP"   2>/dev/null || true
tmux rename-window -t "${SESSION}:1" "SHELL"    2>/dev/null || true
tmux rename-window -t "${SESSION}:2" "API"      2>/dev/null || true
tmux rename-window -t "${SESSION}:3" "HEALTH"   2>/dev/null || true
tmux rename-window -t "${SESSION}:4" "PORTS"    2>/dev/null || true
tmux rename-window -t "${SESSION}:5" "CLIENT"   2>/dev/null || true
tmux rename-window -t "${SESSION}:6" "MERCHANT" 2>/dev/null || true
tmux rename-window -t "${SESSION}:7" "COURIER"  2>/dev/null || true
tmux rename-window -t "${SESSION}:8" "PLATFORM" 2>/dev/null || true
tmux rename-window -t "${SESSION}:9" "SHELL2"   2>/dev/null || true

tmux set-option -t "$SESSION" -g remain-on-exit on
tmux set-option -t "$SESSION" -g detach-on-destroy off

log "3) Clear panes + relance les 3 Metros (DEV-CLIENT + TUNNEL + CLEAR)"
# On envoie un CTRL+C (au cas où) puis on relance avec une commande propre (sans pnpm dev qui double-args)
tmux send-keys -t "${SESSION}:5" C-c
tmux send-keys -t "${SESSION}:6" C-c
tmux send-keys -t "${SESSION}:7" C-c

tmux send-keys -t "${SESSION}:5" "cd ${ROOT}/apps/client && pnpm exec expo start --dev-client --tunnel --clear --port 8081" C-m
tmux send-keys -t "${SESSION}:6" "cd ${ROOT}/apps/merchant && pnpm exec expo start --dev-client --tunnel --clear --port 8083" C-m
tmux send-keys -t "${SESSION}:7" "cd ${ROOT}/apps/courier && pnpm exec expo start --dev-client --tunnel --clear --port 8082" C-m

log "✅ OK — DA_REL rechargé"
echo
warn "📱 Si le QR ne scan pas: copie la ligne 'exp+delishafrica-xxx://expo-development-client/?url=...' et ouvre-la sur iPhone (Safari/Notes)."
