# DelishAfrica — Runbook DEV (1 page)

## 0) Pré-requis
- **Prisma env**: `services/api/prisma/.env` contient **DATABASE_URL** (⚠️ sans guillemets).
  - Exemple: `DATABASE_URL=postgresql://user:pass@localhost:5432/delishafrica_dev?schema=public`
- **Ne pas** dupliquer `DATABASE_URL` dans `services/api/.env`.

## 1) Consolider Prisma env (anti-conflit)
```bash
./scripts/consolidate_prisma_env.sh
export DATABASE_URL="$(grep ^DATABASE_URL services/api/prisma/.env | cut -d= -f2-)"
pnpm -C services/api exec prisma validate --schema=prisma/schema.prisma
pnpm -C services/api exec prisma migrate dev --name sync_env --skip-seed

