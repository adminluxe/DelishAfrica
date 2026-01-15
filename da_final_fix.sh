#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
SESSION="DA_REL"
STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP="/tmp/da_scroll_global_bak_$STAMP"

# Vérifie dépendances (rg, perl, docker, tmux)
for bin in rg perl docker tmux; do
  command -v $bin >/dev/null || { echo "❌ $bin manquant"; exit 1; }
done

echo "== nettoyage processus Expo/Metro + ports =="
# tue tmux et processes Metro/Expo
tmux kill-server 2>/dev/null || true
pkill -f "expo.*start|expo start|metro|@expo/cli" 2>/dev/null || true
pkill -f "pnpm dev.*apps/(client|merchant|courier)" 2>/dev/null || true

# libère ports 8081/8082/8083/19000-19008
for p in 8081 8082 8083 19000 19001 19002 19003 19004 19005 19006 19007 19008 3010; do
  fuser -k -n tcp $p 2>/dev/null || true
done

echo "== redémarrage API via docker compose =="
if [ -f "$ROOT/docker-compose.yml" ]; then
  (cd "$ROOT" && docker compose up -d) || true
  sleep 3
fi

echo "== préparation correctifs scroll =="
mkdir -p "$BACKUP"
# Liste des fichiers susceptibles d’avoir des overlays
mapfile -t FILES < <(
  rg -l "StyleSheet\\.absoluteFill(Object)?|absoluteFillObject|position:\\s*['\"]absolute['\"]|\\.\\.\\.StyleSheet\\.absoluteFill" \
    "$ROOT/apps/client" "$ROOT/apps/merchant" "$ROOT/apps/courier" \
  | sort -u
)

for f in "${FILES[@]}"; do
  cp -a "$f" "$BACKUP/$(echo "$f" | sed 's#/#__#g')"
  # patch pointerEvents
  perl -0777 -i -pe '
    # Views décoratives (View, Animated.View, LinearGradient, BlurView, LottieView, Image, ImageBackground)
    for my $tag (qw(View Animated\.View LinearGradient BlurView LottieView Image ImageBackground)) {
      s/<$tag(?![^>]*\\spointerEvents=)([^>]*(StyleSheet\\.absoluteFill(?:Object)?|absoluteFillObject|\\.\\.\\.StyleSheet\\.absoluteFill)[^>]*?)>/<${tag} pointerEvents="none"$1>/g;
      s/<$tag([^>]*?)\\spointerEvents=(["'\''])(?!none)[^"'\'']+\\2([^>]*(StyleSheet\\.absoluteFill(?:Object)?|absoluteFillObject|\\.\\.\\.StyleSheet\\.absoluteFill)[^>]*?)>/<${tag}$1 pointerEvents="none"$3>/g;
    }
    # Pressable décoratif en plein écran : pointerEvents box-none
    s/<Pressable(?![^>]*\\spointerEvents=)([^>]*(StyleSheet\\.absoluteFill(?:Object)?|absoluteFillObject|\\.\\.\\.StyleSheet\\.absoluteFill)[^>]*?)>/<Pressable pointerEvents="box-none"$1>/g;
    s/<Pressable([^>]*?)\\spointerEvents=(["'\''])(?!box-none)[^"'\'']+\\2([^>]*(StyleSheet\\.absoluteFill(?:Object)?|absoluteFillObject|\\.\\.\\.StyleSheet\\.absoluteFill)[^>]*?)>/<Pressable$1 pointerEvents="box-none"$3>/g;
  ' "$f"
done

echo "✅ correctifs appliqués sur ${#FILES[@]} fichiers (backups : $BACKUP)."

echo "== relance tmux solide avec 10 fenêtres =="
# Recrée session
tmux new-session -d -s "$SESSION" -n "shell" "bash"
tmux set-option -t "$SESSION" -g remain-on-exit on
tmux set-option -t "$SESSION" -g mouse on
tmux set-option -t "$SESSION" -g history-limit 200000

# API logs
tmux new-window -t "$SESSION:2" -n "api" "bash"
tmux send-keys -t "$SESSION:2" "cd '$ROOT' && docker compose ps && echo && docker logs -f delish-api" C-m
# Health check
tmux new-window -t "$SESSION:3" -n "health" "bash"
tmux send-keys -t "$SESSION:3" "while true; do date; curl -fsS http://127.0.0.1:3010/api/v1/health && echo ' OK'; sleep 2; done" C-m
# Ports monitor
tmux new-window -t "$SESSION:4" -n "ports" "bash"
tmux send-keys -t "$SESSION:4" "watch -n1 'ss -lntp | egrep \"(:3010|:8081|:8082|:8083)\" || true'" C-m

# Relance Metro (client/merchant/courier)
tmux new-window -t "$SESSION:5" -n "client" "bash"
tmux send-keys -t "$SESSION:5" "cd '$ROOT/apps/client' && export NODE_OPTIONS=--max_old_space_size=4096 && pnpm dev -- --tunnel --clear --port 8081" C-m
tmux new-window -t "$SESSION:6" -n "merchant" "bash"
tmux send-keys -t "$SESSION:6" "cd '$ROOT/apps/merchant' && export NODE_OPTIONS=--max_old_space_size=4096 && pnpm dev -- --tunnel --clear --port 8083" C-m
tmux new-window -t "$SESSION:7" -n "courier" "bash"
tmux send-keys -t "$SESSION:7" "cd '$ROOT/apps/courier' && export NODE_OPTIONS=--max_old_space_size=4096 && pnpm dev -- --tunnel --clear --port 8082" C-m
# Autres fenêtres
tmux new-window -t "$SESSION:8" -n "platform" "bash"
tmux new-window -t "$SESSION:9" -n "shell2" "bash"

tmux select-window -t "$SESSION:1"
tmux attach -t "$SESSION"
