import { Module } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { StripeWebhookController } from "./stripe-webhook.controller";

@Module({ providers: [OrdersService], controllers: [StripeWebhookController], exports: [OrdersService] })
export class OrdersModule {}
