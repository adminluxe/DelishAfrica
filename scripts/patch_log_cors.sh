#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then exec /bin/bash "$0" "$@"; fi
set -Eeuo pipefail

API_DIR="$PWD/services/api"
MAIN_TS="$API_DIR/src/main.ts"

cat > "$MAIN_TS" <<'TS'
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger as NestLogger } from '@nestjs/common';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

function getCorsOriginSetting(env?: string, csv?: string): boolean | string[] {
  if (env === 'production') {
    if (!csv) return []; // en prod: rien si non défini
    return csv.split(',').map(s => s.trim()).filter(Boolean);
  }
  return true; // en dev: permissif (reflect origin)
}

function describeOrigin(val: boolean | string[]): string {
  if (val === true) return 'true (reflect request origin)';
  if (Array.isArray(val)) return `[${val.join(', ')}]`;
  return String(val);
}

async function bootstrap() {
  const logger = new NestLogger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(logger);

  const nodeEnv = process.env.NODE_ENV ?? '(unset)';
  const corsCsv = process.env.CORS_ORIGINS ?? '(unset)';
  const port = Number(process.env.PORT) || 4001;

  logger.log(`[BOOT] NODE_ENV=${nodeEnv} PORT=${port}`);
  logger.log(`[CORS] raw CORS_ORIGINS=${corsCsv}`);

  const originSetting = getCorsOriginSetting(process.env.NODE_ENV, process.env.CORS_ORIGINS);
  logger.log(`[CORS] effective origin setting = ${describeOrigin(originSetting)}`);

  app.setGlobalPrefix('api');

  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.enableCors({
    origin: originSetting,
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

echo "✓ main.ts mis à jour avec logs [CORS]"
