import type { GuestTransactionalDb } from './guest-stripe-financial-finalizer';
import {
  GuestPrivateFulfillmentVault,
  type EncryptedFulfillmentRow,
} from './guest-private-fulfillment-vault';

/**
 * P4 LAB ONLY — prepares a sealed paid order for a FUTURE authorized bridge.
 *
 * This DOES NOT publish to Merchant/Courier/Ops; no HTTP route calls it.
 * Decryption happens only under a paid session lock. Only non-PII status
 * leaves this service.
 */
type LockedRow = EncryptedFulfillmentRow & {
  state: string;
  amount_cents: number | string;
  currency: string;
  payment_intent_id: string;
  payment_fingerprint: string;
  outbox_status: string;
};

type PrepareOutcome = {
  orderId: string;
  prepared: true;
  replay: boolean;
  deliveryStatus: 'ready';
  broadcastToMerchant: false;
  courierDispatched: false;
};

export class GuestPaidFulfillmentPreparer {
  constructor(
    private readonly db: GuestTransactionalDb,
    private readonly vault: GuestPrivateFulfillmentVault,
  ) {}

  /** Caller is trusted internal server job; this order ID is NOT a bearer auth. */
  async preparePaidOrder(orderId: string): Promise<PrepareOutcome> {
    if (!/^DA-G-[a-f0-9]{32}$/.test(orderId)) {
      throw new Error('guest_private_order_id_invalid');
    }
    const tx = await this.db.connect();
    let began = false;
    try {
      await tx.query('BEGIN');
      began = true;
      const selected = await tx.query<LockedRow>(
        `SELECT s.order_id, s.state, s.quote_fingerprint,
                p.captured_amount_cents AS amount_cents,
                p.currency, p.payment_intent_id,
                p.quote_fingerprint AS payment_fingerprint,
                v.encryption_version, v.encryption_key_id,
                v.iv, v.ciphertext, v.auth_tag, v.payload_mac,
                o.delivery_status AS outbox_status
           FROM da_guest_checkout_sessions s
           JOIN da_guest_verified_payments p USING(order_id)
           JOIN da_guest_fulfillment_vault v USING(order_id)
           JOIN da_guest_financial_outbox o USING(order_id)
          WHERE s.order_id = $1 FOR UPDATE OF s`,
        [orderId],
      );
      if (selected.rowCount !== 1 || !selected.rows[0]) {
        throw new Error('guest_private_fulfillment_missing');
      }
      const row = selected.rows[0];
      if (row.state !== 'committed' ||
          row.quote_fingerprint !== row.payment_fingerprint ||
          row.quote_fingerprint == null) {
        throw new Error('guest_private_payment_not_committed');
      }
      const snapshot = this.vault.openForInternalPaidOrder(
        row, orderId, row.quote_fingerprint,
      );
      if (snapshot.amountCents !== Number(row.amount_cents) ||
          snapshot.currency !== String(row.currency).trim().toLowerCase()) {
        throw new Error('guest_private_payment_amount_mismatch');
      }
      const prior = await tx.query<{
        quote_fingerprint: string;
        merchant_slug: string;
        payment_intent_id: string;
      }>(
        `SELECT quote_fingerprint, merchant_slug, payment_intent_id
           FROM da_guest_fulfillment_prepared WHERE order_id = $1`,
        [orderId],
      );
      const replay = prior.rowCount === 1;
      if (replay) {
        const previous = prior.rows[0];
        if (previous.quote_fingerprint !== snapshot.quoteFingerprint ||
            previous.merchant_slug !== snapshot.partnerSlug ||
            previous.payment_intent_id !== row.payment_intent_id) {
          throw new Error('guest_private_preparation_conflict');
        }
      } else {
        const created = await tx.query<{ order_id: string }>(
          `INSERT INTO da_guest_fulfillment_prepared
             (order_id, quote_fingerprint, merchant_slug, payment_intent_id)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT DO NOTHING RETURNING order_id`,
          [orderId, snapshot.quoteFingerprint, snapshot.partnerSlug, row.payment_intent_id],
        );
        if (created.rowCount !== 1) {
          throw new Error('guest_private_preparation_write_conflict');
        }
      }
      const notice = await tx.query<{ order_id: string }>(
        `UPDATE da_guest_financial_outbox
            SET delivery_status = 'ready'
          WHERE order_id = $1
            AND delivery_status IN ('pending_fulfillment_data','ready')
          RETURNING order_id`,
        [orderId],
      );
      if (notice.rowCount !== 1) {
        throw new Error('guest_private_financial_outbox_not_pending');
      }
      await tx.query('COMMIT');
      began = false;
      return {
        orderId, prepared: true, replay, deliveryStatus: 'ready',
        broadcastToMerchant: false,
        courierDispatched: false,
      };
    } catch (error) {
      if (began) await tx.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      tx.release();
    }
  }
}
