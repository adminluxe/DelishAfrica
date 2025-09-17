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
