#!/usr/bin/env bash
set -euo pipefail

SESSION="DA_DEV"
ROOT="/opt/delishafrica/monorepo"

API_DIR="$ROOT/services/api-nest"
CLIENT_DIR="$ROOT/apps/client"
MERCHANT_DIR="$ROOT/apps/merchant"
COURIER_DIR="$ROOT/apps/courier"

PORTS_TO_FREE=(3010 4001 8081 8082 8083 8084 8085 8086 19000 19001 19002 19006)

echo "==[1/8] Sanity: repo root = $ROOT =="
cd "$ROOT"

echo "==[2/8] Hard stop des process résiduels (expo/metro/node) =="
pkill -f "expo start" 2>/dev/null || true
pkill -f "react-native" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true
pkill -f "node .*808[0-9]" 2>/dev/null || true
pkill -f "node .*1900" 2>/dev/null || true

echo "==[3/8] Libération ports (dont 4001 -> OFF) =="
for p in "${PORTS_TO_FREE[@]}"; do
  fuser -k "${p}"/tcp 2>/dev/null || true
done

echo "==[4/8] Docker Compose V2 (évite les KeyError: ContainerConfig) =="
if docker compose version >/dev/null 2>&1; then
  echo "docker compose OK"
else
  echo "ERREUR: docker compose (v2) absent. Installe docker compose plugin puis relance."
  exit 1
fi

echo "==[5/8] Remise à zéro stack DB/Redis (safe) =="
# IMPORTANT: ne pas toucher à LuxeEvents. On ne relance que ce compose (monorepo)
docker compose down --remove-orphans 2>/dev/null || true
docker compose up -d --force-recreate

echo "==[6/8] Déps JS + fix babel-preset-expo (root workspace) =="
# Fix du crash Expo "Cannot find module 'babel-preset-expo'"
pnpm -v >/dev/null 2>&1 || (echo "ERREUR: pnpm absent"; exit 1)

pnpm -w add -D babel-preset-expo @babel/core >/dev/null 2>&1 || true
pnpm -w install

echo "==[7/8] Clean caches Expo/Metro (root + apps) =="
rm -rf "$ROOT/.expo" "$ROOT/.metro-cache" "$ROOT/node_modules/.cache" 2>/dev/null || true
for d in "$CLIENT_DIR" "$MERCHANT_DIR" "$COURIER_DIR"; do
  rm -rf "$d/.expo" "$d/.metro-cache" "$d/node_modules/.cache" 2>/dev/null || true
done

echo "==[8/8] TMUX 10 fenêtres (layout définitif) =="
tmux kill-session -t "$SESSION" 2>/dev/null || true

tmux new-session  -d -s "$SESSION" -n "shell"
tmux rename-window -t "$SESSION:0" "shell"     # 0
tmux new-window    -t "$SESSION:1" -n "shell"  # 1
tmux new-window    -t "$SESSION:2" -n "api"    # 2
tmux new-window    -t "$SESSION:3" -n "health" # 3
tmux new-window    -t "$SESSION:4" -n "ports"  # 4
tmux new-window    -t "$SESSION:5" -n "client" # 5
tmux new-window    -t "$SESSION:6" -n "merchant" # 6
tmux new-window    -t "$SESSION:7" -n "courier"  # 7
tmux new-window    -t "$SESSION:8" -n "platform" # 8
tmux new-window    -t "$SESSION:9" -n "shell"    # 9

# --- Fenêtre 2: API (3010) --- (anti Ctrl+C)
tmux send-keys -t "$SESSION:2" "cd '$API_DIR' && bash -lc 'trap \"\" INT; echo \"[API] starting on 3010\"; (pnpm run dev || pnpm run start:dev || pnpm run start)'" C-m

# --- Fenêtre 3: HEALTH (3010 seulement) ---
tmux send-keys -t "$SESSION:3" "bash -lc 'while true; do date; curl -fsS http://127.0.0.1:3010/api/v1/health && echo \"  ✅ 3010\" || echo \"  ❌ 3010\"; echo; sleep 2; done'" C-m

# --- Fenêtre 4: PORTS (monitor + commandes safe) ---
tmux send-keys -t "$SESSION:4" "bash -lc 'while true; do echo \"LISTEN:\"; ss -ltnp | egrep \":(3010|4001|8081|8082|8083)\\b\" || true; echo; sleep 2; done'" C-m

# --- Fenêtres 5/6/7: Expo tunnel dev-client (anti Ctrl+C) ---
tmux send-keys -t "$SESSION:5" "cd '$CLIENT_DIR' && bash -lc 'trap \"\" INT; pnpm exec expo start --dev-client -c --tunnel'" C-m
tmux send-keys -t "$SESSION:6" "cd '$MERCHANT_DIR' && bash -lc 'trap \"\" INT; pnpm exec expo start --dev-client -c --tunnel'" C-m
tmux send-keys -t "$SESSION:7" "cd '$COURIER_DIR' && bash -lc 'trap \"\" INT; pnpm exec expo start --dev-client -c --tunnel'" C-m

# --- Fenêtre 8: Platform (ops) : best effort (ne casse rien si absent) ---
tmux send-keys -t "$SESSION:8" "bash -lc 'cd /opt/delishafrica || exit 0; if [ -d delishafrica-ops ]; then cd delishafrica-ops; echo \"[platform] found: /opt/delishafrica/delishafrica-ops\"; (pnpm install && pnpm dev) || true; else echo \"[platform] delishafrica-ops NOT FOUND (ok, on continue)\"; fi'" C-m

tmux select-window -t "$SESSION:0"
tmux attach -t "$SESSION"
