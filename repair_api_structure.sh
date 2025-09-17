#!/usr/bin/env bash
set -euo pipefail

echo "▶️ Repairing API structure…"

# 0) Sécu: retirer 'type: module' si présent et revenir au dev script ts-node
if grep -q '"type": "module"' services/api/package.json; then
  sed -i.bak '/"type": "module"/d' services/api/package.json
fi
sed -i.bak 's|"dev": "node --loader ts-node/esm --no-warnings src/main.ts"|"dev": "ts-node --transpile-only src/main.ts"|' services/api/package.json || true

# 1) TS config CJS + décorateurs
cat > services/api/tsconfig.json <<'JSON'
{
  "extends": "../../packages/config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "strict": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src", "prisma"]
}
JSON

# 2) Arborescence et fichiers NestJS manquants
mkdir -p services/api/src/modules/health
mkdir -p services/api/src/modules/merchant
mkdir -p services/api/src/modules/orders
mkdir -p services/api/src/realtime

# main.ts (écrase avec version sûre)
cat > services/api/src/main.ts <<'TS'
import "reflect-metadata";
import * as dotenv from "dotenv";
dotenv.config();
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import * as cookieParser from "cookie-parser";
import * as express from "express";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.use(cookieParser());
  app.setGlobalPrefix("api");
  // Stripe webhook: raw body
  app.use("/webhooks/stripe", (express as any).raw({ type: "application/json" }));
  const port = process.env.PORT || 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`);
}
bootstrap();
TS

# app.module.ts
cat > services/api/src/app.module.ts <<'TS'
import { Module } from "@nestjs/common";
import { HealthModule } from "./modules/health/health.module";
import { MerchantModule } from "./modules/merchant/merchant.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { DispatchGateway } from "./realtime/dispatch.gateway";

@Module({
  imports: [HealthModule, MerchantModule, OrdersModule],
  providers: [DispatchGateway]
})
export class AppModule {}
TS

# Health
cat > services/api/src/modules/health/health.controller.ts <<'TS'
import { Controller, Get } from "@nestjs/common";
@Controller("health")
export class HealthController {
  @Get() get() {
    return { ok: true, ts: new Date().toISOString() };
  }
}
TS

cat > services/api/src/modules/health/health.module.ts <<'TS'
import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
@Module({ controllers: [HealthController] })
export class HealthModule {}
TS

# Merchant
cat > services/api/src/modules/merchant/merchant.service.ts <<'TS'
import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaClient, Prisma } from "@prisma/client";
const prisma = new PrismaClient();

@Injectable()
export class MerchantService {
  /** Upsert de lignes CSV vers MenuItem. Colonnes attendues:
   * merchant_id, name, price, category, description?, spicy_level?, imageUrl?, available?
   */
  async createMenuItemsFromCSV(rows: Record<string, string>[]) {
    const items: any[] = [];
    for (const [i, raw] of rows.entries()) {
      const R = (k: string) => (raw[k] ?? raw[k.toLowerCase()] ?? raw[k.toUpperCase()]);
      const merchantId = R("merchant_id");
      const name = R("name");
      const price = Number(String(R("price") ?? "0").replace(",", "."));
      const category = R("category") ?? "Divers";
      if (!merchantId || !name || !price) {
        throw new BadRequestException(`Ligne ${i + 1}: merchant_id, name et price sont requis`);
      }
      const spicyLevel = Number(R("spicy_level") ?? 0);
      const available = String(R("available") ?? "true").toLowerCase() !== "false";
      const description = R("description") ?? null;
      const imageUrl = R("imageUrl") ?? null;

      const id = `${merchantId}-${name}`.toLowerCase().replace(/\s+/g, "_");
      const upsert: Prisma.MenuItemUpsertArgs = {
        where: { id },
        update: { description, price, category, spicyLevel, imageUrl, available },
        create: { id, merchantId, name, description, price, category, spicyLevel, imageUrl, available }
      } as any;

      const item = await prisma.menuItem.upsert(upsert);
      items.push(item);
    }
    return items;
  }
}
TS

cat > services/api/src/modules/merchant/merchant.import.controller.ts <<'TS'
import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { MerchantService } from "./merchant.service";
import * as csv from "csv-parser";
import { Readable } from "stream";

@Controller("merchants")
export class MerchantImportController {
  constructor(private readonly merchantService: MerchantService) {}

  @Post("import-menu")
  @UseInterceptors(FileInterceptor("file"))
  async importMenu(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("Aucun fichier reçu");
    const rows: Record<string, string>[] = [];
    const stream = Readable.from(file.buffer);
    await new Promise<void>((resolve, reject) => {
      stream
        .pipe(csv({ separator: ",", mapHeaders: ({ header }) => String(header).trim() }))
        .on("data", (d) => rows.push(d))
        .on("error", reject)
        .on("end", () => resolve());
    });
    const items = await this.merchantService.createMenuItemsFromCSV(rows);
    return { count: items.length, items };
  }
}
TS

cat > services/api/src/modules/merchant/merchant.module.ts <<'TS'
import { Module } from "@nestjs/common";
import { MerchantService } from "./merchant.service";
import { MerchantImportController } from "./merchant.import.controller";
@Module({ providers: [MerchantService], controllers: [MerchantImportController], exports: [MerchantService] })
export class MerchantModule {}
TS

# Orders
cat > services/api/src/modules/orders/orders.service.ts <<'TS'
import { Injectable } from "@nestjs/common";
import { PrismaClient, OrderStatus } from "@prisma/client";
import Stripe from "stripe";
const prisma = new PrismaClient();

@Injectable()
export class OrdersService {
  async handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
    const intentId = pi.id;
    const amount = (pi.amount_received ?? pi.amount ?? 0) / 100;
    const currency = (pi.currency ?? "eur").toUpperCase();
    const merchantId = (pi.metadata?.merchantId as string) || "UNKNOWN_MERCHANT";
    const customerEmail = (pi.receipt_email as string) || (pi.metadata?.customerEmail as string) || "unknown@example.com";

    const existing = await prisma.order.findFirst({ where: { stripePaymentIntentId: intentId } });
    if (existing) {
      return prisma.order.update({
        where: { id: existing.id },
        data: { status: OrderStatus.PAID, amount, currency }
      });
    }
    return prisma.order.create({
      data: { merchantId, customerEmail, amount, currency, status: OrderStatus.PAID, stripePaymentIntentId: intentId }
    });
  }

  async handlePaymentIntentFailed(pi: Stripe.PaymentIntent) {
    const intentId = pi.id;
    const existing = await prisma.order.findFirst({ where: { stripePaymentIntentId: intentId } });
    if (existing) {
      return prisma.order.update({ where: { id: existing.id }, data: { status: OrderStatus.FAILED } });
    }
    return prisma.order.create({
      data: {
        merchantId: (pi.metadata?.merchantId as string) || "UNKNOWN_MERCHANT",
        customerEmail: (pi.receipt_email as string) || "unknown@example.com",
        amount: (pi.amount ?? 0) / 100,
        currency: (pi.currency ?? "eur").toUpperCase(),
        status: OrderStatus.FAILED,
        stripePaymentIntentId: intentId
      }
    });
  }
}
TS

cat > services/api/src/modules/orders/stripe-webhook.controller.ts <<'TS'
import { Controller, Post, Req, Headers, BadRequestException, HttpCode } from "@nestjs/common";
import Stripe from "stripe";
import { OrdersService } from "./orders.service";

@Controller("webhooks")
export class StripeWebhookController {
  private readonly stripe: Stripe;
  constructor(private readonly orders: OrdersService) {
    const secretKey = process.env.STRIPE_SECRET_KEY!;
    this.stripe = new Stripe(secretKey, { apiVersion: "2023-08-16" });
  }

  @Post("stripe")
  @HttpCode(200)
  async handleStripe(@Req() req: any, @Headers("stripe-signature") signature: string) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(req.rawBody, signature, webhookSecret);
    } catch (err: any) {
      throw new BadRequestException(`Signature invalide: ${err.message}`);
    }
    switch (event.type) {
      case "payment_intent.succeeded":
        await this.orders.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case "payment_intent.payment_failed":
        await this.orders.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      default:
        // ignore
        break;
    }
    return { received: true };
  }
}
TS

cat > services/api/src/modules/orders/orders.module.ts <<'TS'
import { Module } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { StripeWebhookController } from "./stripe-webhook.controller";

@Module({ providers: [OrdersService], controllers: [StripeWebhookController], exports: [OrdersService] })
export class OrdersModule {}
TS

# Realtime gateway
cat > services/api/src/realtime/dispatch.gateway.ts <<'TS'
import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

@WebSocketGateway({ namespace: "/dispatch", cors: { origin: "*" } })
export class DispatchGateway {
  @WebSocketServer() server: Server;

  @SubscribeMessage("join")
  handleJoin(@MessageBody() data: { orderId: string }, @ConnectedSocket() client: Socket) {
    if (data?.orderId) client.join(data.orderId);
  }

  @SubscribeMessage("courierLocation")
  courierLocation(@MessageBody() data: { orderId: string; lat: number; lng: number }) {
    if (data?.orderId) this.server.to(data.orderId).emit("courierLocationUpdate", data);
  }

  @SubscribeMessage("chat")
  chat(@MessageBody() m: { orderId: string; sender: "customer"|"merchant"|"courier"; text: string }) {
    if (m?.orderId) this.server.to(m.orderId).emit("chatMessage", m);
  }
}
TS

# 3) Types cookie-parser (silence l'erreur TS)
pnpm -w add -D @types/cookie-parser

# 4) Prisma client
pushd services/api >/dev/null
npx prisma generate
popd >/dev/null

echo "✅ API files repaired. Next steps:"
echo "1) Assure-toi que services/api/.env a bien DATABASE_URL=...5433/delishafrica"
echo "2) (Si pas déjà fait) npx prisma migrate dev --name init   # depuis services/api"
echo "3) pnpm --filter @delish/api dev   # API http://localhost:4000/api/health"
