#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")/.."

# 1) Prisma env (DATABASE_URL)
if [ -f prisma/.env ]; then
  set -a; . prisma/.env; set +a
fi

# 2) Runtime env (CORS, etc.)
if [ -f .env.runtime ]; then
  set -a; . .env.runtime; set +a
fi

: "${NODE_ENV:=development}"
: "${PORT:=4001}"

echo "[ENTRY] main.ts starting"
echo "[BOOT] NODE_ENV=$NODE_ENV PORT=$PORT"
echo "[CORS] raw CORS_ORIGINS=${CORS_ORIGINS:-"(unset)"}"
exec node --enable-source-maps dist/main.js
