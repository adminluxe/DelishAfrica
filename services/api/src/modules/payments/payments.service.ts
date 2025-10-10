import { Injectable, NotFoundException } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY missing');
  return new Stripe(key, { apiVersion: '2024-06-20' as any });
}

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getByIntentId(intentId: string) {
    const anyPrisma: any = this.prisma as any;
    let order: any = null;
    try {
      order = await anyPrisma.order.findFirst({
        where: { paymentIntentId: intentId },
        select: { id: true, status: true, createdAt: true, updatedAt: true },
      });
      if (!order) {
        order = await anyPrisma.order.findFirst({
          where: { stripeIntentId: intentId },
          select: { id: true, status: true, createdAt: true, updatedAt: true },
        });
      }
    } catch {}
    if (!order) throw new NotFoundException('Order not found for intent');
    return { order };
  }

  async createIntent(data: { amount: number; currency: string; orderId: string }) {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: data.amount,
      currency: data.currency.toLowerCase(),
      metadata: { orderId: data.orderId },
      automatic_payment_methods: { enabled: true },
    });
    return { ok: true, intentId: intent.id, clientSecret: intent.client_secret };
  }
}
