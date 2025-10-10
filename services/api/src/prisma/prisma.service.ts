import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function redact(url?: string) {
  if (!url) return 'undefined';
  try {
    const u = new URL(url);
    const user = u.username ? `${u.username}@` : '';
    return `${u.protocol}//${user}${u.hostname}${u.port ? ':'+u.port : ''}${u.pathname}${u.search}`;
  } catch { return '(invalid url)'; }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  constructor() {
    super({ datasources: { db: { url: process.env.DATABASE_URL } } });
    this.logger.log(`Using DATABASE_URL=${redact(process.env.DATABASE_URL)}`);
  }
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
