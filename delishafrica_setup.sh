#!/bin/bash

# DelishAfrica project bootstrap script
#
# This script automates the initial setup of a local DelishAfrica monorepo.
# It corrects a syntax error in the merchant web app, checks for the
# required tooling, scaffolds the monorepo structure, bootstraps a NestJS
# backend with Prisma, and creates two Expo apps for the client and courier.

set -e

echo "\n=== DelishAfrica Environment Setup ==="

# Step 1: Fix syntax error in the merchant web app
MERCHANT_MAIN="apps/merchant-web/src/main.tsx"
if [ -f "$MERCHANT_MAIN" ]; then
  # Remove an unwanted backslash before the semicolon at the end of the API_BASE definition
  sed -i 's/\"\\;$/\";/' "$MERCHANT_MAIN" || true
  echo "✔ Corrected syntax in $MERCHANT_MAIN"
else
  echo "ℹ $MERCHANT_MAIN not found – skipping syntax fix"
fi

# Step 2: Display Node.js and PNPM versions
echo "Node.js version: $(node -v 2>/dev/null || echo 'not installed')"
echo "PNPM version: $(pnpm -v 2>/dev/null || echo 'not installed')"

# Step 3: Ensure base directory structure exists
mkdir -p apps/client-app apps/courier-app libs backend
echo "✔ Ensured monorepo directories (apps/client-app, apps/courier-app, libs, backend) exist"

# Step 4: Initialize the NestJS backend if it doesn't already exist
if [ ! -d backend/src ]; then
  echo "⏳ Creating NestJS backend…"
  pnpm create nest-app backend --package-manager pnpm --yes
  echo "✔ NestJS backend created in ./backend"
fi

# Add Prisma support to backend
cd backend
if ! pnpm list @nestjs/prisma >/dev/null 2>&1; then
  echo "⏳ Installing Prisma and NestJS Prisma module…"
  pnpm add @nestjs/prisma prisma @prisma/client
  echo "✔ Added Prisma packages"
fi

# Create Prisma schema if it doesn't exist
mkdir -p prisma
SCHEMA_FILE="prisma/schema.prisma"
if [ ! -f "$SCHEMA_FILE" ]; then
  echo "⏳ Writing example Prisma schema…"
  cat > "$SCHEMA_FILE" <<'PRISMA'
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  role      Role     @default(CLIENT)
  orders    Order[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Merchant {
  id        String   @id @default(uuid())
  name      String
  menuItems Product[]
  orders    Order[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Product {
  id          String   @id @default(uuid())
  merchant    Merchant @relation(fields: [merchantId], references: [id])
  merchantId  String
  name        String
  description String?
  category    String?
  price       Float
  available   Boolean  @default(true)
  spicyLevel  Int?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Order {
  id          String      @id @default(uuid())
  user        User        @relation(fields: [userId], references: [id])
  userId      String
  merchant    Merchant    @relation(fields: [merchantId], references: [id])
  merchantId  String
  items       Product[]
  total       Float
  status      OrderStatus @default(PENDING)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}

enum Role {
  CLIENT
  MERCHANT
  COURIER
  ADMIN
}

enum OrderStatus {
  PENDING
  ACCEPTED
  IN_PREPARATION
  READY
  PICKED_UP
  DELIVERED
  CANCELED
}
PRISMA
  echo "✔ Prisma schema created at $SCHEMA_FILE"
fi

cd ..

# Step 5: Create Expo apps if they don't exist
if [ ! -f apps/client-app/app.json ]; then
  echo "⏳ Creating Expo client app…"
  npx --yes create-expo-app apps/client-app --template expo-template-blank-typescript
  echo "✔ Client Expo app created in apps/client-app"
fi

if [ ! -f apps/courier-app/app.json ]; then
  echo "⏳ Creating Expo courier app…"
  npx --yes create-expo-app apps/courier-app --template expo-template-blank-typescript
  echo "✔ Courier Expo app created in apps/courier-app"
fi

echo "\nSetup complete!"
echo "➡️  Next steps:"
echo "   • Configure your DATABASE_URL in backend/.env and run: pnpm --filter backend prisma migrate dev --name init"
echo "   • Start the merchant web app: pnpm --filter @delish/merchant-web dev"
echo "   • Start the backend: pnpm --filter backend start:dev"
echo "   • Start the client app: pnpm --filter apps/client-app start"
echo "   • Start the courier app: pnpm --filter apps/courier-app start"