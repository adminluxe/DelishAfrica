import type { GuestTransactionalDb } from './guest-stripe-financial-finalizer';
import type {
  GuestTransportIntent,
  GuestIntentTransport,
} from './guest-stripe-intent-reservation';

/**
 * P5-D LAB ONLY. An internal server-side compensation boundary for a Stripe
 * Intent whose payment sheet was NEVER released to a client.
 *
 * The reservation row is locked while the provider cancellation is attempted.
 * A concurrent worker cannot bind that row while it is being cancelled.
 *
 * IMPORTANT: PaymentIntent cancellation is NOT a refund. Intents that cannot
 * be cancelled, or whose state cannot be proven, enter review_required.
 * No public endpoint and no payment privileges are added by this module.
 */

type Row = {
  order_id: string;
  state: string;
  lease_owner: string | null;
  stripe_intent_id: string | null;
};

export type IntentCompensationResult =
  | { outcome: 'cancelled'; paymentIntentId: string }
  | { outcome: 'review_required'; paymentIntentId: string | null };

export type CompensationReason =
  | 'coverage_revoked_after_create'
  | 'provider_response_invalid'
  | 'database_binding_failed'
  | 'commit_outcome_uncertain';

const ID = /^pi_[A-Za-z0-9_]{8,192}$/;
const ORDER = /^DA-G-[a-f0-9]{32}$/;
const OWNER = /^[a-f0-9]{32}$/;

export class GuestOrphanIntentCompensator {
  constructor(
    private readonly db: GuestTransactionalDb,
    private readonly transport: Pick<GuestIntentTransport, 'cancelIntent'>,
  ) {}

  /**
   * Never auto-cancel if another worker owns/has bound the same reservation.
   * In either case the parent P5-C start() must not return a client secret.
   *
   * The caller passes providerVerified=false for a malformed or mismatched
   * Stripe result; an untrusted Intent ID is NEVER cancelled automatically.
   */
  async settleKnown(
    orderId: string,
    leaseOwner: string,
    paymentIntentId: string | null,
    providerVerified: boolean,
    reason: CompensationReason,
  ): Promise<IntentCompensationResult> {
    if (!ORDER.test(orderId) || !OWNER.test(leaseOwner) ||
        (paymentIntentId !== null && !ID.test(paymentIntentId))) {
      throw new Error('guest_compensation_input_invalid');
    }

    const tx = await this.db.connect();
    let open = false;
    try {
      await tx.query('BEGIN');
      open = true;
      const result = await tx.query<Row>(
        `SELECT order_id,state,lease_owner,stripe_intent_id
           FROM da_guest_payment_intent_creation
          WHERE order_id=$1
          FOR UPDATE`,
        [orderId],
      );
      const row = result.rows[0];
      if (result.rowCount !== 1 || !row ||
          row.state !== 'creating' || row.lease_owner !== leaseOwner) {
        throw new Error('guest_compensation_fence_lost');
      }

      let terminal: 'cancelled' | 'review_required' = 'review_required';
      let finalReason: string = reason;
      if (providerVerified && paymentIntentId) {
        try {
          // The adapter MUST have a bounded timeout before any real activation.
          const cancelled: GuestTransportIntent =
            await this.transport.cancelIntent(paymentIntentId);
          if (cancelled?.id === paymentIntentId &&
              cancelled.status === 'canceled' &&
              cancelled.livemode === false) {
            terminal = 'cancelled';
          } else {
            finalReason = 'cancel_failed';
          }
        } catch {
          // Fail closed: a transport error must not make the order payable.
          finalReason = 'cancel_failed';
        }
      }

      const updated = await tx.query<{order_id: string}>(
        `UPDATE da_guest_payment_intent_creation
            SET state=$3, lease_owner=NULL, lease_until=NULL,
                stripe_intent_id=$4,reconciliation_reason=$5,updated_at=now()
          WHERE order_id=$1 AND lease_owner=$2 AND state='creating'
          RETURNING order_id`,
        [orderId,leaseOwner,terminal,paymentIntentId,finalReason],
      );
      if (updated.rowCount !== 1) {
        throw new Error('guest_compensation_write_conflict');
      }
      await tx.query('COMMIT');
      open = false;
      return {
        outcome: terminal,
        paymentIntentId,
      };
    } catch (error) {
      if (open) {
        await tx.query('ROLLBACK').catch(() => undefined);
      }
      throw error;
    } finally {
      tx.release();
    }
  }

  /**
   * Stripe's idempotency memory is not indefinite. After 23 hours from the
   * FIRST reservation, reusing a key to CREATE an unknown remote Intent is
   * unsafe: the same key could now create a SECOND Intent.
   *
   * An expired lease is safely quarantined; an active lease is left untouched
   * but start() still refuses provider IO after this absolute deadline.
   */
  async quarantineExpired(orderId: string): Promise<boolean> {
    if (!ORDER.test(orderId)) {
      throw new Error('guest_compensation_input_invalid');
    }
    const tx = await this.db.connect();
    let open = false;
    try {
      await tx.query('BEGIN');
      open = true;
      const updated = await tx.query<{order_id: string}>(
        `UPDATE da_guest_payment_intent_creation
            SET state='review_required', lease_owner=NULL,lease_until=NULL,
                reconciliation_reason='idempotency_window_expired',
                updated_at=now()
          WHERE order_id=$1 AND state='creating'
            AND created_at <= now() - interval '23 hours'
            AND lease_until <= now()
          RETURNING order_id`,
        [orderId],
      );
      await tx.query('COMMIT');
      open = false;
      return updated.rowCount === 1;
    } catch (error) {
      if (open) await tx.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      tx.release();
    }
  }
}
