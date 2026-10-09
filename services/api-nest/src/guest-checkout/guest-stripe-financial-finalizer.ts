import { createHmac, timingSafeEqual } from 'node:crypto';
import type { GuestSqlExecutor, GuestSqlResult } from './guest-checkout-ledger';

/**
 * P3 FINANCIAL FINALIZER — UNWIRED LABORATORY SERVICE.
 * A signed Stripe webhook is only a notification: real financial evidence is
 * retrieved again from Stripe API, independently of client/device/webhook data.
 * This code cannot be reached from any Nest controller yet.
 */
type DbClient = GuestSqlExecutor & { release(): void };
export type GuestTransactionalDb = { connect(): Promise<DbClient> };
type AnyObj = Record<string, any>;
export type PaymentSnapshot = {
  id: string;
  status: string;
  livemode: boolean;
  amount: number;
  amount_received: number;
  currency: string;
  metadata: Record<string, string>;
  latest_charge: {
    id: string;
    paid: boolean;
    captured: boolean;
    refunded: boolean;
    disputed: boolean;
    status: string;
    amount: number;
    amount_captured: number;
    amount_refunded: number;
    currency: string;
  };
};
export type StripeEvidenceReader = {
  fetchIntent(paymentIntentId: string): Promise<PaymentSnapshot>;
};
type StripeEvent = {
  eventId: string;
  intentId: string;
};
export type FinalizationResult = {
  ok: true;
  orderId: string;
  paymentIntentId: string;
  duplicate: boolean;
  financialState: 'confirmed_fulfillment_pending';
  fulfillmentReleased: false;
};
const PAYMENT_RE = /^pi_[A-Za-z0-9_]+$/;
const EVENT_RE = /^evt_[A-Za-z0-9_]+$/;
const SIGN_RE = /^[a-f0-9]{64}$/;

export function parseAndVerifyGuestStripeWebhook(
  rawBody: Buffer,
  signature: string,
  webhookSecret: string,
  nowMs = Date.now(),
): StripeEvent | null {
  if (!Buffer.isBuffer(rawBody) || !rawBody.length || rawBody.length > 256_000) {
    throw new Error('guest_stripe_invalid_raw_body');
  }
  if (typeof signature !== 'string' || signature.length > 2000 ||
      typeof webhookSecret !== 'string' || webhookSecret.length < 12) {
    throw new Error('guest_stripe_invalid_signature_config');
  }
  const parts = new Map<string, string[]>();
  for (const part of signature.split(',')) {
    const idx = part.indexOf('=');
    if (idx < 1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!parts.has(k)) parts.set(k, []);
    parts.get(k)!.push(v);
  }
  const timestamp = Number((parts.get('t') || [])[0]);
  if (!Number.isSafeInteger(timestamp) || timestamp < 1 ||
      Math.abs(Math.floor(nowMs / 1000) - timestamp) > 300) {
    throw new Error('guest_stripe_signature_stale');
  }
  const signed = createHmac('sha256', webhookSecret)
    .update(String(timestamp) + '.')
    .update(rawBody)
    .digest();
  const valid = (parts.get('v1') || []).some((value) => {
    if (!SIGN_RE.test(value)) return false;
    const candidate = Buffer.from(value, 'hex');
    return candidate.length === signed.length && timingSafeEqual(candidate, signed);
  });
  if (!valid) throw new Error('guest_stripe_invalid_signature');
  let event: AnyObj;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw new Error('guest_stripe_invalid_json');
  }
  if (!event || typeof event !== 'object' || !EVENT_RE.test(String(event.id || ''))) {
    throw new Error('guest_stripe_invalid_event');
  }
  if (event.type !== 'payment_intent.succeeded') return null;
  const intentId = String(event?.data?.object?.id || '');
  if (!PAYMENT_RE.test(intentId)) throw new Error('guest_stripe_invalid_intent');
  return { eventId: event.id, intentId };
}

function verifyStripeSnapshot(
  snapshot: PaymentSnapshot,
  expectedIntentId: string,
  row: AnyObj,
  expectedLiveMode: boolean,
): string {
  const amount = Number(row.quoted_amount_cents);
  const currency = String(row.quoted_currency || '').trim().toLowerCase();
  const c = snapshot?.latest_charge;
  const metadata = snapshot?.metadata || {};
  const validMetadata = (
    metadata.orderId === row.order_id &&
    metadata.clientMutationId === row.mutation_id &&
    metadata.quoteFingerprint === row.quote_fingerprint &&
    metadata.clientSubject === row.guest_subject &&
    metadata.clientIssuer === 'urn:delishafrica:guest-checkout:v1' &&
    metadata.source === 'delishafrica-guest-checkout'
  );
  const validMoney = (
    Number.isSafeInteger(amount) && amount > 0 &&
    snapshot?.id === expectedIntentId &&
    snapshot.status === 'succeeded' &&
    snapshot.livemode === expectedLiveMode &&
    Number.isSafeInteger(snapshot.amount) &&
    snapshot.amount === amount &&
    snapshot.amount_received === amount &&
    snapshot.currency === currency &&
    c?.status === 'succeeded' &&
    c.paid === true && c.captured === true &&
    c.refunded === false && c.disputed === false &&
    c.amount === amount && c.amount_captured === amount &&
    c.amount_refunded === 0 && c.currency === currency &&
    /^ch_[A-Za-z0-9_]+$/.test(String(c.id || ''))
  );
  if (!validMetadata || !validMoney) {
    throw new Error('guest_stripe_authority_or_finality_mismatch');
  }
  return c.id;
}

/**
 * Verification and transactional commit are deliberately separate from the
 * user's phone; the service can be driven by verified webhook or server cron.
 */
export class GuestStripeFinancialFinalizer {
  constructor(
    private readonly db: GuestTransactionalDb,
    private readonly evidence: StripeEvidenceReader,
    private readonly webhookSecret: string,
    private readonly expectedLiveMode: boolean,
    private readonly clock: () => number = Date.now,
  ) {}

  async consumeSignedWebhook(rawBody: Buffer, signature: string) {
    const parsed = parseAndVerifyGuestStripeWebhook(
      rawBody, signature, this.webhookSecret, this.clock(),
    );
    if (!parsed) return { ok: true, ignored: true as const };
    return this.reconcileTrustedStripeIntent(parsed.intentId, parsed.eventId);
  }

  /**
   * Internal-only reconciler for webhook retry/loss (not callable via HTTP).
   * Caller must feed a payment intent ID already in the trusted guest ledger.
   */
  async reconcileTrustedStripeIntent(intentId: string, eventId = 'reconcile') :
    Promise<FinalizationResult> {
    if (!PAYMENT_RE.test(intentId)) throw new Error('guest_stripe_invalid_intent');
    // No Stripe request takes place under a DB lock.
    const evidence = await this.evidence.fetchIntent(intentId);
    const client = await this.db.connect();
    let inTransaction = false;
    try {
      await client.query('BEGIN');
      inTransaction = true;
      const lookup = await client.query<AnyObj>(
        `SELECT order_id, guest_subject, mutation_id, state,
                quoted_amount_cents, quoted_currency, quote_fingerprint,
                payment_intent_id
           FROM da_guest_checkout_sessions
          WHERE payment_intent_id = $1
          FOR UPDATE`,
        [intentId],
      );
      if (lookup.rowCount !== 1 || !lookup.rows[0]) {
        throw new Error('guest_payment_not_bound_to_ledger');
      }
      const session = lookup.rows[0];
      if (session.state !== 'payment_pending' && session.state !== 'committed') {
        throw new Error('guest_checkout_invalid_financial_state');
      }
      const chargeId = verifyStripeSnapshot(
        evidence, intentId, session, this.expectedLiveMode,
      );
      let duplicate = session.state === 'committed';
      if (duplicate) {
        const prior = await client.query<AnyObj>(
          `SELECT payment_intent_id, stripe_charge_id
             FROM da_guest_verified_payments WHERE order_id = $1`,
          [session.order_id],
        );
        if (prior.rowCount !== 1 ||
            prior.rows[0].payment_intent_id !== intentId ||
            prior.rows[0].stripe_charge_id !== chargeId) {
          throw new Error('guest_payment_committed_record_missing');
        }
      } else {
        const insert = await client.query<{ order_id: string }>(
          `INSERT INTO da_guest_verified_payments
             (order_id, payment_intent_id, captured_amount_cents,
              currency, quote_fingerprint, stripe_charge_id)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT DO NOTHING RETURNING order_id`,
          [
            session.order_id, intentId,
            Number(session.quoted_amount_cents),
            String(session.quoted_currency).trim().toLowerCase(),
            session.quote_fingerprint, chargeId,
          ],
        );
        if (insert.rowCount !== 1) throw new Error('guest_payment_already_recorded');
        const outbox = await client.query<{ order_id: string }>(
          `INSERT INTO da_guest_financial_outbox (order_id,last_stripe_event_id)
           VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING order_id`,
          [session.order_id, eventId],
        );
        if (outbox.rowCount !== 1) throw new Error('guest_outbox_conflict');
        const marked = await client.query<{ order_id: string }>(
          `UPDATE da_guest_checkout_sessions
              SET state = 'committed', paid_at=now(), committed_at=now(),
                  updated_at=now()
            WHERE order_id=$1 AND state='payment_pending'
            RETURNING order_id`,
          [session.order_id],
        );
        if (marked.rowCount !== 1) throw new Error('guest_payment_transition_conflict');
      }
      await client.query('COMMIT');
      inTransaction = false;
      return {
        ok: true, orderId: String(session.order_id),
        paymentIntentId: intentId, duplicate,
        financialState: 'confirmed_fulfillment_pending',
        fulfillmentReleased: false,
      };
    } catch (error) {
      if (inTransaction) await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

/** Real Stripe reader (laboratory only; not wired to HTTP routes). */
export class GuestStripeHttpReader implements StripeEvidenceReader {
  constructor(private readonly secret: string, private readonly timeoutMs = 8000) {
    if (!/^sk_(test|live)_[A-Za-z0-9]+$/.test(secret)) {
      throw new Error('guest_stripe_secret_invalid');
    }
  }

  async fetchIntent(paymentIntentId: string): Promise<PaymentSnapshot> {
    if (!PAYMENT_RE.test(paymentIntentId)) throw new Error('guest_stripe_invalid_intent');
    const url = new URL('https://api.stripe.com/v1/payment_intents/' + paymentIntentId);
    url.searchParams.append('expand[]', 'latest_charge');
    const response = await fetch(url, {
      headers: { Authorization: 'Bearer ' + this.secret },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) throw new Error('guest_stripe_retrieve_failed');
    return await response.json() as PaymentSnapshot;
  }
}
