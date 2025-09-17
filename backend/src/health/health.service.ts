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
