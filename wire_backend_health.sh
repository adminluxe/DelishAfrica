#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "Missing $1"; exit 1; }; }
need sed

# 1) PrismaModule + PrismaService
mkdir -p backend/src/prisma
cat > backend/src/prisma/prisma.service.ts <<'TS'
import { INestApplication, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit', async () => { await app.close(); });
  }
}
TS

cat > backend/src/prisma/prisma.module.ts <<'TS'
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
TS

# 2) Health module + controller + service
mkdir -p backend/src/health
cat > backend/src/health/health.service.ts <<'TS'
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}
  async db() {
    const [{ version }] = await this.prisma.$queryRaw`SELECT version();`;
    const products = await this.prisma.product.count().catch(() => null);
    return { ok: true, products, db: { version } };
  }
}
TS

cat > backend/src/health/health.controller.ts <<'TS'
import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}
  @Get('db')
  db() { return this.health.db(); }
}
TS

cat > backend/src/health/health.module.ts <<'TS'
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
TS

# 3) AppModule (imports HealthModule + PrismaModule)
APP="backend/src/app.module.ts"
if [[ -f "$APP" ]]; then
  grep -q "from './prisma/prisma.module'" "$APP" || sed -i "1i import { PrismaModule } from './prisma/prisma.module';" "$APP"
  grep -q "from './health/health.module'" "$APP" || sed -i "1i import { HealthModule } from './health/health.module';" "$APP"

  if grep -q "imports:\\s*\\[" "$APP"; then
    # Ajoute nos modules au début de la 1ère liste imports
    sed -i '0,/imports:\s*\[/s//imports: [PrismaModule, HealthModule, /' "$APP"
  else
    # Crée imports si absent
    sed -i "/@Module({/a \  imports: [PrismaModule, HealthModule]," "$APP"
  fi
else
  echo "⚠ backend/src/app.module.ts introuvable. Ajoute manuellement:
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [PrismaModule, HealthModule],
})
export class AppModule {}
"
fi

# 4) Scripts PNPM
#   a) backend/package.json → "dev": "nest start --watch"
if command -v jq >/dev/null 2>&1; then
  jq '.scripts.dev="nest start --watch"|.scripts["start:dev"]="nest start --watch"' backend/package.json > /tmp/backend_pkg && mv /tmp/backend_pkg backend/package.json
else
  # fallback: append if not there
  grep -q '"dev": "nest start --watch"' backend/package.json || sed -i 's/"scripts": {/"scripts": {\n    "dev": "nest start --watch",/g' backend/package.json
  grep -q '"start:dev": "nest start --watch"' backend/package.json || sed -i 's/"scripts": {/"scripts": {\n    "start:dev": "nest start --watch",/g' backend/package.json
fi

#   b) racine package.json → "backend:dev": "pnpm --filter backend dev"
if [[ -f package.json ]]; then
  if command -v jq >/dev/null 2>&1; then
    jq '.scripts["backend:dev"]="pnpm --filter backend dev"' package.json > /tmp/root_pkg && mv /tmp/root_pkg package.json
  else
    grep -q '"backend:dev": "pnpm --filter backend dev"' package.json || sed -i 's/"scripts": {/"scripts": {\n    "backend:dev": "pnpm --filter backend dev",/g' package.json
  fi
fi

echo "✓ Câblage terminé.
- Endpoint: GET /health/db
- Modules: PrismaModule (global), HealthModule
- Scripts:
    • backend: dev = \"nest start --watch\"
    • racine: backend:dev = \"pnpm --filter backend dev\"
"
