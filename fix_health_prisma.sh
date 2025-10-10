#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then exec /bin/bash "$0" "$@"; fi
set -Eeuo pipefail

# 1) backend/src/prisma/prisma.service.ts (supprime l'appel this.$on)
cat > backend/src/prisma/prisma.service.ts <<'TS'
import { INestApplication, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Optionnel : si tu veux fermer Nest proprement avant la sortie du process,
   * sans utiliser this.$on('beforeExit', ...) (qui posait un souci de typings).
   */
  enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }
}
TS

# 2) backend/src/health/health.service.ts (type le $queryRaw)
cat > backend/src/health/health.service.ts <<'TS'
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async db() {
    // Typage explicite pour lever l'unknown + destructuring sûr
    const res = await this.prisma.$queryRaw<{ version: string }[]>`SELECT version();`;
    const version = Array.isArray(res) && res[0]?.version ? res[0].version : 'unknown';

    const products = await this.prisma.product.count().catch(() => null);

    return { ok: true, products, db: { version } };
  }
}
TS

echo "✓ Patches applied. Now restart your backend watcher."
