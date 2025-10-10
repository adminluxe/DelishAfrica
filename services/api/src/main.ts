import searchRouter from './routes/search';

import { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
// ⚠️ Log TRES tôt, avant tout import lourd
console.log('[ENTRY] main.ts starting');

import { ValidationPipe, Logger as NestLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

function getCorsOriginSetting(env?: string, csv?: string): boolean | string[] {
  if (env === 'production') {
    if (!csv) return [];
    return csv.split(',').map(s => s.trim()).filter(Boolean);
  }
  return true;
}

function describeOrigin(val: boolean | string[]): string {
  if (val === true) return 'true (reflect request origin)';
  if (Array.isArray(val)) return `[${val.join(', ')}]`;
  return String(val);
}

async function bootstrap() {
  const logger = new NestLogger('Bootstrap');

  // Catch global pour tout voir
  process.on('uncaughtException', (err) => console.error('[uncaughtException]', err?.stack || err));
  process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason));

  const nodeEnv = process.env.NODE_ENV ?? '(unset)';
  const corsCsv = process.env.CORS_ORIGINS ?? '(unset)';
  const port = Number(process.env.PORT) || 4001;

  console.log(`[BOOT] NODE_ENV=${nodeEnv} PORT=${port}`);
  console.log(`[CORS] raw CORS_ORIGINS=${corsCsv}`);

  // ←←← IMPORT DYNAMIQUE d'AppModule (clé du debug)
  let AppModule: any;
  try {
    AppModule = (await import('./app.module')).AppModule;
  } catch (e) {
    console.error('[BOOT] Echec import ./app.module :', (e as any)?.stack || e);
    process.exit(1);
  }

  // helmet en dynamique (gracieux si absent)
  let helmetMiddleware: any = null;
  try {
    const h = await import('helmet');
    const helmet = (h as any).default ?? h;
    helmetMiddleware = helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    });
  } catch (e) {
    console.warn('[BOOT] Helmet non disponible :', (e as any)?.message || e);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  // Trust reverse proxy (Nginx/Cloudflare)
  app.set('trust proxy', 1);
  // Apply global rate-limit guard explicitly (safe even if APP_GUARD exists)
//   app.useGlobalGuards(app.get(ThrottlerGuard)) // (désactivé : APP_GUARD gère le throttling);
app.useLogger(logger);
  app.setGlobalPrefix('api');

  if (helmetMiddleware) app.use(helmetMiddleware);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const originSetting = getCorsOriginSetting(process.env.NODE_ENV, process.env.CORS_ORIGINS);
  console.log(`[CORS] effective origin = ${describeOrigin(originSetting)}`);

  app.enableCors({ origin: originSetting, credentials: true });

  // Swagger en dev uniquement, en dynamique
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
      console.warn('[BOOT] Swagger désactivé :', (e as any)?.message || e);
    }
  }

  app.enableShutdownHooks();

  (function(){
  const _nocache = (req: Request, res: Response, next: NextFunction) => {
    if (req.originalUrl && req.originalUrl.startsWith("/api/health")) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
    next();
  };
  (app as any).use(_nocache);
})();

await app.listen(port, '0.0.0.0');
  console.log(`🚀 API up: http://localhost:${port}/api/health`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📚 Swagger: http://localhost:${port}/api/docs`);
  }
}

bootstrap().catch(err => {
  console.error('[BOOT] Rejection:', err?.stack || err);
  process.exit(1);
});

import { ThrottlerGuard } from '@nestjs/throttler';
