import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('/health/db (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health/db -> { ok: true, products: number, db: { version } }', async () => {
    const res = await request(app.getHttpServer()).get('/health/db').expect(200);
    expect(res.body).toHaveProperty('ok', true);
    expect(typeof res.body.products).toBe('number');
    expect(res.body.db && typeof res.body.db.version).toBe('string');
  });
});
