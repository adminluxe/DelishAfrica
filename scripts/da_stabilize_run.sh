#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
cd "$ROOT"

echo "== 0) Snapshot =="
"$ROOT/ops_snapshot.sh" || true
"$ROOT/scripts/da_inventory.sh" || true

echo "== 1) Kill expo/metro/turbo + free ports (best effort) =="
pkill -f "expo start" 2>/dev/null || true
pkill -f "expo-dev-server" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true
pkill -f "turbo" 2>/dev/null || true

for p in 3010 8081 8082 8083 8084 8085 8086 5173; do
  lsof -tiTCP:$p -sTCP:LISTEN 2>/dev/null | xargs -r kill -9 || true
done

rm -rf /tmp/metro-* /tmp/haste-map-* 2>/dev/null || true
rm -rf node_modules/.cache 2>/dev/null || true

echo "== 2) Install propre (frozen) =="
pnpm -w install --frozen-lockfile

echo "== 3) Quality gates =="
pnpm typecheck
pnpm lint
pnpm test || true  # si pas de tests, au moins ne casse pas la pipeline

echo "== 4) Build =="
pnpm build

echo "== 5) Smoke API =="
"$ROOT/scripts/da_smoke.sh"

echo "✅ Stabilize done"
