/**
 * Stripe TEST webhook inbox — DISCONNECTED QA CANDIDATE ONLY.
 *
 * NOT wired to AppModule, PaymentsModule, StripeWebhookController or any
 * production route. Never expose the SQL function directly to request input.
 * This module verifies Stripe's HMAC on RAW request bytes BEFORE calling the
 * single DB inbox reservation port under a separate no-DML PostgreSQL role.
 *
 * Recording an authentic event is NOT a proof of payment capture, settlement
 * or financial finality, and NEVER writes "paid" or "provider_verified".
 * The eventual PSP verifier needs independent Stripe API retrieval, restricted
 * DB privileges and recovery/reconciliation, audited separately.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { QaPgPool } from './client-commerce.pg-qa.adapter';

export type QaVerifiedStripeTestWebhookReceipt = Readonly<{
  eventId: string;
  authorityId: string;
  duplicate: boolean;
}>;
type JsonObject = Record<string, unknown>;
const ALLOWED_EVENTS = new Set([
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
]);

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject : null;
}
function signedTimestampAndSignatures(value: string): {
  timestamp: number;
  signatures: string[];
} {
  if (typeof value !== 'string' || value.length > 4096) {
    throw Error('qa_stripe_signature_header_invalid');
  }
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of value.split(',')) {
    const chunk = part.trim();
    const delimiter = chunk.indexOf('=');
    if (delimiter <= 0) continue;
    const name = chunk.slice(0, delimiter);
    const field = chunk.slice(delimiter + 1);
    if (name === 't') {
      if (timestamp !== null || !/^[0-9]{10,12}$/.test(field)) {
        throw Error('qa_stripe_timestamp_invalid');
      }
      timestamp = Number(field);
    } else if (name === 'v1') {
      if (!/^[0-9a-f]{64}$/.test(field) || signatures.length >= 8) {
        throw Error('qa_stripe_signature_invalid');
      }
      signatures.push(field);
    }
  }
  if (timestamp === null || !Number.isSafeInteger(timestamp) ||
      signatures.length === 0) {
    throw Error('qa_stripe_signature_header_invalid');
  }
  return { timestamp, signatures };
}

export class QaStripeTestWebhookInboxAdapter {
  constructor(
    private readonly pool: QaPgPool,
    private readonly stripeTestWebhookSecret: string,
    private readonly nowSeconds: () => number = () => Math.floor(Date.now() / 1000),
  ) {
    if (!pool || typeof pool.query !== 'function' ||
        typeof stripeTestWebhookSecret !== 'string' ||
        !/^whsec_[A-Za-z0-9_-]{32,200}$/.test(stripeTestWebhookSecret) ||
        typeof nowSeconds !== 'function') {
      throw Error('qa_stripe_inbox_server_configuration_invalid');
    }
  }

  /**
   * The ONLY public entry point. Do not expose an "alreadyVerified" bool,
   * claims object or stored HMAC as an authorization bypass.
   */
  async receiveSignedTestWebhook(
    rawBody: Buffer,
    stripeSignatureHeader: string,
  ): Promise<QaVerifiedStripeTestWebhookReceipt> {
    if (!Buffer.isBuffer(rawBody) ||
        rawBody.length === 0 || rawBody.length > 256 * 1024) {
      throw Error('qa_stripe_webhook_raw_body_required');
    }
    const {timestamp, signatures} =
      signedTimestampAndSignatures(stripeSignatureHeader);
    const now = this.nowSeconds();
    if (!Number.isSafeInteger(now) || now <= 0 ||
        timestamp > now + 300 || now - timestamp > 300) {
      throw Error('qa_stripe_webhook_signature_expired');
    }
    const expected = createHmac('sha256', this.stripeTestWebhookSecret)
      .update(String(timestamp)).update('.').update(rawBody).digest();
    const isAuthentic = signatures.some((candidate) =>
      timingSafeEqual(Buffer.from(candidate, 'hex'), expected));
    if (!isAuthentic) {
      throw Error('qa_stripe_webhook_signature_mismatch');
    }

    let event: JsonObject | null;
    try {
      event = object(JSON.parse(rawBody.toString('utf8')));
    } catch {
      throw Error('qa_stripe_webhook_invalid_json');
    }
    const data = object(event?.data);
    const intent = object(data?.object);
    const eventId = event?.id;
    const eventType = event?.type;
    const intentId = intent?.id;
    if (!event ||
        event.object !== 'event' ||
        typeof eventId !== 'string' ||
        !/^evt_[A-Za-z0-9_]{6,120}$/.test(eventId) ||
        typeof eventType !== 'string' ||
        !ALLOWED_EVENTS.has(eventType) ||
        event.livemode !== false ||
        !intent || intent.object !== 'payment_intent' ||
        intent.livemode !== false ||
        typeof intentId !== 'string' ||
        !/^pi_[A-Za-z0-9_]{6,120}$/.test(intentId)) {
      throw Error('qa_stripe_test_event_or_intent_invalid');
    }

    const digest = createHash('sha256').update(rawBody).digest('hex');
    const result = await this.pool.query(
      'SELECT event_id,associated_authority_id,duplicate ' +
      'FROM public.da_qa_record_signed_test_webhook(' +
      '$1::text,$2::text,$3::text,$4::char(64),$5::boolean)',
      [eventId, eventType, intentId, digest, false],
    );
    if (result.rows.length !== 1 ||
        result.rows[0].event_id !== eventId ||
        typeof result.rows[0].duplicate !== 'boolean' ||
        !/^[0-9a-f-]{36}$/i.test(
          String(result.rows[0].associated_authority_id || ''))) {
      throw Error('qa_stripe_inbox_storage_inconsistent');
    }
    return Object.freeze({
      eventId,
      authorityId: String(result.rows[0].associated_authority_id),
      duplicate: result.rows[0].duplicate as boolean,
    });
  }
}
