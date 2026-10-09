import { createHash, randomBytes } from 'node:crypto';
import { verifyGuestCheckoutCapability } from './guest-capability';
import type { GuestSqlExecutor } from './guest-checkout-ledger';
import type { GuestTransactionalDb } from './guest-stripe-financial-finalizer';
import type { GuestPrivateFulfillmentVault } from './guest-private-fulfillment-vault';
import { GuestMerchantCoverageStrict } from './guest-merchant-coverage-strict';

/**
 * P5-C — TEST-ONLY internal creation of one Stripe PaymentIntent per guest.
 *
 * NEVER connected to public Nest routes or production Stripe credentials.
 * No customer PII/card info sent. Merchant/Courier/Ops guards stay unchanged.
 *
 * Idempotency is reserved in Postgres before calling the payment provider.
 * If the API crashes after Stripe creates an Intent, a retry reuses exactly
 * the SAME key and exact parameters. Never generate a second key for an order.
 */

export type GuestIntentParams = Readonly<{
  orderId: string;
  amount: number;
  currency: 'eur';
  metadata: Readonly<Record<string, string>>;
  idempotencyKey: string;
}>;

export type GuestTransportIntent = {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
  livemode: boolean;
  metadata: Record<string, string>;
};

export type GuestIntentTransport = {
  /** Must be a test-mode provider. No live key may be used by this stage. */
  mode: 'test';
  createIntent(params: GuestIntentParams): Promise<GuestTransportIntent>;
  getIntent(intentId: string): Promise<GuestTransportIntent>;
};

export type GuestIntentStart =
  | { state: 'in_progress'; retryAfterSeconds: 2; orderId: string }
  | {
      state: 'created' | 'restored';
      orderId: string;
      intentId: string;
      clientSecret: string;
      amount: number;
      currency: 'eur';
      idempotencyKey: string;
    };

type LedgerRow = {
  order_id: string;
  guest_subject: string;
  mutation_id: string;
  state: string;
  quoted_amount_cents: number | string;
  quoted_currency: string;
  quote_fingerprint: string;
  payment_intent_id: string | null;
};

type AttemptRow = {
  order_id: string;
  state: 'creating' | 'bound';
  request_hash: string;
  idempotency_key: string;
  lease_owner: string | null;
  lease_until: Date | string | null;
  stripe_intent_id: string | null;
  attempt_count: number;
};

const VALID_INTENT = /^pi_[A-Za-z0-9_]{8,192}$/;
const QUOTE_HASH = /^[a-f0-9]{64}$/;

function hash(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

function requestDigest(params: GuestIntentParams): string {
  return createHash('sha256').update(JSON.stringify({
    orderId: params.orderId,
    amount: params.amount,
    currency: params.currency,
    metadata: params.metadata,
    idempotencyKey: params.idempotencyKey,
  })).digest('hex');
}

export class GuestStripeIntentReservation {
  constructor(
    private readonly db: GuestSqlExecutor & GuestTransactionalDb,
    private readonly transport: GuestIntentTransport,
    private readonly signingKey: Buffer,
    private readonly vault: GuestPrivateFulfillmentVault,
    private readonly coverage: GuestMerchantCoverageStrict,
    private readonly clock: () => number = Date.now,
  ) {
    if (transport.mode !== 'test' ||
        !Buffer.isBuffer(signingKey) || signingKey.length !== 32) {
      throw new Error('guest_intent_test_configuration_invalid');
    }
  }

  private testOnly(): void {
    if (process.env.NODE_ENV === 'production' ||
        process.env.DA_GUEST_STRIPE_TEST_ONLY !== '1') {
      throw new Error('guest_stripe_creation_disabled');
    }
  }

  private validateProviderResponse(
    result: GuestTransportIntent,
    params: GuestIntentParams,
  ): void {
    if (!result || !VALID_INTENT.test(result.id) ||
        typeof result.clientSecret !== 'string' ||
        !result.clientSecret.startsWith(result.id + '_secret_') ||
        result.amount !== params.amount ||
        result.currency !== params.currency ||
        result.livemode !== false ||
        result.status !== 'requires_payment_method' ||
        !result.metadata || typeof result.metadata !== 'object') {
      throw new Error('guest_stripe_test_intent_invalid');
    }
    for (const [name, expected] of Object.entries(params.metadata)) {
      if (result.metadata[name] !== expected) {
        throw new Error('guest_stripe_metadata_mismatch');
      }
    }
  }

  private async canonicalLedger(token: string, orderId: string) {
    const result = await this.db.query<LedgerRow>(
      `SELECT s.order_id, s.guest_subject, s.mutation_id, s.state,
              s.quoted_amount_cents, s.quoted_currency,
              s.quote_fingerprint, s.payment_intent_id
         FROM da_guest_checkout_sessions s
         JOIN da_guest_fulfillment_vault v
           ON v.order_id=s.order_id AND v.quote_fingerprint=s.quote_fingerprint
        WHERE s.order_id=$1
          AND s.capability_sha256=$2::bytea
          AND s.expires_at > now()
        LIMIT 1`,
      [orderId, hash(token)],
    );
    if (result.rowCount !== 1 || !result.rows[0]) {
      throw new Error('guest_intent_session_or_delivery_missing');
    }
    const r = result.rows[0];
    const amount = Number(r.quoted_amount_cents);
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100_000_000 ||
        r.quoted_currency !== 'eur' || !QUOTE_HASH.test(r.quote_fingerprint)) {
      throw new Error('guest_intent_quote_invalid');
    }
    if (!['quoted','payment_pending'].includes(r.state)) {
      throw new Error('guest_intent_invalid_order_state');
    }
    return {row:r, amount};
  }

  /**
   * Read *signed* guest ownership and encrypted Google proof, then fresh
   * Merchant + independent Ops coverage approval. No cached boolean or
   * merchant-editable "approvedByOps" can grant an Intent.
   */
  private async requireCurrentDeliveryAuthorization(
    token: string, ledger: LedgerRow, amount: number,
  ): Promise<void> {
    const protectedDelivery = await this.vault.readTrustedDeliveryForPayment(token);
    if (protectedDelivery.orderId !== ledger.order_id ||
        protectedDelivery.partnerSlug.length < 2 ||
        protectedDelivery.quoteFingerprint !== ledger.quote_fingerprint ||
        protectedDelivery.amountCents !== amount) {
      throw new Error('guest_intent_encrypted_checkout_mismatch');
    }
    const evidence = protectedDelivery.locationProof;
    const authorization = await this.coverage.verifyCoverage({
      partnerSlug: protectedDelivery.partnerSlug,
      countryCode: evidence.countryCode,
      postalCode: evidence.postalCode,
      latitude: evidence.latitude,
      longitude: evidence.longitude,
      placeId: evidence.placeId,
    });
    if (authorization.allowed !== true ||
        authorization.serviceAreaCode !== protectedDelivery.serviceAreaCode) {
      throw new Error('guest_intent_delivery_authorization_denied');
    }
  }

  private paramsFor(
    orderId: string,
    subject: string,
    mutationId: string,
    amount: number,
    fingerprint: string,
  ): GuestIntentParams {
    return {
      orderId,
      amount,
      currency: 'eur',
      metadata: {
        source: 'delishafrica-guest-checkout',
        orderId,
        clientIssuer: 'urn:delishafrica:guest-checkout:v1',
        clientSubject: subject,
        clientMutationId: mutationId,
        quoteFingerprint: fingerprint,
      },
      idempotencyKey: 'da-gc-pi-v1:' + orderId,
    };
  }

  private async restore(
    attempt: AttemptRow,
    params: GuestIntentParams,
  ): Promise<GuestIntentStart> {
    if (!attempt.stripe_intent_id ||
        !VALID_INTENT.test(attempt.stripe_intent_id)) {
      throw new Error('guest_intent_bound_record_invalid');
    }
    const remote = await this.transport.getIntent(attempt.stripe_intent_id);
    if (remote.status !== 'requires_payment_method') {
      throw new Error('guest_intent_already_progressed_reconcile');
    }
    this.validateProviderResponse(remote, params);
    if (remote.id !== attempt.stripe_intent_id) {
      throw new Error('guest_intent_restored_id_mismatch');
    }
    return {
      state: 'restored',
      orderId: params.orderId,
      intentId: remote.id,
      clientSecret: remote.clientSecret,
      amount: params.amount,
      currency: 'eur',
      idempotencyKey: params.idempotencyKey,
    };
  }

  /**
   * Exactly one stable Stripe idempotency key for one guest order.
   * No HTTP route is connected; the injected test transport is the only IO.
   */
  async start(token: string): Promise<GuestIntentStart> {
    this.testOnly();
    const claims = verifyGuestCheckoutCapability(
      this.signingKey, token, this.clock(),
    );
    if (!claims) throw new Error('guest_intent_capability_invalid');

    const { row, amount } = await this.canonicalLedger(token, claims.orderId);
    if (row.guest_subject !== claims.subject ||
        row.mutation_id !== claims.mutationId) {
      throw new Error('guest_intent_owner_mismatch');
    }
    // Even an already-bound Intent cannot be restored to a newly revoked zone.
    await this.requireCurrentDeliveryAuthorization(token, row, amount);
    const params = this.paramsFor(
      claims.orderId, claims.subject, claims.mutationId,
      amount, row.quote_fingerprint,
    );
    const expectedHash = requestDigest(params);
    const leaseOwner = randomBytes(16).toString('hex');

    let attempt: AttemptRow | null = null;
    let reserved = false;

    // Persist the idempotency key BEFORE any Stripe IO.
    if (row.state === 'quoted') {
      const inserted = await this.db.query<AttemptRow>(
        `INSERT INTO da_guest_payment_intent_creation
           (order_id,idempotency_key,request_hash,state,lease_owner,lease_until)
         VALUES ($1,$2,$3,'creating',$4,now()+interval '90 seconds')
         ON CONFLICT DO NOTHING
         RETURNING order_id,state,request_hash,idempotency_key,
                   lease_owner,lease_until,stripe_intent_id,attempt_count`,
        [claims.orderId, params.idempotencyKey, expectedHash, leaseOwner],
      );
      if (inserted.rowCount === 1) {
        attempt = inserted.rows[0];
        reserved = true;
      }
    }

    if (!reserved) {
      const selected = await this.db.query<AttemptRow>(
        `SELECT order_id,state,request_hash,idempotency_key,
                lease_owner,lease_until,stripe_intent_id,attempt_count
           FROM da_guest_payment_intent_creation
          WHERE order_id=$1`,
        [claims.orderId],
      );
      attempt = selected.rows[0] || null;
      if (!attempt ||
          attempt.request_hash !== expectedHash ||
          attempt.idempotency_key !== params.idempotencyKey) {
        throw new Error('guest_intent_reservation_mismatch');
      }
      if (attempt.state === 'bound') {
        if (row.state !== 'payment_pending' ||
            row.payment_intent_id !== attempt.stripe_intent_id) {
          throw new Error('guest_intent_database_binding_mismatch');
        }
        return this.restore(attempt, params);
      }
      if (row.state !== 'quoted') {
        throw new Error('guest_intent_state_requires_manual_reconciliation');
      }
      const reclaimed = await this.db.query<AttemptRow>(
        `UPDATE da_guest_payment_intent_creation
            SET lease_owner=$3,
                lease_until=now()+interval '90 seconds',
                attempt_count=attempt_count+1,
                updated_at=now()
          WHERE order_id=$1 AND request_hash=$2
            AND state='creating' AND lease_until <= now()
            AND attempt_count < 6
          RETURNING order_id,state,request_hash,idempotency_key,
                    lease_owner,lease_until,stripe_intent_id,attempt_count`,
        [claims.orderId, expectedHash, leaseOwner],
      );
      if (reclaimed.rowCount === 1) {
        attempt = reclaimed.rows[0];
        reserved = true;
      } else {
        if (attempt.attempt_count >= 6 &&
            new Date(attempt.lease_until || 0).getTime() <= this.clock()) {
          throw new Error('guest_intent_manual_reconciliation_required');
        }
        return {
          state: 'in_progress',
          retryAfterSeconds: 2,
          orderId: claims.orderId,
        };
      }
    }

    if (!reserved || attempt?.lease_owner !== leaseOwner) {
      throw new Error('guest_intent_reservation_lost');
    }

    // Authorize AGAIN immediately before the potentially slow Stripe call.
    // Ops may revoke after initial guest session validation/reservation.
    await this.requireCurrentDeliveryAuthorization(token, row, amount);

    // This may succeed remotely and then fail locally (network timeout).
    // Stripe's idempotency key and full request MUST remain identical on retry.
    const remote = await this.transport.createIntent(params);
    this.validateProviderResponse(remote, params);

    // Deny access to a newly-revoked Intent even if Stripe created it while
    // network IO was in flight. No client secret leaves this method.
    // Cancellation/reconciliation of a never-presented Intent is a separate
    // P5C activation prerequisite, not a reason to weaken this check.
    await this.requireCurrentDeliveryAuthorization(token, row, amount);

    const tx = await this.db.connect();
    let open = false;
    try {
      await tx.query('BEGIN');
      open = true;
      const bound = await tx.query<LedgerRow>(
        `SELECT s.order_id,s.guest_subject,s.mutation_id,s.state,
                s.quoted_amount_cents,s.quoted_currency,s.quote_fingerprint,
                s.payment_intent_id
           FROM da_guest_checkout_sessions s
           JOIN da_guest_fulfillment_vault v
             ON v.order_id=s.order_id AND v.quote_fingerprint=s.quote_fingerprint
          WHERE s.order_id=$1 AND s.capability_sha256=$2::bytea
            AND s.expires_at > now()
          FOR UPDATE OF s`,
        [claims.orderId, hash(token)],
      );
      const current = bound.rows[0];
      if (bound.rowCount !== 1 || !current ||
          current.state !== 'quoted' ||
          current.guest_subject !== claims.subject ||
          current.mutation_id !== claims.mutationId ||
          current.payment_intent_id !== null ||
          Number(current.quoted_amount_cents) !== params.amount ||
          current.quoted_currency !== params.currency ||
          current.quote_fingerprint !== params.metadata.quoteFingerprint) {
        throw new Error('guest_intent_stale_checkout_state');
      }
      const lease = await tx.query<AttemptRow>(
        `SELECT order_id,state,request_hash,idempotency_key,
                lease_owner,lease_until,stripe_intent_id,attempt_count
           FROM da_guest_payment_intent_creation
          WHERE order_id=$1 FOR UPDATE`,
        [claims.orderId],
      );
      const active = lease.rows[0];
      if (!active || active.state !== 'creating' ||
          active.request_hash !== expectedHash ||
          active.idempotency_key !== params.idempotencyKey ||
          active.lease_owner !== leaseOwner ||
          new Date(active.lease_until || 0).getTime() <= this.clock()) {
        throw new Error('guest_intent_lease_lost');
      }
      const applied = await tx.query<{order_id: string}>(
        `UPDATE da_guest_checkout_sessions
            SET state='payment_pending',payment_intent_id=$2,updated_at=now()
          WHERE order_id=$1 AND state='quoted'
          RETURNING order_id`,
        [claims.orderId, remote.id],
      );
      if (applied.rowCount !== 1) {
        throw new Error('guest_intent_ledger_transition_failed');
      }
      const saved = await tx.query<{order_id: string}>(
        `UPDATE da_guest_payment_intent_creation
            SET state='bound',stripe_intent_id=$2,
                lease_owner=NULL,lease_until=NULL,updated_at=now()
          WHERE order_id=$1 AND state='creating'
            AND lease_owner=$3 AND request_hash=$4
          RETURNING order_id`,
        [claims.orderId, remote.id, leaseOwner, expectedHash],
      );
      if (saved.rowCount !== 1) {
        throw new Error('guest_intent_commit_conflict');
      }
      await tx.query('COMMIT');
      open = false;
    } catch (error) {
      if (open) await tx.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      tx.release();
    }

    return {
      state: 'created',
      orderId: claims.orderId,
      intentId: remote.id,
      clientSecret: remote.clientSecret,
      amount: params.amount,
      currency: 'eur',
      idempotencyKey: params.idempotencyKey,
    };
  }
}
