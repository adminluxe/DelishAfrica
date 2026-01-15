#!/usr/bin/env bash
set -euo pipefail

# =========================
# DelishAfrica — MASTER "à la Tonton"
# tmux 5 windows + reset ports + fix imports + start all
#
# Windows:
# 0 Shell
# 1 API
# 2 Client
# 3 Courier
# 4 Merchant
# =========================

ROOT="/opt/delishafrica/monorepo"
SESSION="delish"

# ✅ API FIXÉE (selon ton info)
API_DIR="$ROOT/services/api"

# Apps
CLIENT_DIR="$ROOT/apps/client"
COURIER_DIR="$ROOT/apps/courier"
MERCHANT_DIR="$ROOT/apps/merchant"

# Ports à libérer (ajoute/enlève si besoin)
PORTS=(8081 8082 8083 19000 19001 19002 3010 4010)

log(){ echo -e "🧠 $*"; }
ok(){ echo -e "✅ $*"; }
warn(){ echo -e "⚠️  $*"; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "❌ Commande manquante: $1"; exit 1; }
}

free_port() {
  local p="$1"
  local pids
  pids="$(lsof -tiTCP:"$p" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${pids:-}" ]]; then
    warn "Libération port $p (PID: $pids)"
    kill -9 $pids >/dev/null 2>&1 || true
  fi
}

hard_reset() {
  log "HARD RESET: tmux + processes + ports"

  # kill tmux session
  tmux kill-session -t "$SESSION" >/dev/null 2>&1 || true

  # kill expo/metro/node liés (best-effort)
  pkill -f "pnpm exec expo start" >/dev/null 2>&1 || true
  pkill -f "expo start" >/dev/null 2>&1 || true
  pkill -f "metro" >/dev/null 2>&1 || true
  pkill -f "react-native" >/dev/null 2>&1 || true

  # libère ports
  for p in "${PORTS[@]}"; do free_port "$p"; done

  ok "Reset terminé"
}

fix_ui_imports() {
  log "Fix imports UI: delishafrica/ui -> @delishafrica/ui (apps/* .ts/.tsx/.js)"
  cd "$ROOT"

  # ✅ Remplacement robuste:
  # - gère simples/doubles quotes
  # - gère variantes de casse fréquentes
  # - touche uniquement *.ts/*.tsx/*.js dans apps/
  find apps -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) -print0 \
  | xargs -0 perl -pi -e '
      s#(["\x27])delishafrica/ui\1#$1\@delishafrica/ui$1#g;
      s#(["\x27])delishAfrica/ui\1#$1\@delishafrica/ui$1#g;
      s#(["\x27])DelishAfrica/ui\1#$1\@delishafrica/ui$1#g;
    '

  # ✅ vérif: il ne doit plus rester d'imports "delishafrica/ui" dans du code
  if grep -RIn --exclude-dir=node_modules --exclude-dir=.git '["'\'']delishafrica/ui["'\'']' apps >/dev/null 2>&1; then
    warn "Il reste des traînards CODE 'delishafrica/ui' :"
    grep -RIn --exclude-dir=node_modules --exclude-dir=.git '["'\'']delishafrica/ui["'\'']' apps | head -n 80 || true
    warn "Corrige ces dernières lignes puis relance ce script."
    exit 1
  fi

  ok "Imports UI CODE OK"
  log "Note: si grep remonte encore apps/*/package.json avec '@delishafrica/ui', c'est NORMAL (workspace dep)."
}

clean_caches() {
  log "Nettoyage caches Expo (.expo/.expo-shared/.cache)"
  rm -rf "$CLIENT_DIR/.expo" "$CLIENT_DIR/.expo-shared" "$CLIENT_DIR/.cache" "$CLIENT_DIR/node_modules/.cache" 2>/dev/null || true
  rm -rf "$COURIER_DIR/.expo" "$COURIER_DIR/.expo-shared" "$COURIER_DIR/.cache" "$COURIER_DIR/node_modules/.cache" 2>/dev/null || true
  rm -rf "$MERCHANT_DIR/.expo" "$MERCHANT_DIR/.expo-shared" "$MERCHANT_DIR/.cache" "$MERCHANT_DIR/node_modules/.cache" 2>/dev/null || true
  ok "Caches nettoyés"
}

pnpm_install() {
  log "pnpm -w install"
  cd "$ROOT"
  pnpm -w install
  ok "Deps OK"
}

tmux_start_5_windows() {
  log "Création tmux session '$SESSION' avec 5 fenêtres (0..4)"

  tmux new-session -d -s "$SESSION" -n "Shell" -c "$ROOT"

  # Window 1: API
  tmux new-window -t "$SESSION:1" -n "API" -c "$API_DIR"
  tmux send-keys -t "$SESSION:1" "cd '$API_DIR'" C-m
  tmux send-keys -t "$SESSION:1" "pnpm dev" C-m

  # Window 2: Client
  tmux new-window -t "$SESSION:2" -n "Client" -c "$CLIENT_DIR"
  tmux send-keys -t "$SESSION:2" "cd '$CLIENT_DIR' && pnpm exec expo start --dev-client -c --tunnel --port 8081" C-m

  # Window 3: Courier
  tmux new-window -t "$SESSION:3" -n "Courier" -c "$COURIER_DIR"
  tmux send-keys -t "$SESSION:3" "cd '$COURIER_DIR' && pnpm exec expo start --dev-client -c --tunnel --port 8082" C-m

  # Window 4: Merchant
  tmux new-window -t "$SESSION:4" -n "Merchant" -c "$MERCHANT_DIR"
  tmux send-keys -t "$SESSION:4" "cd '$MERCHANT_DIR' && pnpm exec expo start --dev-client -c --tunnel --port 8083" C-m

  tmux select-window -t "$SESSION:0"
  ok "tmux prêt ✅"
  log "Attache-toi avec: tmux attach -t $SESSION"
}

main() {
  need_cmd tmux
  need_cmd pnpm
  need_cmd lsof
  need_cmd perl

  [[ -d "$ROOT" ]] || { echo "❌ ROOT introuvable: $ROOT"; exit 1; }
  [[ -d "$API_DIR" ]] || { echo "❌ API_DIR introuvable: $API_DIR"; exit 1; }

  hard_reset
  fix_ui_imports
  clean_caches
  pnpm_install
  tmux_start_5_windows

  echo
  ok "Tout est relancé."
  echo "➡️ tmux attach -t $SESSION"
}

main "$@"
