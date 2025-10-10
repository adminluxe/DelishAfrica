import { Controller, Headers, HttpCode, Logger, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import Stripe from 'stripe';

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: '2024-06-20' as any });
}

@Controller('webhooks/stripe')
export class PaymentsWebhookController {
  private readonly logger = new Logger(PaymentsWebhookController.name);

  @Post()
  @HttpCode(200)
  async handle(@Req() req: Request, @Headers('stripe-signature') signature?: string) {
    const stripe = getStripe();
    let event: Stripe.Event | any = null;

    try {
      if (stripe && signature && process.env.STRIPE_SIGNING_SECRET) {
        // Vérification officielle (requiert bodyParser.raw)
        const raw = (req as any).body as Buffer;
        event = stripe.webhooks.constructEvent(raw, signature, process.env.STRIPE_SIGNING_SECRET);
      } else {
        // Fallback dev: si raw Buffer (car raw parser), on JSON.parse
        const raw = (req as any).body;
        if (Buffer.isBuffer(raw)) {
          event = JSON.parse(raw.toString('utf8'));
        } else {
          event = raw ?? {};
        }
      }
    } catch (e: any) {
      this.logger.error({ msg: 'stripe.webhook.signature_or_parse_failed', err: e?.message } as any);
      return { ok: false, error: 'invalid_signature_or_json' };
    }

    const type = event?.type || 'unknown';
    const obj = event?.data?.object || {};
    const intentId = obj?.id || obj?.payment_intent || event?.intentId;
    const orderId = obj?.metadata?.orderId;

    this.logger.log({
      msg: 'stripe.webhook.received',
      type, intentId, orderId,
      status: obj?.status,
      amount: obj?.amount || obj?.amount_received,
    } as any);

    try {
      // TODO: mapping métier
      this.logger.log({ msg: 'stripe.webhook.processed', type, intentId, orderId } as any);
      return { ok: true };
    } catch (e: any) {
      this.logger.error({ msg: 'stripe.webhook.failed', err: e?.message, type, intentId, orderId } as any);
      try {
        const url = process.env.ALERTS_WEBHOOK_URL;
        if (url) {
          await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              text: `⚠️ Webhook Stripe KO\nintentId=${intentId}\norderId=${orderId}\ntype=${type}\nerror=${e?.message}`,
            }),
          });
        }
      } catch {}
      return { ok: false };
    }
  }
}
