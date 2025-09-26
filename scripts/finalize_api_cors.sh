#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then exec /bin/bash "$0" "$@"; fi
set -Eeuo pipefail

APP_NAME="delish-api"
REPO_ROOT="$(pwd -P)"
API_DIR="$REPO_ROOT/services/api"
MAIN_TS="$API_DIR/src/main.ts"
ECO="$REPO_ROOT/ecosystem.delish-api.config.js"
PORT="${PORT:-4001}"

echo "→ Repo root      : $REPO_ROOT"
echo "→ API dir        : $API_DIR"
echo "→ main.ts path   : $MAIN_TS"
echo "→ ecosystem file : $ECO"
echo

# 1) main.ts (CORS + Helmet + Swagger en dev)
cat > "$MAIN_TS" <<'TS'
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger as NestLogger } from '@nestjs/common';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

function getCorsOriginSetting(env?: string, csv?: string): boolean | string[] {
  if (env === 'production') {
    if (!csv) return []; // rien d'autorisé si non défini
    return csv.split(',').map(s => s.trim()).filter(Boolean);
  }
  return true; // en dev, permissif
}

async function bootstrap() {
  const logger = new NestLogger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(logger);

  app.setGlobalPrefix('api');

  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.enableCors({
    origin: getCorsOriginSetting(process.env.NODE_ENV, process.env.CORS_ORIGINS),
    credentials: true,
  });

  if (process.env.NODE_ENV !== 'production') {
    const cfg = new DocumentBuilder()
      .setTitle('DelishAfrica API')
      .setDescription('Documentation OpenAPI')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const doc = SwaggerModule.createDocument(app, cfg);
    SwaggerModule.setup('docs', app, doc, { useGlobalPrefix: true, jsonDocumentUrl: 'docs/openapi.json' });
  }

  app.enableShutdownHooks();

  const port = Number(process.env.PORT) || 4001;
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 API up: http://localhost:${port}/api/health`);
  if (process.env.NODE_ENV !== 'production') {
    logger.log(`📚 Swagger: http://localhost:${port}/api/docs`);
  }
}

bootstrap().catch(err => {
  new NestLogger('Bootstrap').error(err);
  process.exit(1);
});
TS
echo "✓ main.ts écrit"

# 2) Build + (Re)start PM2
echo
echo "→ Build API (tsc)…"
pnpm -C "$API_DIR" build

echo
echo "→ (Re)start PM2…"
pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
pm2 start "$ECO" --only "$APP_NAME"

# 3) Healthcheck
echo
echo "→ Healthcheck /api/health (port ${PORT})…"
for i in {1..20}; do
  curl -fsS "http://localhost:${PORT}/api/health" >/dev/null 2>&1 && break
  sleep 0.5
done
curl -sS "http://localhost:${PORT}/api/health" || true

echo
echo "✅ Done."
