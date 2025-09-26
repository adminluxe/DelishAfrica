#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then exec /bin/bash "$0" "$@"; fi
set -Eeuo pipefail
API_DIR="services/api"
cd "$API_DIR"

ts=$(date +%Y%m%d-%H%M%S)
mkdir -p backups/env
[ -f .env ] && cp .env "backups/env/.env.$ts" || true
[ -f prisma/.env ] && cp prisma/.env "backups/env/prisma.env.$ts" || true
touch prisma/.env

db_in_dotenv="$(grep -E '^DATABASE_URL=' -m1 .env || true)"
db_in_prisma="$(grep -E '^DATABASE_URL=' -m1 prisma/.env || true)"

if [ -n "$db_in_prisma" ]; then
  DB="${db_in_prisma#DATABASE_URL=}"
elif [ -n "$db_in_dotenv" ]; then
  DB="${db_in_dotenv#DATABASE_URL=}"
  (grep -vE '^DATABASE_URL=' prisma/.env || true) > prisma/.env.tmp
  printf 'DATABASE_URL=%s\n' "$DB" >> prisma/.env.tmp
  mv prisma/.env.tmp prisma/.env
else
  echo "⚠️ DATABASE_URL introuvable : renseigne services/api/prisma/.env"
fi

# Purge DATABASE_URL de .env pour éviter le conflit Prisma
if [ -f .env ]; then
  grep -vE '^DATABASE_URL=' .env > .env.tmp || true
  mv .env.tmp .env
fi

echo "✓ DATABASE_URL unifié dans services/api/prisma/.env"
