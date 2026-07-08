# === da-api-prisma-hotfix.sh ===
set -euo pipefail

API_ROOT="/opt/delishafrica/monorepo/services/api"
SRC="$API_ROOT/src"
PRISMA_DIR_SRC="$SRC/prisma"
SCHEMA="$API_ROOT/prisma/schema.prisma"

echo "→ 1) Création du PrismaService + PrismaModule (global)…"
mkdir -p "$PRISMA_DIR_SRC"

cat > "$PRISMA_DIR_SRC/prisma.service.ts" <<'TS'
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
TS

cat > "$PRISMA_DIR_SRC/prisma.module.ts" <<'TS'
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
TS

echo "→ 2) S’assurer que app.module.ts importe bien PrismaModule…"
APP_MODULE="$SRC/app.module.ts"
if [ -f "$APP_MODULE" ]; then
  cp -a "$APP_MODULE" "$APP_MODULE.bak.$(date +%F-%H%M%S)"
  # Ajoute l'import si absent
  if ! grep -q "from './prisma/prisma.module'" "$APP_MODULE"; then
    sed -i "1i import { PrismaModule } from './prisma/prisma.module';" "$APP_MODULE"
  fi
  # Insère PrismaModule dans imports: [ … ]
  if grep -q "imports:\s*\[" "$APP_MODULE"; then
    if ! grep -q "PrismaModule" "$APP_MODULE"; then
      sed -i "s/imports:\s*\[/imports: [PrismaModule, /" "$APP_MODULE"
    fi
  else
    sed -i "s/@Module({/@Module({ imports: [PrismaModule],/" "$APP_MODULE"
  fi
else
  echo "✖ $APP_MODULE introuvable — vérifie l’arborescence Nest (src/app.module.ts)."; exit 1
fi

echo "→ 3) Installer @prisma/client et prisma (si manquants) + generate…"
cd "$API_ROOT"
pnpm add -w --silent @prisma/client || pnpm add --silent @prisma/client || true
pnpm add -D --silent prisma || true

# Schéma minimal si absent (on ne détruit rien s'il existe déjà)
if [ ! -f "$SCHEMA" ]; then
  echo "   ⚠ Aucun schema.prisma trouvé → création d'un schéma minimal (PostgreSQL)…"
  mkdir -p "$(dirname "$SCHEMA")"
  cat > "$SCHEMA" <<'PRISMA'
generator client {
  provider = "prisma-client-js"
}
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
PRISMA
fi

# Génère le client
pnpm prisma generate || npx prisma generate || true

echo "→ 4) Build + (re)start PM2 delish-api…"
pnpm build || true
if pm2 describe delish-api >/dev/null 2>&1; then
  pm2 restart delish-api
else
  if [ -f "dist/main.js" ]; then
    pm2 start "node dist/main.js" --name delish-api
  else
    pm2 start "pnpm start:prod" --name delish-api
  fi
fi
sleep 2

echo "→ 5) Test local API (bypass Nginx/CF)…"
if curl -sf http://127.0.0.1:3010/api/health >/dev/null; then
  echo "✔ API locale OK sur :4001"
else
  echo "✖ API KO sur :4001 — logs (100 lignes) :"
  pm2 logs delish-api --lines 100
  exit 1
fi

echo "→ 6) Test Nginx local (HTTPS, ignore cert, bon Host)…"
curl -skI -H "Host: api.delishafrica.me" https://127.0.0.1/api/health | sed -n '1,4p'

echo "→ 7) Test public (Cloudflare)…"
curl -svo /dev/null https://api.delishafrica.me/api/health 2>&1 | sed -n '1,12p'
echo
curl -s https://api.delishafrica.me/api/health && echo || true

echo "✅ Hotfix Prisma terminé."
