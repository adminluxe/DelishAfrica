import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DaAuthPrincipal } from '../auth/auth.types';
import {
  CanonicalOrderQuote,
  CatalogOrderPolicyService,
} from '../order-policy/catalog-order-policy.service';

type AnyRecord = Record<string, any>;

type CreatePaymentIntentInput = AnyRecord & {
  orderId?: string;
  id?: string;
  currency?: string;
  customerEmail?: string;
  clientMutationId?: string;
};

type PaymentAuthorityPrincipal = {
  issuer: string;
  subject: string;
  clientId: string;
};

type PaymentAuthorityRecord = {
  version: 1;
  paymentIntentId: string;
  orderId: string;
  clientMutationId: string;
  cartFingerprint: string;
  principal: PaymentAuthorityPrincipal;
  quote: CanonicalOrderQuote;
  lineSignature: string;
  createdAt: string;
  expiresAt: string;
  lastStripeStatus?: string;
  lastWebhookAt?: string;
  webhookEventIds?: string[];
};

type PaymentAuthorityStore = {
  version: 1;
  updatedAt: string;
  records: PaymentAuthorityRecord[];
};

type VerifiedPayment = {
  provider: 'stripe';
  mode: 'test' | 'live';
  status: 'paid';
  verified: true;
  verificationSource: 'stripe_api';
  paymentIntentId: string;
  chargeId: string;
  amount: number;
  amountCaptured: number;
  amountRefunded: number;
  currency: string;
  clientMutationId: string;
  cartFingerprint: string;
  quoteFingerprint: string;
  stripeStatus: string;
  chargeStatus: string;
  refunded: boolean;
  disputed: boolean;
  financialFinality: 'charge_captured_unrefunded_undisputed_v1';
  verifiedAt: string;
};

function envValue(name: string, fallback = ''): string {
  return String((process.env && process.env[name]) || fallback);
}

function nowIso(): string {
  return new Date().toISOString();
}

function sanitizeIdempotencyKey(value: unknown, orderId: string): string {
  const normalized = String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9:_\-.]/g, '_')
    .slice(0, 255);
  return normalized || `delishafrica:${orderId}`;
}

function safeMetadata(value: unknown, fallback = ''): string {
  return String(value ?? fallback).trim().slice(0, 500);
}

function orderIdFrom(input: AnyRecord = {}): string {
  return String(
    input.orderId ||
      input.id ||
      input.order_id ||
      input.publicId ||
      input.public_id ||
      '',
  ).trim();
}

function paymentInput(input: AnyRecord = {}): AnyRecord {
  return input.payment && typeof input.payment === 'object' ? input.payment : {};
}

function paymentIntentIdFrom(input: AnyRecord = {}): string {
  const payment = paymentInput(input);
  return String(
    payment.paymentIntentId ||
      payment.payment_intent_id ||
      input.paymentIntentId ||
      input.payment_intent_id ||
      '',
  ).trim();
}

function clientMutationIdFrom(input: AnyRecord = {}): string {
  const payment = paymentInput(input);
  return String(
    input.clientMutationId ||
      input.client_mutation_id ||
      payment.clientMutationId ||
      payment.client_mutation_id ||
      '',
  ).trim();
}

function cartFingerprintFrom(input: AnyRecord = {}): string {
  const payment = paymentInput(input);
  return String(
    input.cartFingerprint ||
      input.cart_fingerprint ||
      payment.cartFingerprint ||
      payment.cart_fingerprint ||
      '',
  ).trim();
}

function quoteLineSignature(quote: CanonicalOrderQuote): string {
  return quote.items
    .map((item) => `${item.id}:${item.quantity}:${item.unitAmount}`)
    .sort()
    .join('|');
}

function inputLineSignature(input: AnyRecord = {}): string {
  const items = Array.isArray(input.items) ? input.items : [];
  return items
    .map((item: AnyRecord) => {
      const id = String(item.id || item.sku || item.menuItemId || '').trim();
      const quantity = Math.max(1, Math.round(Number(item.quantity || 1)));
      return `${id}:${quantity}`;
    })
    .sort()
    .join('|');
}

function makeMockIntent(orderId: string, amount: number, currency: string) {
  const suffix = Date.now().toString(36);
  return {
    id: `pi_mock_${suffix}`,
    client_secret: `pi_mock_${suffix}_secret_mock`,
    status: 'requires_payment_method',
    amount,
    currency,
    metadata: { orderId },
  };
}

function authorityStoreFile(): string {
  const configured = envValue('DA_PAYMENT_AUTHORITY_STORE_FILE').trim();
  if (configured) return configured;
  return path.join(process.cwd(), '.runtime', 'payment-authority-store.json');
}

function emptyStore(): PaymentAuthorityStore {
  return { version: 1, updatedAt: nowIso(), records: [] };
}

function readAuthorityStore(): PaymentAuthorityStore {
  const file = authorityStoreFile();
  try {
    if (!fs.existsSync(file)) return emptyStore();
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as PaymentAuthorityStore;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.records)) return emptyStore();
    return parsed;
  } catch {
    return emptyStore();
  }
}

function writeAuthorityStore(store: PaymentAuthorityStore): void {
  const file = authorityStoreFile();
  const directory = path.dirname(file);
  fs.mkdirSync(directory, { recursive: true });
  const next: PaymentAuthorityStore = {
    version: 1,
    updatedAt: nowIso(),
    records: store.records
      .filter((record) => Date.parse(record.expiresAt) > Date.now() - 24 * 60 * 60 * 1000)
      .slice(0, 5000),
  };
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(next, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporary, file);
}

function principalBinding(principal: DaAuthPrincipal): PaymentAuthorityPrincipal {
  return {
    issuer: String(principal.issuer || ''),
    subject: String(principal.subject || ''),
    clientId: String(principal.clientId || principal.subject || ''),
  };
}

function principalMatches(record: PaymentAuthorityRecord, principal: DaAuthPrincipal): boolean {
  const expected = principalBinding(principal);
  return (
    record.principal.issuer === expected.issuer &&
    record.principal.subject === expected.subject &&
    record.principal.clientId === expected.clientId
  );
}

@Injectable()
export class PaymentsService {
  constructor(private readonly orderPolicy: CatalogOrderPolicyService) {}

  health() {
    return {
      ok: true,
      service: 'payments',
      stripeConfigured: this.hasStripeSecret(),
      publishableKeyConfigured: Boolean(this.publishableKey()),
      webhookConfigured: Boolean(this.webhookSecret()),
      webhookSignatureVerification: 'required',
      catalogAuthority: 'server_recalculated',
      orderCommitAuthority: 'stripe_retrieval',
      financialFinalityGuard: 'charge_captured_unrefunded_undisputed_v1',
      refundAwareOrderCommit: true,
      disputeAwareOrderCommit: true,
      paymentAuthorityStore: 'runtime_atomic_file_v1',
      mockOrderCommitAllowed: false,
    };
  }

  providers() {
    return {
      ok: true,
      providers: [
        {
          id: 'stripe',
          label: 'Stripe',
          provider: 'stripe',
          role: 'card_acquiring_bridge',
          status: this.hasStripeSecret() ? 'configured' : 'mock_ready',
          userVisible: true,
        },
      ],
    };
  }

  private stripeSecret(): string {
    return envValue('STRIPE_SECRET_KEY') || envValue('STRIPE_SECRET');
  }

  private webhookSecret(): string {
    return envValue('STRIPE_WEBHOOK_SECRET').trim();
  }

  private hasStripeSecret(): boolean {
    const secret = this.stripeSecret();
    return secret.startsWith('sk_test_') || secret.startsWith('sk_live_');
  }

  private publishableKey(): string {
    return envValue('STRIPE_PUBLISHABLE_KEY') || envValue('EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY');
  }

  private saveAuthorityRecord(record: PaymentAuthorityRecord): void {
    const store = readAuthorityStore();
    const remaining = store.records.filter(
      (candidate) => candidate.paymentIntentId !== record.paymentIntentId,
    );
    writeAuthorityStore({ ...store, records: [record, ...remaining] });
  }

  private authorityRecord(paymentIntentId: string): PaymentAuthorityRecord | null {
    const store = readAuthorityStore();
    return (
      store.records.find((record) => record.paymentIntentId === paymentIntentId) || null
    );
  }

  private assertRecordBinding(
    record: PaymentAuthorityRecord,
    principal: DaAuthPrincipal,
    input: AnyRecord,
  ): void {
    if (!principalMatches(record, principal)) {
      throw new ConflictException({
        ok: false,
        code: 'payment_principal_mismatch',
      });
    }

    const orderId = orderIdFrom(input);
    if (!orderId || record.orderId !== orderId) {
      throw new ConflictException({
        ok: false,
        code: 'payment_order_mismatch',
      });
    }

    const mutationId = clientMutationIdFrom(input);
    if (!mutationId || record.clientMutationId !== mutationId) {
      throw new ConflictException({
        ok: false,
        code: 'payment_mutation_mismatch',
      });
    }

    const signature = inputLineSignature(input);
    if (!signature || record.lineSignature.split('|').map((part) => part.split(':').slice(0, 2).join(':')).sort().join('|') !== signature) {
      throw new ConflictException({
        ok: false,
        code: 'payment_cart_mismatch',
      });
    }
  }

  authorizedQuoteForInput(
    principal: DaAuthPrincipal,
    input: AnyRecord = {},
  ): CanonicalOrderQuote | null {
    const paymentIntentId = paymentIntentIdFrom(input);
    if (!/^pi_[A-Za-z0-9_]+$/.test(paymentIntentId)) return null;
    const record = this.authorityRecord(paymentIntentId);
    if (!record) return null;
    this.assertRecordBinding(record, principal, input);
    return record.quote;
  }

  async createPaymentIntent(
    input: CreatePaymentIntentInput = {},
    idempotencyHeader: string | undefined,
    principal: DaAuthPrincipal,
  ) {
    const quote = await this.orderPolicy.quote(input);
    const amount = quote.total;
    const currency = quote.currency;
    const orderId = orderIdFrom(input) || `order_${Date.now().toString(36)}`;
    const clientMutationId = sanitizeIdempotencyKey(
      idempotencyHeader || input.clientMutationId,
      orderId,
    );
    const cartFingerprint = cartFingerprintFrom(input);
    const binding = principalBinding(principal);

    if (!this.hasStripeSecret()) {
      const mock = makeMockIntent(orderId, amount, currency);
      return {
        ok: true,
        mode: 'mock',
        provider: 'stripe',
        message: 'Stripe secret key not configured. Mock order commit remains disabled.',
        orderId,
        amount,
        currency,
        paymentIntentId: mock.id,
        clientSecret: mock.client_secret,
        status: mock.status,
        publishableKey: this.publishableKey(),
        idempotencyKey: clientMutationId,
        quote,
      };
    }

    const params = new URLSearchParams();
    params.set('amount', String(amount));
    params.set('currency', currency);
    params.set('automatic_payment_methods[enabled]', 'true');
    params.set('metadata[orderId]', safeMetadata(orderId));
    params.set('metadata[source]', 'delishafrica-api-nest');
    params.set('metadata[partnerSlug]', safeMetadata(quote.partnerSlug));
    params.set('metadata[quoteFingerprint]', safeMetadata(quote.quoteFingerprint));
    params.set('metadata[availabilityDate]', safeMetadata(quote.availabilityDate));
    params.set('metadata[clientMutationId]', safeMetadata(clientMutationId));
    params.set('metadata[cartFingerprint]', safeMetadata(cartFingerprint));
    params.set('metadata[clientIssuer]', safeMetadata(binding.issuer));
    params.set('metadata[clientSubject]', safeMetadata(binding.subject));
    params.set('metadata[clientId]', safeMetadata(binding.clientId));

    const customerEmail = String(input.customerEmail || input.metadata?.clientEmail || '').trim();
    if (customerEmail) params.set('receipt_email', customerEmail);

    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.stripeSecret()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': clientMutationId,
      },
      body: params.toString(),
    });

    const json = await this.readStripeResponse(response);
    if (!response.ok || !json?.id || !json?.client_secret) {
      throw new BadGatewayException({
        ok: false,
        code: 'stripe_payment_intent_failed',
        provider: 'stripe',
        status: response.status,
        error: json?.error?.message || `stripe_http_${response.status}`,
      });
    }

    const createdAt = nowIso();
    this.saveAuthorityRecord({
      version: 1,
      paymentIntentId: String(json.id),
      orderId,
      clientMutationId,
      cartFingerprint,
      principal: binding,
      quote,
      lineSignature: quoteLineSignature(quote),
      createdAt,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      lastStripeStatus: String(json.status || ''),
      webhookEventIds: [],
    });

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
      idempotencyKey: clientMutationId,
      quote,
    };
  }

  async verifyPaidOrder(
    principal: DaAuthPrincipal,
    input: AnyRecord,
    quote: CanonicalOrderQuote,
  ): Promise<VerifiedPayment> {
    if (!this.hasStripeSecret()) {
      throw new ServiceUnavailableException({
        ok: false,
        code: 'payment_authority_unavailable',
      });
    }

    const paymentIntentId = paymentIntentIdFrom(input);
    if (!/^pi_[A-Za-z0-9_]+$/.test(paymentIntentId)) {
      throw new BadRequestException({
        ok: false,
        code: 'payment_intent_required',
      });
    }

    const record = this.authorityRecord(paymentIntentId);
    if (record) {
      this.assertRecordBinding(record, principal, input);
      if (record.quote.quoteFingerprint !== quote.quoteFingerprint) {
        throw new ConflictException({
          ok: false,
          code: 'payment_quote_mismatch',
        });
      }
    }

    const retrieveUrl = new URL(
      `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`,
    );
    retrieveUrl.searchParams.append('expand[]', 'latest_charge');

    const response = await fetch(retrieveUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.stripeSecret()}` },
    });
    const json = await this.readStripeResponse(response);

    if (!response.ok || !json?.id) {
      throw new BadRequestException({
        ok: false,
        code: 'payment_intent_not_found',
        provider: 'stripe',
      });
    }

    const metadata = json.metadata && typeof json.metadata === 'object' ? json.metadata : {};
    const orderId = orderIdFrom(input);
    const mutationId = clientMutationIdFrom(input);
    const cartFingerprint = cartFingerprintFrom(input);
    const expectedPrincipal = principalBinding(principal);
    const amount = Math.round(Number(json.amount_received || json.amount || 0));
    const currency = String(json.currency || '').toLowerCase();
    const status = String(json.status || '').toLowerCase();
    const charge = json.latest_charge && typeof json.latest_charge === 'object'
      ? (json.latest_charge as AnyRecord)
      : null;
    const chargeId = String(charge?.id || '').trim();
    const chargeStatus = String(charge?.status || '').toLowerCase();
    const chargeCurrency = String(charge?.currency || '').toLowerCase();
    const chargeAmount = Math.round(Number(charge?.amount || 0));
    const amountCaptured = Math.round(Number(charge?.amount_captured || 0));
    const amountRefunded = Math.round(Number(charge?.amount_refunded || 0));
    const chargePaid = charge?.paid === true;
    const chargeCaptured = charge?.captured === true;
    const chargeRefunded = charge?.refunded === true || amountRefunded > 0;
    const chargeDisputed = charge?.disputed === true;

    const metadataChecks = [
      ['orderId', orderId],
      ['partnerSlug', quote.partnerSlug],
      ['quoteFingerprint', quote.quoteFingerprint],
      ['clientMutationId', mutationId],
      ['clientIssuer', expectedPrincipal.issuer],
      ['clientSubject', expectedPrincipal.subject],
      ['clientId', expectedPrincipal.clientId],
    ] as const;

    for (const [key, expected] of metadataChecks) {
      if (!expected || String(metadata[key] || '') !== String(expected)) {
        throw new ConflictException({
          ok: false,
          code: 'payment_metadata_mismatch',
          field: key,
        });
      }
    }

    if (cartFingerprint && String(metadata.cartFingerprint || '') !== cartFingerprint) {
      throw new ConflictException({
        ok: false,
        code: 'payment_cart_fingerprint_mismatch',
      });
    }

    if (amount !== quote.total || currency !== quote.currency) {
      throw new ConflictException({
        ok: false,
        code: 'payment_amount_mismatch',
        expectedAmount: quote.total,
        actualAmount: amount,
        expectedCurrency: quote.currency,
        actualCurrency: currency,
      });
    }

    if (status !== 'succeeded') {
      throw new HttpException(
        {
          ok: false,
          code: 'payment_not_succeeded',
          paymentIntentId,
          stripeStatus: status,
        },
        402,
      );
    }

    if (!charge || !/^ch_[A-Za-z0-9_]+$/.test(chargeId)) {
      throw new HttpException(
        {
          ok: false,
          code: 'payment_charge_required',
          paymentIntentId,
        },
        402,
      );
    }

    if (!chargePaid || chargeStatus !== 'succeeded') {
      throw new HttpException(
        {
          ok: false,
          code: 'payment_charge_not_paid',
          paymentIntentId,
          chargeId,
          chargeStatus,
        },
        402,
      );
    }

    if (
      !chargeCaptured ||
      chargeAmount !== quote.total ||
      amountCaptured !== quote.total ||
      chargeCurrency !== quote.currency
    ) {
      throw new HttpException(
        {
          ok: false,
          code: 'payment_not_fully_captured',
          paymentIntentId,
          chargeId,
          expectedAmount: quote.total,
          chargeAmount,
          amountCaptured,
          expectedCurrency: quote.currency,
          chargeCurrency,
        },
        402,
      );
    }

    if (chargeRefunded) {
      throw new HttpException(
        {
          ok: false,
          code: 'payment_refunded',
          paymentIntentId,
          chargeId,
          amountCaptured,
          amountRefunded,
        },
        402,
      );
    }

    if (chargeDisputed) {
      throw new HttpException(
        {
          ok: false,
          code: 'payment_disputed',
          paymentIntentId,
          chargeId,
        },
        402,
      );
    }

    if (record) {
      this.saveAuthorityRecord({
        ...record,
        lastStripeStatus: status,
      });
    }

    return {
      provider: 'stripe',
      mode: json.livemode ? 'live' : 'test',
      status: 'paid',
      verified: true,
      verificationSource: 'stripe_api',
      paymentIntentId,
      chargeId,
      amount,
      amountCaptured,
      amountRefunded,
      currency,
      clientMutationId: mutationId,
      cartFingerprint,
      quoteFingerprint: quote.quoteFingerprint,
      stripeStatus: status,
      chargeStatus,
      refunded: false,
      disputed: false,
      financialFinality: 'charge_captured_unrefunded_undisputed_v1',
      verifiedAt: nowIso(),
    };
  }

  handleStripeWebhook(
    rawBody: Buffer | undefined,
    parsedBody: AnyRecord = {},
    signatureHeader?: string,
  ) {
    const secret = this.webhookSecret();
    if (!secret) {
      throw new ServiceUnavailableException({
        ok: false,
        code: 'stripe_webhook_secret_not_configured',
      });
    }
    if (!rawBody || !Buffer.isBuffer(rawBody) || rawBody.length === 0) {
      throw new BadRequestException({
        ok: false,
        code: 'stripe_webhook_raw_body_required',
      });
    }
    if (!signatureHeader) {
      throw new BadRequestException({
        ok: false,
        code: 'stripe_webhook_signature_required',
      });
    }

    const parsed = this.parseStripeSignature(signatureHeader);
    const toleranceSeconds = Math.max(
      60,
      Math.round(Number(envValue('STRIPE_WEBHOOK_TOLERANCE_SECONDS', '300')) || 300),
    );
    const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - parsed.timestamp);
    if (ageSeconds > toleranceSeconds) {
      throw new BadRequestException({
        ok: false,
        code: 'stripe_webhook_timestamp_outside_tolerance',
      });
    }

    const expected = createHmac('sha256', secret)
      .update(`${parsed.timestamp}.${rawBody.toString('utf8')}`)
      .digest('hex');
    const verified = parsed.signatures.some((candidate) => this.safeEqual(candidate, expected));
    if (!verified) {
      throw new BadRequestException({
        ok: false,
        code: 'stripe_webhook_signature_invalid',
      });
    }

    let event: AnyRecord = parsedBody;
    try {
      event = JSON.parse(rawBody.toString('utf8')) as AnyRecord;
    } catch {
      throw new BadRequestException({ ok: false, code: 'stripe_webhook_json_invalid' });
    }

    const eventId = String(event.id || '').trim();
    const eventType = String(event.type || 'unknown');
    const object = event?.data?.object && typeof event.data.object === 'object'
      ? event.data.object
      : {};
    const paymentIntentId = String(object.id || '').trim();
    let duplicate = false;
    let authorityRecordFound = false;

    if (eventId && /^pi_[A-Za-z0-9_]+$/.test(paymentIntentId)) {
      const record = this.authorityRecord(paymentIntentId);
      if (record) {
        authorityRecordFound = true;
        const previousEvents = Array.isArray(record.webhookEventIds)
          ? record.webhookEventIds
          : [];
        duplicate = previousEvents.includes(eventId);
        if (!duplicate) {
          this.saveAuthorityRecord({
            ...record,
            lastStripeStatus: String(object.status || record.lastStripeStatus || ''),
            lastWebhookAt: nowIso(),
            webhookEventIds: [eventId, ...previousEvents].slice(0, 30),
          });
        }
      }
    }

    return {
      ok: true,
      verified: true,
      duplicate,
      eventId: eventId || null,
      eventType,
      paymentIntentId: paymentIntentId || null,
      authorityRecordFound,
      receivedAt: nowIso(),
    };
  }

  private async readStripeResponse(response: Response): Promise<AnyRecord> {
    const text = await response.text();
    try {
      return text ? (JSON.parse(text) as AnyRecord) : {};
    } catch {
      return { raw: text };
    }
  }

  private parseStripeSignature(value: string): {
    timestamp: number;
    signatures: string[];
  } {
    let timestamp = 0;
    const signatures: string[] = [];
    for (const part of String(value).split(',')) {
      const [key, raw] = part.trim().split('=', 2);
      if (key === 't') timestamp = Number(raw || 0);
      if (key === 'v1' && raw) signatures.push(raw);
    }
    if (!Number.isInteger(timestamp) || timestamp <= 0 || signatures.length === 0) {
      throw new BadRequestException({
        ok: false,
        code: 'stripe_webhook_signature_malformed',
      });
    }
    return { timestamp, signatures };
  }

  private safeEqual(candidate: string, expected: string): boolean {
    try {
      const left = Buffer.from(candidate, 'hex');
      const right = Buffer.from(expected, 'hex');
      return left.length === right.length && timingSafeEqual(left, right);
    } catch {
      return false;
    }
  }
}
