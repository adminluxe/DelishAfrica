import { Injectable } from '@nestjs/common';

type AnyRecord = Record<string, any>;

type CreatePaymentIntentInput = {
  orderId?: string;
  id?: string;
  amount?: number;
  amountCents?: number;
  total?: number;
  currency?: string;
  customerEmail?: string;
};

function envValue(name: string, fallback = ''): string {
  return String((process.env && process.env[name]) || fallback);
}

function asNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeAmountCents(input: CreatePaymentIntentInput): number {
  const cents = asNumber(input.amountCents);
  if (cents > 0) return Math.round(cents);

  const raw = asNumber(input.amount ?? input.total);
  if (raw > 0 && raw < 100) return Math.round(raw * 100);
  if (raw >= 100) return Math.round(raw);

  return 1290;
}

function safeCurrency(value: unknown): string {
  const c = String(value || 'eur').trim().toLowerCase();
  return /^[a-z]{3}$/.test(c) ? c : 'eur';
}

function makeMockIntent(orderId: string, amount: number, currency: string) {
  const suffix = Date.now().toString(36);
  return {
    id: 'pi_mock_' + suffix,
    client_secret: 'pi_mock_' + suffix + '_secret_mock',
    status: 'requires_payment_method',
    amount,
    currency,
    metadata: { orderId },
  };
}

@Injectable()
export class PaymentsService {
  health() {
    return {
      ok: true,
      service: 'payments',
      stripeConfigured: this.hasStripeSecret(),
      publishableKeyConfigured: Boolean(this.publishableKey()),
    };
  }

  providers() {
    return {
      ok: true,
      providers: [
        {
          id: 'stripe',
          label: 'Stripe',
          role: 'card_acquiring_bridge',
          status: this.hasStripeSecret() ? 'configured' : 'mock_ready',
          userVisible: true,
        },
      ],
    };
  }

  private hasStripeSecret(): boolean {
    const secret = envValue('STRIPE_SECRET_KEY');
    return secret.startsWith('sk_test_') || secret.startsWith('sk_live_');
  }

  private publishableKey(): string {
    return envValue('STRIPE_PUBLISHABLE_KEY') || envValue('EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY');
  }

  async createPaymentIntent(input: CreatePaymentIntentInput = {}) {
    const amount = normalizeAmountCents(input);
    const currency = safeCurrency(input.currency);
    const orderId = String(input.orderId || input.id || 'order_' + Date.now().toString(36));

    if (!this.hasStripeSecret()) {
      const mock = makeMockIntent(orderId, amount, currency);

      return {
        ok: true,
        mode: 'mock',
        provider: 'stripe',
        message: 'Stripe secret key not configured. Returning mock PaymentIntent for dev wiring.',
        orderId,
        amount,
        currency,
        paymentIntentId: mock.id,
        clientSecret: mock.client_secret,
        status: mock.status,
        publishableKey: this.publishableKey() || (process.env.STRIPE_PUBLISHABLE_KEY || ''),
      };
    }

    const secret = envValue('STRIPE_SECRET_KEY');
    const params = new URLSearchParams();

    params.set('amount', String(amount));
    params.set('currency', currency);
    params.set('automatic_payment_methods[enabled]', 'true');
    params.set('metadata[orderId]', orderId);
    params.set('metadata[source]', 'delishafrica-api-nest');

    if (input.customerEmail) {
      params.set('receipt_email', String(input.customerEmail));
    }

    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + secret,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const text = await response.text();
    let json: AnyRecord = {};

    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }

    if (!response.ok) {
      return {
        ok: false,
        mode: 'stripe',
        provider: 'stripe',
        error: (json.error && json.error.message) || 'stripe_http_' + response.status,
        stripeStatus: response.status,
        stripeResponse: json,
      };
    }

    return {
      ok: true,
      mode: 'stripe',
      provider: 'stripe',
      orderId,
      amount,
      currency,
      paymentIntentId: json.id,
      clientSecret: json.client_secret,
      status: json.status,
      publishableKey: this.publishableKey(),
    };
  }

  handleStripeWebhook(body: AnyRecord = {}, signature?: string) {
    const eventType = String(body && body.type ? body.type : 'unknown');

    return {
      ok: true,
      mode: envValue('STRIPE_WEBHOOK_SECRET') ? 'received_unverified_signature_present' : 'received_dev_no_webhook_secret',
      message: 'Webhook endpoint is reachable. Signature verification will be hardened later.',
      eventType,
      signaturePresent: Boolean(signature),
      receivedAt: new Date().toISOString(),
    };
  }
}
