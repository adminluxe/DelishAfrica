#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "Missing $1"; exit 1; }; }
need pnpm

# 1) Dépendances test/e2e + validation
pnpm --filter backend add -D jest @types/jest ts-jest supertest @types/supertest
pnpm --filter backend add class-validator class-transformer

# 2) Jest config (backend/jest.config.ts)
cat > backend/jest.config.ts <<'TS'
import type { Config } from 'jest';
const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.e2e-spec.ts', '<rootDir>/src/**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  setupFilesAfterEnv: [],
  verbose: true,
};
export default config;
TS

# 3) Test e2e /health/db
mkdir -p backend/test
cat > backend/test/health.e2e-spec.ts <<'TS'
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
TS

# 4) ValidationPipe global + CORS (idempotent)
MAIN=backend/src/main.ts
grep -q "ValidationPipe" "$MAIN" || sed -i "1i import { ValidationPipe } from '@nestjs/common';" "$MAIN"
# insère pipes + CORS juste après NestFactory.create si besoin
if ! grep -q "useGlobalPipes(new ValidationPipe" "$MAIN"; then
  awk '
    /NestFactory\.create\(AppModule\)/ && !done {
      print;
      print "  app.useGlobalPipes(new ValidationPipe({";
      print "    whitelist: true,";
      print "    forbidNonWhitelisted: true,";
      print "    transform: true,";
      print "  }));";
      print "  app.enableCors({ origin: true, credentials: true });";
      done=1; next
    }1' "$MAIN" > /tmp/main.ts && mv /tmp/main.ts "$MAIN"
fi

# 5) Scripts PNPM
if command -v jq >/dev/null 2>&1; then
  jq '.scripts.dev="nest start --watch"
      | .scripts["start:dev"]="nest start --watch"
      | .scripts.build="nest build"
      | .scripts.test="jest --config jest.config.ts --runInBand"
      | .scripts["test:e2e"]="jest --config jest.config.ts --runInBand --testMatch '\''<rootDir>/test/**/*.e2e-spec.ts'\''"
     ' backend/package.json > /tmp/backend_pkg && mv /tmp/backend_pkg backend/package.json

  jq '.scripts["backend:dev"]="pnpm --filter backend dev"
      | .scripts["backend:test"]="pnpm --filter backend test"
      | .scripts["backend:test:e2e"]="pnpm --filter backend test:e2e"
      | .scripts["backend:build"]="pnpm --filter backend build"
      | .scripts["backend:start:prod"]="node backend/dist/main.js"
     ' package.json > /tmp/root_pkg && mv /tmp/root_pkg package.json
else
  # fallback sans jq (ajout simple si manquants)
  grep -q '"dev": "nest start --watch"' backend/package.json || sed -i 's/"scripts": {/"scripts": {\n    "dev": "nest start --watch",/g' backend/package.json
  grep -q '"build": "nest build"' backend/package.json || sed -i 's/"scripts": {/"scripts": {\n    "build": "nest build",/g' backend/package.json
  grep -q '"test": "jest --config jest.config.ts --runInBand"' backend/package.json || sed -i 's/"scripts": {/"scripts": {\n    "test": "jest --config jest.config.ts --runInBand",/g' backend/package.json
  grep -q '"test:e2e": "jest --config jest.config.ts --runInBand --testMatch '\''<rootDir>\/test\/\*\*\/\*.e2e-spec.ts'\''"' backend/package.json || \
    sed -i 's/"scripts": {/"scripts": {\n    "test:e2e": "jest --config jest.config.ts --runInBand --testMatch '\''<rootDir>\/test\/**\/*.e2e-spec.ts'\''",/g' backend/package.json

  grep -q '"backend:dev": "pnpm --filter backend dev"' package.json || sed -i 's/"scripts": {/"scripts": {\n    "backend:dev": "pnpm --filter backend dev",/g' package.json
  grep -q '"backend:test": "pnpm --filter backend test"' package.json || sed -i 's/"scripts": {/"scripts": {\n    "backend:test": "pnpm --filter backend test",/g' package.json
  grep -q '"backend:test:e2e": "pnpm --filter backend test:e2e"' package.json || sed -i 's/"scripts": {/"scripts": {\n    "backend:test:e2e": "pnpm --filter backend test:e2e",/g' package.json
  grep -q '"backend:build": "pnpm --filter backend build"' package.json || sed -i 's/"scripts": {/"scripts": {\n    "backend:build": "pnpm --filter backend build",/g' package.json
  grep -q '"backend:start:prod": "node backend\/dist\/main.js"' package.json || sed -i 's/"scripts": {/"scripts": {\n    "backend:start:prod": "node backend\\/dist\\/main.js",/g' package.json
fi

echo "✓ Qualité & tests câblés.
- Tests e2e: backend/test/health.e2e-spec.ts
- Jest config: backend/jest.config.ts
- ValidationPipe global + CORS: backend/src/main.ts
- Scripts: pnpm backend:dev | backend:test | backend:test:e2e | backend:build | backend:start:prod
"
