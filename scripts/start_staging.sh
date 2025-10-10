#!/usr/bin/env bash
set -Eeuo pipefail
APP=delish-api-staging
PORT=${PORT:-4101}
cd services/api
set -a
. ./.env.staging
set +a
pm2 delete "$APP" 2>/dev/null || true
PORT=$PORT NODE_ENV=staging pnpm exec ts-node --transpile-only src/main.ts &
PID=$!
sleep 0.3; kill $PID 2>/dev/null || true  # warm TS compile cache
pm2 start "bash -lc 'cd services/api; set -a; . ./.env.staging; set +a; PORT=$PORT NODE_ENV=staging pnpm exec ts-node --transpile-only src/main.ts'" --name "$APP"
pm2 save
