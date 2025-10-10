# DelishAfrica Monorepo — Quickstart
- docker compose up -d
- cp services/api/.env.example services/api/.env
- pnpm i
- pnpm --filter @delish/api prisma:dev
- pnpm dev
## Local API: build → restart → wait (PM2)

Utilisation rapide :
```bash
# Build + PM2 restart + attente de /api/health
pnpm api:restart
# Variante silencieuse
pnpm api:restart:q
# Logs et santé
make api/logs
make api/health
```

PM2 démarre automatiquement au boot (systemd).
La variable parasite `NODE_OPTIONS=--enable-source-maps` est neutralisée (ecosystem + dump PM2).

