import { Injectable, BadRequestException } from '@nestjs/common'
import Stripe from 'stripe'

@Injectable()
export class PaymentService {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  async handleWebhook(sig: string | undefined, raw: Buffer) {
    if (!sig) throw new BadRequestException('Missing Stripe signature')
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) throw new BadRequestException('Missing STRIPE_WEBHOOK_SECRET')

    let event: Stripe.Event
    try {
      event = this.stripe.webhooks.constructEvent(raw, sig, secret)
    } catch (err: any) {
      console.error('[Stripe] constructEvent FAILED:', err.message)
      throw new BadRequestException('Invalid signature')
    }

    // — logs utiles pour ton script —
    console.log('[Stripe] event:', event.type)

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent
      console.log('[Stripe] payment_intent.succeeded', pi.id)

      // TODO: relier à l’Order via metadata.orderId si tu le mets (recommandé)
      // ex:
      // const orderId = (pi.metadata && pi.metadata.orderId) || null
      // if (orderId) await this.prisma.order.update({ where: { id: orderId }, data: { status: 'PAID' } })
    }

    return { received: true }
  }

  async createIntent(orderId: string, amountCents: number, currency = 'EUR') {
    const intent = await this.stripe.paymentIntents.create({
      amount: amountCents,
      currency,
      // très utile pour retrouver l’Order au webhook :
      metadata: { orderId },
      automatic_payment_methods: { enabled: true },
    })
    return { clientSecret: intent.client_secret, intentId: intent.id }
  }
}
