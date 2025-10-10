#!/usr/bin/env bash
set -euo pipefail

# ---------- Réglages ----------
BASE="$HOME/delishafrica-monorepo/services/api"
PORT="${PORT:-4001}"
API_PREFIX="${API_PREFIX:-api}"
DB_URL="${DB_URL:-postgresql://delish_user:delish_pass@localhost:5432/delish_db?schema=public}"

echo "==> Dossier API: $BASE"
mkdir -p "$BASE"

# ---------- 0) Libère le port & PM2 propre ----------
echo "==> Libération du port ${PORT} et reset PM2"
ss -ltnp | grep ":$PORT" || true
fuser -k "$PORT"/tcp 2>/dev/null || true
lsof -ti :"$PORT" | xargs -r kill -9 || true
pm2 delete delish-api 2>/dev/null || true

# ---------- 1) Env: sépare DB et app ----------
echo "==> Nettoyage des .env"
cd "$BASE"
# s'il existe .env on le renomme en .env.app (sans DATABASE_URL)
if [[ -f ".env" ]]; then
  grep -v '^DATABASE_URL=' .env > .env.app.tmp || true
  mv .env .env.bak.$(date +%s)
  mv .env.app.tmp .env.app
fi
# place DATABASE_URL seulement dans prisma/.env
mkdir -p prisma
if [[ ! -f "prisma/.env" ]] || ! grep -q '^DATABASE_URL=' prisma/.env; then
  echo "DATABASE_URL=\"$DB_URL\"" > prisma/.env
else
  sed -i 's|^DATABASE_URL=.*|DATABASE_URL="'"$DB_URL"'"|' prisma/.env
fi

# ---------- 2) Arbo modules ----------
echo "==> Création des modules health & payment"
mkdir -p src/modules/health
mkdir -p src/modules/payment

# 2a) Health
cat > src/modules/health/health.controller.ts <<'TS'
import { Controller, Get } from '@nestjs/common'

@Controller('health')
export class HealthController {
  @Get()
  ok() {
    return { ok: true, ts: new Date().toISOString() }
  }
}
TS

cat > src/modules/health/health.module.ts <<'TS'
import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'
@Module({ controllers: [HealthController] })
export class HealthModule {}
TS

# 2b) Payment (controller + service + module)
cat > src/modules/payment/payment.controller.ts <<'TS'
import { Body, Controller, Headers, Post, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { RawBodyRequest } from '@nestjs/common'
import { PaymentService } from './payment.service'

@Controller('payments')
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}
  @Post('intent')
  async createIntent(@Body() body: { orderId: string; amountCents: number; currency?: string }) {
    return this.payments.createIntent(body.orderId, body.amountCents, body.currency || 'EUR')
  }
}

@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(private readonly payments: PaymentService) {}
  @Post()
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
    @Headers('stripe-signature') sig?: string
  ) {
    try {
      const out = await this.payments.handleWebhook(sig, req.rawBody as Buffer)
      res.status(200).json(out)
    } catch (e) {
      res.status(400).send('Webhook Error')
    }
  }
}
TS

cat > src/modules/payment/payment.service.ts <<'TS'
import { Injectable } from '@nestjs/common'
import Stripe from 'stripe'

@Injectable()
export class PaymentService {
  private stripe: Stripe
  constructor() {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY missing')
    this.stripe = new Stripe(key, { apiVersion: '2025-08-27.basil' as any })
  }

  async createIntent(orderId: string, amountCents: number, currency: string) {
    if (!orderId || !amountCents) throw new Error('orderId/amountCents required')
    const intent = await this.stripe.paymentIntents.create({
      amount: amountCents,
      currency,
      metadata: { orderId },
      automatic_payment_methods: { enabled: true },
    })
    return { clientSecret: intent.client_secret, intentId: intent.id }
  }

  async handleWebhook(signature: string | undefined, rawBody: Buffer) {
    const wh = process.env.STRIPE_WEBHOOK_SECRET
    if (!wh) throw new Error('STRIPE_WEBHOOK_SECRET missing')
    if (!signature) throw new Error('Missing stripe-signature')
    const evt = this.stripe.webhooks.constructEvent(rawBody, signature, wh)
    // Ici tu peux réagir: evt.type === 'payment_intent.succeeded' etc.
    return { received: true, id: evt.id, type: evt.type }
  }
}
TS

cat > src/modules/payment/payment.module.ts <<'TS'
import { Module } from '@nestjs/common'
import { PaymentController, StripeWebhookController } from './payment.controller'
import { PaymentService } from './payment.service'

@Module({
  controllers: [PaymentController, StripeWebhookController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
TS

# ---------- 3) main.ts (prefix + raw body stripe) ----------
echo "==> Normalisation src/main.ts"
mkdir -p src
cat > src/main.ts <<'TS'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import * as express from 'express'
import { json, urlencoded } from 'express'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true })
  const prefix = process.env.API_PREFIX || 'api'
  app.setGlobalPrefix(prefix)
  app.use(`/${prefix}/webhooks/stripe`, express.raw({ type: '*/*' }))
  app.use(json())
  app.use(urlencoded({ extended: true }))
  const port = Number(process.env.PORT || 4001)
  await app.listen(port)
}
bootstrap()
TS

# ---------- 4) AppModule minimal qui importe Health + Payment ----------
echo "==> Normalisation src/app.module.ts"
cat > src/app.module.ts <<'TS'
import { Module } from '@nestjs/common'
import { HealthModule } from './modules/health/health.module'
import { PaymentModule } from './modules/payment/payment.module'

@Module({
  imports: [HealthModule, PaymentModule],
})
export class AppModule {}
TS

# ---------- 5) Install deps + Prisma (sans lire d'autres .env) ----------
echo "==> Installation deps et Prisma generate"
cd "$HOME/delishafrica-monorepo"
pnpm -C services/api install

PRISMA_SKIP_ENV_LOAD=1 DATABASE_URL="$DB_URL" pnpm -C services/api exec prisma db push
PRISMA_SKIP_ENV_LOAD=1 DATABASE_URL="$DB_URL" pnpm -C services/api exec prisma generate

# ---------- 6) Démarrage PM2 propre ----------
echo "==> Démarrage PM2"
cd "$BASE"
pm2 start "bash -lc 'set -a; \
  [ -f ./.env.app ] && . ./.env.app; \
  [ -f ./prisma/.env ] && . ./prisma/.env; \
  set +a; \
  API_PREFIX=$API_PREFIX PORT=$PORT node -r ts-node/register/transpile-only -r tsconfig-paths/register src/main.ts'" \
  --name delish-api

sleep 1
pm2 logs delish-api --lines 20

echo
echo "==> Tests rapides:"
echo "Health:    curl -s http://localhost:${PORT}/${API_PREFIX}/health | jq ."
echo "Intent:    curl -s -X POST http://localhost:${PORT}/${API_PREFIX}/payments/intent -H 'Content-Type: application/json' -d '{\"orderId\":\"TEST\",\"amountCents\":1200,\"currency\":\"EUR\"}' | jq ."
echo
echo "==> Stripe CLI (Docker) :"
echo "Ecouter:   docker run -it --rm -v \$HOME/.config/stripe:/root/.config/stripe stripe/stripe-cli:latest listen --forward-to host.docker.internal:${PORT}/${API_PREFIX}/webhooks/stripe"
echo "Déclencher:docker run -it --rm -v \$HOME/.config/stripe:/root/.config/stripe stripe/stripe-cli:latest trigger payment_intent.succeeded"
