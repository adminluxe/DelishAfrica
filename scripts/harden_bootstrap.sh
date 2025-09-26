#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then exec /bin/bash "$0" "$@"; fi
set -Eeuo pipefail
API_DIR="$PWD/services/api"
MAIN_TS="$API_DIR/src/main.ts"

cat > "$MAIN_TS" <<'TS'
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger as NestLogger } from '@nestjs/common';

function getCorsOriginSetting(env?: string, csv?: string): boolean | string[] {
  if (env === 'production') {
    if (!csv) return []; // rien d'autorisé si non défini
    return csv.split(',').map(s => s.trim()).filter(Boolean);
  }
  return true; // en dev : permissif
}

function describeOrigin(val: boolean | string[]): string {
  if (val === true) return 'true (reflect request origin)';
  if (Array.isArray(val)) return `[${val.join(', ')}]`;
  return String(val);
}

async function bootstrap() {
  const logger = new NestLogger('Bootstrap');

  // Catch global errors tôt pour tout voir en logs
  process.on('uncaughtException', (err) => logger.error(`uncaughtException: ${err?.stack || err}`));
  process.on('unhandledRejection', (reason) => logger.error(`unhandledRejection: ${reason}`));

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(logger);

  const nodeEnv = process.env.NODE_ENV ?? '(unset)';
  const corsCsv = process.env.CORS_ORIGINS ?? '(unset)';
  const port = Number(process.env.PORT) || 4001;

  logger.log(`[BOOT] NODE_ENV=${nodeEnv} PORT=${port}`);
  logger.log(`[CORS] raw CORS_ORIGINS=${corsCsv}`);

  // Import dynamique de helmet (échoue gracieusement si absent)
  let helmetMiddleware: any = null;
  try {
    const h = await import('helmet');
    const helmet = (h as any).default ?? h;
    helmetMiddleware = helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    });
  } catch (e) {
    logger.warn(`[BOOT] Helmet non disponible: ${(e as Error)?.message || e}`);
  }

  app.setGlobalPrefix('api');

  if (helmetMiddleware) {
    app.use(helmetMiddleware);
  }

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const originSetting = getCorsOriginSetting(process.env.NODE_ENV, process.env.CORS_ORIGINS);
  logger.log(`[CORS] effective origin setting = ${describeOrigin(originSetting)}`);

  app.enableCors({
    origin: originSetting,
    credentials: true,
  });

  // Import dynamique de Swagger (dev uniquement)
  if (process.env.NODE_ENV !== 'production') {
    try {
      const sw = await import('@nestjs/swagger');
      const DocumentBuilder = (sw as any).DocumentBuilder;
      const SwaggerModule = (sw as any).SwaggerModule;
      const cfg = new DocumentBuilder()
        .setTitle('DelishAfrica API')
        .setDescription('Documentation OpenAPI')
        .setVersion('0.1.0')
        .addBearerAuth()
        .build();
      const doc = SwaggerModule.createDocument(app, cfg);
      SwaggerModule.setup('docs', app, doc, { useGlobalPrefix: true, jsonDocumentUrl: 'docs/openapi.json' });
    } catch (e) {
      logger.warn(`[BOOT] Swagger désactivé (module indisponible): ${(e as Error)?.message || e}`);
    }
  }

  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 API up: http://localhost:${port}/api/health`);
  if (process.env.NODE_ENV !== 'production') {
    logger.log(`📚 Swagger: http://localhost:${port}/api/docs`);
  }
}

bootstrap().catch(err => {
  const log = new NestLogger('Bootstrap');
  log.error(err);
  process.exit(1);
});
TS

echo "✓ main.ts renforcé (imports dynamiques, logs étendus)"
