import { NestFactory } from '@nestjs/core';
import { ThieypDemoModule } from './thieyp-demo/thieyp-demo.module';

async function bootstrap() {
  const app = await NestFactory.create(ThieypDemoModule, {
    cors: true,
  });

  // Toutes les routes seront préfixées par /api
  app.setGlobalPrefix('api');

  // Port : 4001 par défaut (aligné avec ton healthcheck / tmux / scripts)
  const port = process.env.PORT ? Number(process.env.PORT) : 4001;
  await app.listen(port);

  console.log(`DelishAfrica Thieyp API démarrée sur port ${port}`);
}

bootstrap().catch((err) => {
  // Petit log d'erreur explicite au cas où
  // (évite que Nest crashe silencieusement)
  // eslint-disable-next-line no-console
  console.error('Erreur au démarrage de ThieypDemoModule', err);
  process.exit(1);
});
