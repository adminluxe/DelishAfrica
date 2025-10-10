# DelishAfrica API – Runbook Dev/Prod (Ultra-concis)

## Démarrer (dev local)
pnpm -C services/api dev

## Build & Prod (PM2)
pnpm -C services/api build
pm2 start ecosystem.config.js --only delish-api
pm2 restart delish-api --update-env
pm2 logs delish-api --lines 60

## Santé & Diagnostics
curl -sS http://localhost:$\{PORT:-4001\}/api/health | jq .
ss -ltnp | grep :${PORT:-4001} || true

## Routes principales
GET  /api/health
POST /api/payments/intent
POST /api/webhooks/stripe
GET  /api/merchants/:id/menu.csv

## ENV requis (exemples)
PORT=4001
DATABASE_URL=postgresql://postgres@localhost:5433/postgres?schema=public
STRIPE_SECRET_KEY=***REMOVED***
TZ=Europe/Brussels
NODE_ENV=production

## Notes Logger
- Par défaut: Logger Nest (@nestjs/common).
- Pour activer nestjs-pino: import LoggerModule.forRoot(...) dans AppModule puis app.useLogger(app.get(PinoLogger)) dans main.ts.

## Routines utiles
# rebuild + restart + test
pnpm -C services/api build && pm2 restart delish-api --update-env && \
curl -sS http://localhost:$\{PORT:-4001\}/api/health | jq .

### DB (local, port 5433 via Docker) – One-liner
```bash
DBPASS='DelishLocal_2025!' ./scripts/ensure_db_password.sh
# Vérif:
curl -sS http://localhost:${PORT:-4001}/api/health | jq .

---

## CORS (dev vs prod)

- **Dev (NODE_ENV != production)**  
  CORS est **permissif** : `origin: true` (le serveur reflète l’Origin de la requête).  
  Pratique pour tester depuis n’importe quelle URL locale.

- **Prod (NODE_ENV = production)**  
  CORS est **restreint** : vous **devez** définir `CORS_ORIGINS` (liste CSV d’origines autorisées).  
  Si `CORS_ORIGINS` est vide ou manquant, **aucune** origine cross-site n’est autorisée (les navigateurs bloquent).

### Variable d’environnement

