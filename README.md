# DelishAfrica Monorepo — Quickstart
- docker compose up -d
- cp services/api/.env.example services/api/.env
- pnpm i
- pnpm --filter @delish/api prisma:dev
- pnpm dev
