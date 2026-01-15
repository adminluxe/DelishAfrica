#!/usr/bin/env bash
set -euo pipefail

SESSION="DA_DEV"
ROOT="/opt/delishafrica/monorepo"

# Ports qu'on veut garder clean (selon tes usages Expo + API)
PORTS_TO_FREE=(8081 8082 8083 19000 19001 19002 19006 3010 4001)

log() { echo -e "\n[DA_DEV] $*\n"; }

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "[DA_DEV] Missing: $1"; exit 1; }
}

need tmux
need ss

cd "$ROOT"

log "1) Kill soft des zombies courants (expo/metro/ngrok/node sur ports)"
pkill -f "expo start" 2>/dev/null || true
pkill -f "react-native" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true
pkill -f "ngrok" 2>/dev/null || true

log "2) Libération ports (inclut 4001 => on le tue, mais on ne le relance JAMAIS)"
for p in "${PORTS_TO_FREE[@]}"; do
  fuser -k "${p}/tcp" 2>/dev/null || true
done

log "3) Docker : on ne relance PAS une API Docker. On ne veut que db/redis si dispo."
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  # On tente de démarrer db/redis uniquement si ces services existent.
  # Si le compose n'a pas ces noms, on ne casse rien.
  if docker compose config --services >/dev/null 2>&1; then
    SVCS="$(docker compose config --services | tr '\n' ' ')"
    if echo "$SVCS" | grep -qE '(^| )db( |$)' && echo "$SVCS" | grep -qE '(^| )redis( |$)'; then
      log "Docker compose: up -d db redis"
      docker compose up -d db redis
    else
      log "Docker compose présent mais services (db/redis) non détectés => on n'y touche pas."
    fi
  fi
else
  log "Docker/Compose non dispo => ok, on continue."
fi

# Detect platform dir (delishafrica-ops)
detect_platform_dir() {
  local base="/opt/delishafrica"
  local cand=""
  for cand in \
    "$base/delishafrica-ops" \
    "$base/ops" \
    "$base/platform" \
    "$base/delishafrica_ops" \
    "$ROOT/delishafrica-ops" \
    "$ROOT/apps/delishafrica-ops"
  do
    if [ -f "$cand/package.json" ]; then
      echo "$cand"
      return 0
    fi
  done

  # fallback search (light)
  local found
  found="$(find "$base" -maxdepth 4 -type f -name package.json 2>/dev/null | head -n 1 || true)"
  if [ -n "$found" ]; then
    echo "$(dirname "$found")"
    return 0
  fi

  echo ""
  return 0
}

PLATFORM_DIR="$(detect_platform_dir)"

log "4) (Re)Créer tmux session + 10 fenêtres fixes"
tmux kill-session -t "$SESSION" 2>/dev/null || true

# Session + window 0 (shell)
tmux new-session -d -s "$SESSION" -n "shell" "cd '$ROOT'; bash"

# Hardening tmux
tmux set -t "$SESSION" -g mouse on
tmux set -t "$SESSION" -g remain-on-exit on
tmux set -t "$SESSION" -g allow-rename off
tmux set -t "$SESSION" -g automatic-rename off
tmux set -t "$SESSION" -g history-limit 200000

# Helper: create window with self-respawn loop (Ctrl+C => redémarre)
new_respawn_win () {
  local idx="$1"; local name="$2"; local cmd="$3"
  tmux new-window -t "$SESSION:$idx" -n "$name" "bash -lc 'trap \"\" INT; while true; do echo \"[$name] starting...\"; $cmd; code=\$?; echo \"[$name] exited code=\$code - respawn in 2s\"; sleep 2; done'"
}

# (1) shell vide (cmd)
tmux new-window -t "$SESSION:1" -n "shell" "cd '$ROOT'; bash"

# (2) API (Nest local, port 3010)
# On force l'environnement / port si besoin (au cas où le projet lit PORT)
new_respawn_win 2 "api" "cd '$ROOT' && (command -v pnpm >/dev/null 2>&1 && pnpm --filter './services/api-nest' dev || npm --prefix '$ROOT/services/api-nest' run dev)"

# (3) health (vérifie 3010 OK + confirme 4001 DOWN)
tmux new-window -t "$SESSION:3" -n "health" "bash -lc 'cd \"$ROOT\"; while true; do echo \"--- \$(date)\"; curl -fsS http://127.0.0.1:3010/api/health && echo \"  (3010 OK)\" || echo \"  (3010 FAIL)\"; curl -fsS http://127.0.0.1:4001/ >/dev/null 2>&1 && echo \"  (4001 UP !!! A TUER)\" || echo \"  (4001 DOWN OK)\"; sleep 2; done'"

# (4) ports
tmux new-window -t "$SESSION:4" -n "ports" "bash -lc 'while true; do echo \"--- \$(date)\"; ss -ltnp | egrep \"(:3010|:4001|:8081|:8082|:8083|:19000|:19001|:19002)\" || true; sleep 2; done'"

# (5) client Expo
new_respawn_win 5 "client" "cd '$ROOT/apps/client' && (command -v pnpm >/dev/null 2>&1 && pnpm exec expo start --dev-client --tunnel --port 8081 || npx expo start --dev-client --tunnel --port 8081)"

# (6) merchant Expo
new_respawn_win 6 "merchant" "cd '$ROOT/apps/merchant' && (command -v pnpm >/dev/null 2>&1 && pnpm exec expo start --dev-client --tunnel --port 8082 || npx expo start --dev-client --tunnel --port 8082)"

# (7) courier Expo
new_respawn_win 7 "courier" "cd '$ROOT/apps/courier' && (command -v pnpm >/dev/null 2>&1 && pnpm exec expo start --dev-client --tunnel --port 8083 || npx expo start --dev-client --tunnel --port 8083)"

# (8) platform (delishafrica-ops)
if [ -n "$PLATFORM_DIR" ] && [ -f "$PLATFORM_DIR/package.json" ]; then
  new_respawn_win 8 "platform" "cd '$PLATFORM_DIR' && (command -v pnpm >/dev/null 2>&1 && pnpm dev || npm run dev)"
else
  tmux new-window -t "$SESSION:8" -n "platform" "bash -lc 'echo \"PLATFORM NOT FOUND. Cherche delishafrica-ops dans /opt/delishafrica\"; echo; ls -la /opt/delishafrica | head -n 120; bash'"
fi

# (9) nouveau shell
tmux new-window -t "$SESSION:9" -n "shell" "cd '$ROOT'; bash"

# Revenir sur 0
tmux select-window -t "$SESSION:0"

log "DONE. Attach: tmux attach -t $SESSION"
echo "Tip: si ton SSH crashe, reconnecte puis: tmux attach -t $SESSION"
