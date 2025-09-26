#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then exec /bin/bash "$0" "$@"; fi
set -euo pipefail

REPO="$HOME/delishafrica-monorepo"
API="$REPO/services/api"
ECOSYS="$REPO/ecosystem.delish-api.config.js"
APP="delish-api"

echo "→ 1) Forcer outDir=dist et rootDir=src dans tsconfig.json"
TS="$API/tsconfig.json"
if command -v jq >/dev/null 2>&1; then
  tmp="$(mktemp)"
  jq '.compilerOptions.outDir="dist" | .compilerOptions.rootDir="src"' "$TS" > "$tmp"
  mv "$tmp" "$TS"
else
  # fallback sed (grossier mais efficace si bloc compilerOptions existe)
  sed -i -E 's/"outDir": *"[^"]*"/"outDir": "dist"/' "$TS" || true
  sed -i -E 's/"rootDir": *"[^"]*"/"rootDir": "src"/' "$TS" || true
  # si absent, on injecte vite fait après "compilerOptions": {
  sed -i -E '0,/"compilerOptions": *\{/{s//"compilerOptions": {\n  "outDir": "dist",\n  "rootDir": "src",/}' "$TS" || true
fi

echo "→ 2) main.ts avec CORS dev/prod + Helmet + Swagger (Swagger hors prod)"
cat > "$API/src/main.ts" <<'TS'
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger as NestLogger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

function getCorsOriginSetting(nodeEnv?: string, corsEnv?: string) {
  const logger = new NestLogger('CORS');
  if (nodeEnv === 'production') {
    if (!corsEnv || !corsEnv.trim()) {
      logger.warn('CORS_ORIGINS manquant en production -> CORS fermé (aucune origine autorisée).');
      return []; // rien n'est autorisé -> le navigateur bloquera les requêtes cross-origin
    }
    const list = corsEnv.split(',').map(s => s.trim()).filter(Boolean);
    logger.log(`CORS (prod) -> ${list.join(', ')}`);
    return list;
  }
  // DEV: permissif
  logger.log('CORS (dev) -> * (toutes origines autorisées)');
  return true;
}

async function bootstrap() {
  const logger = new NestLogger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: true, logger });

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
  await app.listen(port);
  logger.log(`🚀 API up: http://localhost:${port}/api/health`);
  if (process.env.NODE_ENV !== 'production') {
    logger.log(`📚 Swagger: http://localhost:${port}/api/docs`);
  }
}
bootstrap();
TS

echo "→ 3) Clean + build"
rm -rf "$API/dist"
pnpm -C "$API" build

echo "→ 4) Vérif sortie dist/main.js"
if [ ! -f "$API/dist/main.js" ]; then
  echo "❌ Echec: $API/dist/main.js introuvable après build."
  echo "   Montre-moi la sortie de: ls -la $API/dist && cat $API/tsconfig.json | sed -n '1,120p'"
  exit 1
fi

echo "→ 5) Restart PM2 (ecosystem.delish-api.config.js)"
if [ ! -f "$ECOSYS" ]; then
  echo "⚠️  $ECOSYS introuvable, je le crée rapidement."
  cat > "$ECOSYS" <<JS
module.exports = {
  apps: [
    {
      name: 'delish-api',
      cwd: 'services/api',
      script: 'dist/main.js',
      watch: false,
      env: {
        NODE_ENV: process.env.NODE_ENV || 'production',
        PORT: Number(process.env.PORT || 4001),
        TZ: process.env.TZ || 'Europe/Brussels',
        CORS_ORIGINS: process.env.CORS_ORIGINS || ''
      }
    }
  ]
}
JS
fi

pm2 delete "$APP" 2>/dev/null || true
pm2 start "$ECOSYS" --only "$APP"
pm2 save
pm2 logs "$APP" --lines 20

echo "→ 6) Sanity check"
curl -sS "http://localhost:${PORT:-4001}/api/health" | jq . || true
