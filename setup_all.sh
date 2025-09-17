#!/usr/bin/env bash
set -euo pipefail

# This script sets up the DelishAfrica monorepo automatically. It does the following:
#   1. Starts the DB and Redis containers via docker compose
#   2. Installs all dependencies using pnpm
#   3. Runs the Prisma migration to create tables
#   4. Seeds a default Merchant with id MERCH1
#
# Usage: from the root of the monorepo run
#   bash setup_all.sh

# Ensure containers are up
echo "[1/4] Starting Docker services..."
docker compose up -d

# Install dependencies
echo "[2/4] Installing dependencies with pnpm..."
pnpm i

# Run Prisma migrations from within services/api to pick up local .env
echo "[3/4] Running Prisma migrations..."
pushd services/api >/dev/null
if [ -f "prisma/schema.prisma" ]; then
  npx prisma migrate dev --name init
  # Generate client if necessary
  npx prisma generate
else
  echo "Prisma schema not found; skipping migration"
fi
popd >/dev/null

# Seed Merchant MERCH1 if not exists
echo "[4/4] Seeding default Merchant (MERCH1)..."
docker exec -i delishafrica-monorepo-db-1 psql -U postgres -d delishafrica -c \
  "INSERT INTO \"Merchant\" (id,name,address) VALUES ('MERCH1','Restaurant Test','Bruxelles') ON CONFLICT (id) DO NOTHING;"

echo "✅ Setup complete."
echo "You can now run the API and PWA in separate terminals:" 
echo "   pnpm --filter @delish/api dev          # API at http://localhost:4000/api/health" 
echo "   pnpm --filter @delish/merchant-web dev # PWA at http://localhost:5174" 