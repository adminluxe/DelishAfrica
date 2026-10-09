import { createHash } from 'node:crypto';
import {
  createGuestCheckoutCapability,
  guestCapabilityMatchesOrder,
  verifyGuestCheckoutCapability,
  type GuestCheckoutClaims,
  type NewGuestCheckout,
} from './guest-capability';

/**
 * Guest Checkout P2 — PostgreSQL persistence adapter. Internal service only.
 *
 * NOT connected to API controllers or Stripe until the P3 payment-outbox gate.
 * All identifiers are derived from a server-minted signed capability.
 * SQL is fixed/parameterized; no PII, token or payment client secret is stored.
 * The DB must have migration 20261009_guest_checkout_ledger.sql applied
 * in a dedicated reviewed environment before use.
 */

export type GuestSqlRow = Record<string, unknown>;
export type GuestSqlResult<T extends GuestSqlRow = GuestSqlRow> = {
  rows: T[];
  rowCount: number | null;
};
export type GuestSqlExecutor = {
  query<T extends GuestSqlRow = GuestSqlRow>(
    statement: string,
    values?: readonly unknown[],
  ): Promise<GuestSqlResult<T>>;
};

type LedgerState =
  | 'issued' | 'quoted' | 'payment_pending'
  | 'paid' | 'committed' | 'cancelled' | 'expired';

export type GuestLedgerEntry = {
  orderId: string;
  state: LedgerState;
  expiresAt: string;
  amountCents: number | null;
  currency: string | null;
  quoteFingerprint: string | null;
  paymentIntentId: string | null;
};

type LedgerRow = {
  order_id: string;
  guest_subject: string;
  mutation_id: string;
  state: LedgerState;
  expires_at: Date | string;
  quoted_amount_cents: number | string | null;
  quoted_currency: string | null;
  quote_fingerprint: string | null;
  payment_intent_id: string | null;
};

type TrustedQuote = Readonly<{
  /** Must be computed by CatalogOrderPolicyService — never from client input. */
  amountCents: number;
  currency: 'eur';
  fingerprint: string;
}>;

function sha256(data: string): Buffer {
  return createHash('sha256').update(data, 'utf8').digest();
}

function project(row: LedgerRow): GuestLedgerEntry {
  return {
    orderId: row.order_id,
    state: row.state,
    expiresAt: new Date(row.expires_at).toISOString(),
    amountCents: row.quoted_amount_cents == null
      ? null
      : Number(row.quoted_amount_cents),
    currency: row.quoted_currency?.trim() || null,
    quoteFingerprint: row.quote_fingerprint,
    paymentIntentId: row.payment_intent_id,
  };
}

const FIELDS = `
  order_id, guest_subject, mutation_id, state, expires_at,
  quoted_amount_cents, quoted_currency, quote_fingerprint, payment_intent_id
`;

export class GuestCheckoutLedger {
  constructor(
    private readonly db: GuestSqlExecutor,
    private readonly signingKey: Buffer,
    private readonly clock: () => number = Date.now,
  ) {
    if (!Buffer.isBuffer(signingKey) || signingKey.length < 32) {
      throw new Error('guest_checkout_strong_signing_key_required');
    }
  }

  private claims(token: string): GuestCheckoutClaims {
    const verified = verifyGuestCheckoutCapability(
      this.signingKey, token, this.clock(),
    );
    if (!verified) throw new Error('guest_checkout_unauthorized_or_expired');
    return verified;
  }

  /**
   * Issue a new capability and persist its hash BEFORE returning to the mobile.
   * A persistence failure must prevent the client from receiving any token.
   */
  async issue(): Promise<NewGuestCheckout> {
    const minted = createGuestCheckoutCapability(this.signingKey, this.clock());
    const claims = this.claims(minted.token);
    const result = await this.db.query<{ order_id: string }>(
      `INSERT INTO da_guest_checkout_sessions
          (order_id, guest_subject, mutation_id, capability_sha256, expires_at)
        VALUES ($1, $2, $3, $4::bytea, $5::timestamptz)
        ON CONFLICT DO NOTHING
        RETURNING order_id`,
      [
        claims.orderId,
        claims.subject,
        claims.mutationId,
        sha256(minted.token),
        minted.expiresAt,
      ],
    );

    if (result.rowCount !== 1 || result.rows[0]?.order_id !== minted.orderId) {
      throw new Error('guest_checkout_issue_conflict');
    }
    return minted;
  }

  /**
   * Prove possession of exactly one session. Never look up by plain orderId.
   * Does not authorize business actions by itself.
   */
  async findForCapability(token: string): Promise<GuestLedgerEntry | null> {
    const claims = this.claims(token);
    const result = await this.db.query<LedgerRow>(
      `SELECT ${FIELDS}
         FROM da_guest_checkout_sessions
        WHERE order_id = $1 AND capability_sha256 = $2::bytea
          AND expires_at > now()
        LIMIT 1`,
      [claims.orderId, sha256(token)],
    );
    const row = result.rows[0];
    if (
      !row ||
      row.guest_subject !== claims.subject ||
      row.mutation_id !== claims.mutationId ||
      !guestCapabilityMatchesOrder(claims, row.order_id, row.mutation_id)
    ) return null;
    return project(row);
  }

  /**
   * Atomic ISSUED -> QUOTED. Caller MUST use the trusted server catalog quote.
   * Conflict/expiry/incorrect capability: fail closed.
   * Identical retries are idempotent.
   */
  async attachVerifiedQuote(
    token: string,
    quote: TrustedQuote,
  ): Promise<GuestLedgerEntry> {
    const claims = this.claims(token);
    if (
      !Number.isSafeInteger(quote.amountCents) ||
      quote.amountCents < 1 || quote.amountCents > 100_000_000 ||
      quote.currency !== 'eur' ||
      !/^[A-Za-z0-9:_-]{8,192}$/.test(quote.fingerprint)
    ) throw new Error('guest_checkout_invalid_server_quote');

    const result = await this.db.query<LedgerRow>(
      `UPDATE da_guest_checkout_sessions
          SET state = 'quoted',
              quoted_amount_cents = $3,
              quoted_currency = $4,
              quote_fingerprint = $5,
              updated_at = now()
        WHERE order_id = $1 AND capability_sha256 = $2::bytea
          AND expires_at > now() AND state = 'issued'
        RETURNING ${FIELDS}`,
      [
        claims.orderId, sha256(token),
        quote.amountCents, quote.currency, quote.fingerprint,
      ],
    );
    if (result.rowCount === 1 && result.rows[0]) return project(result.rows[0]);
    const existing = await this.findForCapability(token);
    if (
      existing?.state === 'quoted' &&
      existing.amountCents === quote.amountCents &&
      existing.currency === quote.currency &&
      existing.quoteFingerprint === quote.fingerprint
    ) return existing;
    throw new Error('guest_checkout_quote_conflict_or_expired');
  }

  /**
   * Atomic QUOTED -> PAYMENT_PENDING, after trusted Stripe API creates the
   * intent with its own idempotency key. Not exposed via HTTP in P2.
   * A different Stripe intent can never be attached to an existing order.
   */
  async bindTrustedPaymentIntent(
    token: string,
    intentId: string,
  ): Promise<GuestLedgerEntry> {
    const claims = this.claims(token);
    if (!/^pi_[A-Za-z0-9_]{8,192}$/.test(intentId)) {
      throw new Error('guest_checkout_invalid_stripe_intent');
    }
    const result = await this.db.query<LedgerRow>(
      `UPDATE da_guest_checkout_sessions
          SET state = 'payment_pending',
              payment_intent_id = $3,
              updated_at = now()
        WHERE order_id = $1 AND capability_sha256 = $2::bytea
          AND expires_at > now() AND state = 'quoted'
        RETURNING ${FIELDS}`,
      [claims.orderId, sha256(token), intentId],
    );
    if (result.rowCount === 1 && result.rows[0]) return project(result.rows[0]);
    const existing = await this.findForCapability(token);
    if (
      existing?.state === 'payment_pending' &&
      existing.paymentIntentId === intentId
    ) return existing;
    throw new Error('guest_checkout_payment_intent_conflict_or_expired');
  }
}
