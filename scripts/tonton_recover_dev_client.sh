#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
SESSION="DA_REL"
API_URL_DEFAULT="https://api.delishafrica.me"
APPS=(client courier merchant)

log(){ printf "\n[%s] %s\n" "$(date +%H:%M:%S)" "$*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }

[ -d "$ROOT/apps" ] || die "Monorepo introuvable: $ROOT (attendu: $ROOT/apps/...)"
for a in "${APPS[@]}"; do
  [ -d "$ROOT/apps/$a" ] || die "App manquante: $ROOT/apps/$a"
done

log "0) Outils: node/corepack/pnpm/watchman"
command -v node >/dev/null 2>&1 || die "node manquant"
if command -v corepack >/dev/null 2>&1; then corepack enable || true; fi

if ! command -v watchman >/dev/null 2>&1; then
  log "watchman absent -> apt-get install"
  apt-get update -y
  apt-get install -y watchman || true
fi

log "1) pnpm@9.12.1"
if command -v corepack >/dev/null 2>&1; then
  corepack prepare pnpm@9.12.1 --activate || true
fi
if ! command -v pnpm >/dev/null 2>&1; then
  npm i -g pnpm@9.12.1
fi
pnpm -v >/dev/null

log "2) Workspace pnpm (si absent)"
if [ ! -f "$ROOT/pnpm-workspace.yaml" ]; then
  cat > "$ROOT/pnpm-workspace.yaml" <<'YAML'
packages:
  - "apps/*"
  - "packages/*"
YAML
  log "Créé: $ROOT/pnpm-workspace.yaml"
fi

log "3) Kill Expo/Metro + libere ports"
pkill -f "expo start" 2>/dev/null || true
pkill -f "expo-dev-server" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true
pkill -f "react-native" 2>/dev/null || true

kill_port(){
  local p="$1"
  local ids=""
  ids="$(lsof -tiTCP:"$p" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$ids" ]; then
    log "kill port $p -> $ids"
    kill -9 $ids 2>/dev/null || true
  fi
}
for p in 8081 8082 8083 8084 19000 19001 19002 19006; do kill_port "$p"; done

log "4) Nettoyage caches Metro/Expo"
rm -rf /tmp/metro-* /tmp/haste-map-* 2>/dev/null || true
rm -rf "$ROOT/.expo" "$ROOT/.expo-shared" 2>/dev/null || true
rm -rf "$ROOT/node_modules/.cache" 2>/dev/null || true
for a in "${APPS[@]}"; do
  rm -rf "$ROOT/apps/$a/.expo" "$ROOT/apps/$a/.expo-shared" 2>/dev/null || true
done

log "5) Install deps (root)"
cd "$ROOT"
pnpm install

log "6) Sanity Expo (DANS CHAQUE APP, pas au root)"
for a in "${APPS[@]}"; do
  log "Sanity: $a -> expo present?"
  ( cd "$ROOT/apps/$a" && node -e "console.log('expo', require('expo/package.json').version)" )
done

log "7) tmux session $SESSION (10 fenetres)"
tmux kill-session -t "$SESSION" 2>/dev/null || true
tmux new-session -d -s "$SESSION" -n "0:shell" "bash -l"
tmux new-window  -t "$SESSION:1" -n "1:cmd" "bash -l"

run_keep(){
  local target="$1"
  local name="$2"
  local cmd="$3"
  tmux new-window -t "$target" -n "$name" "bash -lc '$cmd; echo; echo \"[done]\"; exec bash -l'"
}

run_keep "$SESSION:2" "2:api" "cd $ROOT && echo \"(API) Lance ton script API ici si besoin\""
run_keep "$SESSION:3" "3:health" "while true; do date; curl -fsS $API_URL_DEFAULT/api/health && echo \" OK\" || echo \" NOK\"; sleep 3; done"
run_keep "$SESSION:4" "4:ports" "while true; do date; ss -lntp | egrep \"(:8081|:8082|:8083|:1900)\" || true; echo; sleep 2; done"

# IMPORTANT: on lance EXPO DIRECTEMENT (pas pnpm dev), pour forcer --dev-client
# EXPO_USE_METRO_WORKSPACE_ROOT=1 aide en monorepo
run_keep "$SESSION:5" "5:client"  "cd $ROOT/apps/client   && export EXPO_PUBLIC_API_URL=\${EXPO_PUBLIC_API_URL:-$API_URL_DEFAULT}; export EXPO_USE_METRO_WORKSPACE_ROOT=1; npx expo start --dev-client --tunnel --port 8081 --clear"
run_keep "$SESSION:6" "6:merchant" "cd $ROOT/apps/merchant && export EXPO_PUBLIC_API_URL=\${EXPO_PUBLIC_API_URL:-$API_URL_DEFAULT}; export EXPO_USE_METRO_WORKSPACE_ROOT=1; npx expo start --dev-client --tunnel --port 8083 --clear"
run_keep "$SESSION:7" "7:courier"  "cd $ROOT/apps/courier  && export EXPO_PUBLIC_API_URL=\${EXPO_PUBLIC_API_URL:-$API_URL_DEFAULT}; export EXPO_USE_METRO_WORKSPACE_ROOT=1; npx expo start --dev-client --tunnel --port 8082 --clear"

run_keep "$SESSION:8" "8:platform" "cd $ROOT && if [ -d $ROOT/apps/platform ]; then cd $ROOT/apps/platform && (pnpm dev || true); else echo \"(platform) absent\"; fi"
tmux new-window -t "$SESSION:9" -n "9:shell2" "bash -l"

tmux set-option -t "$SESSION" -g remain-on-exit on
tmux set-option -t "$SESSION" -g mouse on

log "OK -> tmux attach:"
echo "tmux attach -t $SESSION"
