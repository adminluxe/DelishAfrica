import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

type Partner = {
  id: string;
  name: string;
  slug: string;
  city: string;
  cuisine?: string;
  rating?: number;
};

const partners: Partner[] = [
  { id: 'p1', name: 'Thieyp', slug: 'thieyp', city: 'Bruxelles', cuisine: 'Sénégalais', rating: 4.8 },
  { id: 'p2', name: 'Afrosian', slug: 'afrosian', city: 'Bruxelles', cuisine: 'Afro-asiatique', rating: 4.6 },
  { id: 'p3', name: 'Toukoul', slug: 'toukoul', city: 'Bruxelles', cuisine: 'Éthiopien', rating: 4.7 }
];

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  // Canonique (v1)
  app.setGlobalPrefix('api/v1');

  const port = parseInt(process.env.PORT || '3010', 10);

  // ✅ Aliases Express pour compat apps (health + partners)
  const server = app.getHttpAdapter().getInstance();

  const healthHandler = (_req: any, res: any) => res.status(200).json({ status: 'ok' });

  server.get('/health', healthHandler);
  server.get('/api/health', healthHandler);
  // /api/v1/health est déjà servi par Nest via le prefix + controller, mais on le redonne aussi en alias safe
  server.get('/api/v1/health', healthHandler);

  server.get('/partners', (_req: any, res: any) => res.status(200).json(partners));
  server.get('/api/partners', (_req: any, res: any) => res.status(200).json(partners));
  server.get('/api/v1/partners', (_req: any, res: any) => res.status(200).json(partners));

  server.get(['/partners/:slug', '/api/partners/:slug', '/api/v1/partners/:slug'], (req: any, res: any) => {
    const p = partners.find(x => x.slug === req.params.slug);
    if (!p) return res.status(404).json({ message: 'partner_not_found' });
    return res.status(200).json(p);
  });

  await app.listen(port, '0.0.0.0');
  console.log(`[API] OK on http://127.0.0.1:${port} (health: /health | /api/health | /api/v1/health)`);
}
bootstrap();
