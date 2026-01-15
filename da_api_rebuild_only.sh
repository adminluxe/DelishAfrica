#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
API="$ROOT/services/api"

echo ">>> [API-REBUILD] 1) Install deps API (pnpm install --silent)"
cd "$API"
pnpm install --silent

echo ">>> [API-REBUILD] 2) Build NestJS API (pnpm run build)"
pnpm run build

echo ">>> [API-REBUILD] 3) Redémarrage API via da_api_autoboot.sh"
cd "$ROOT"
./da_api_autoboot.sh

echo ">>> [API-REBUILD] 4) Tests locaux des endpoints"
./da_api_local_check.sh || true

echo ">>> [API-REBUILD] Terminé."
