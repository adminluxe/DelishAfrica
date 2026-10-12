/**
 * DelishAfrica Client — checkout attempt fence (QA candidate, OFF by default).
 *
 * Secure persistence MUST precede the first Stripe create-intent request.
 * Prevents a fresh mutation key after an ambiguous PaymentSheet / SQL / network
 * outcome. This is a local companion to server PostgreSQL idempotency, NOT a
 * substitute for server financial reconciliation or provider proof.
 *
 * No timers, no silent TTL reset, no automatic discard on Stripe cancellation.
 * No payment credentials, client_secret, PII, or cart content are persisted.
 */
export type DaCheckoutAttemptPhase =
  | 'reserved'
  | 'intent_created'
  | 'sheet_open'
  | 'reported_success';

export type DaCheckoutAttemptSnapshot = Readonly<{
  version: 1;
  ownerScope: string;
  cartFingerprint: string;
  orderId: string;
  clientMutationId: string;
  phase: DaCheckoutAttemptPhase;
  paymentIntentId: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export interface DaCheckoutAttemptStorage {
  read(): Promise<string | null>;
  write(serialized: string): Promise<void>;
  clear(): Promise<void>;
}
export type DaCheckoutAttemptSeed = Readonly<{
  ownerScope: string;
  cartFingerprint: string;
  orderId: string;
  clientMutationId: string;
}>;

const MUTATION = /^[A-Za-z0-9:_.-]{8,128}$/;
const ORDER = /^[A-Za-z0-9:_-]{6,90}$/;
const FINGERPRINT = /^[\x20-\x7e]{12,2048}$/; // legacy Client fingerprint, scoped SecureStore
const PHASES = new Set<DaCheckoutAttemptPhase>([
  'reserved', 'intent_created', 'sheet_open', 'reported_success',
]);

function valid(snapshot: unknown): snapshot is DaCheckoutAttemptSnapshot {
  if (!snapshot || typeof snapshot !== 'object' ||
      Array.isArray(snapshot)) return false;
  const v = snapshot as Record<string, unknown>;
  return v.version === 1 &&
    typeof v.ownerScope === 'string' && v.ownerScope.length >= 8 &&
    v.ownerScope.length <= 256 &&
    typeof v.cartFingerprint === 'string' &&
    FINGERPRINT.test(v.cartFingerprint) &&
    typeof v.orderId === 'string' && ORDER.test(v.orderId) &&
    typeof v.clientMutationId === 'string' &&
    MUTATION.test(v.clientMutationId) &&
    PHASES.has(v.phase as DaCheckoutAttemptPhase) &&
    (v.paymentIntentId === null ||
      (typeof v.paymentIntentId === 'string' &&
       /^pi_[A-Za-z0-9_]{6,120}$/.test(v.paymentIntentId))) &&
    typeof v.createdAt === 'string' &&
    !Number.isNaN(Date.parse(v.createdAt)) &&
    typeof v.updatedAt === 'string' &&
    !Number.isNaN(Date.parse(v.updatedAt)) &&
    (v.phase === 'reserved' ? v.paymentIntentId === null :
      v.paymentIntentId !== null);
}

export class DaCheckoutAttemptFence {
  constructor(
    private readonly storage: DaCheckoutAttemptStorage,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {
    if (!storage || typeof storage.read !== 'function' ||
        typeof storage.write !== 'function' ||
        typeof storage.clear !== 'function') {
      throw Error('DA_CHECKOUT_FENCE_STORAGE_REQUIRED');
    }
  }

  private async load(): Promise<DaCheckoutAttemptSnapshot | null> {
    let raw: string | null;
    try {
      raw = await this.storage.read();
    } catch {
      throw Error('DA_CHECKOUT_FENCE_UNAVAILABLE_NO_NEW_PAYMENT');
    }
    if (raw === null) return null;
    if (typeof raw !== 'string' || raw.length > 8192) {
      throw Error('DA_CHECKOUT_FENCE_INVALID_NO_NEW_PAYMENT');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw Error('DA_CHECKOUT_FENCE_INVALID_NO_NEW_PAYMENT');
    }
    if (!valid(parsed)) throw Error('DA_CHECKOUT_FENCE_INVALID_NO_NEW_PAYMENT');
    return Object.freeze(parsed);
  }

  private async persist(record: DaCheckoutAttemptSnapshot): Promise<void> {
    try {
      await this.storage.write(JSON.stringify(record));
    } catch {
      throw Error('DA_CHECKOUT_FENCE_WRITE_FAILED_NO_NEW_PAYMENT');
    }
  }

  async inspect(): Promise<DaCheckoutAttemptSnapshot | null> {
    return this.load();
  }

  /** Only the still-unsubmitted reserved attempt can retry, with same key. */
  async begin(input: DaCheckoutAttemptSeed): Promise<DaCheckoutAttemptSnapshot> {
    if (!input || !valid({
      ...input,
      version: 1,
      phase: 'reserved',
      paymentIntentId: null,
      createdAt: this.now(),
      updatedAt: this.now(),
    })) {
      throw Error('DA_CHECKOUT_FENCE_SEED_INVALID');
    }
    const existing = await this.load();
    if (existing) {
      if (existing.ownerScope !== input.ownerScope ||
          existing.cartFingerprint !== input.cartFingerprint) {
        throw Error('DA_CHECKOUT_PREVIOUS_ATTEMPT_DIFFERENT_CART_NO_NEW_PAYMENT');
      }
      if (existing.phase !== 'reserved') {
        throw Error('DA_CHECKOUT_ATTEMPT_AMBIGUOUS_RECONCILIATION_REQUIRED');
      }
      // A new generated seed MUST NOT change the original persisted identity.
      return existing;
    }
    const createdAt = this.now();
    const fresh: DaCheckoutAttemptSnapshot = Object.freeze({
      ...input,
      version: 1 as const,
      phase: 'reserved' as const,
      paymentIntentId: null,
      createdAt,
      updatedAt: createdAt,
    });
    // If this call fails, the app MUST NOT contact Stripe.
    await this.persist(fresh);
    return fresh;
  }

  async markIntent(orderId: string, paymentIntentId: string):
    Promise<DaCheckoutAttemptSnapshot> {
    const existing = await this.load();
    if (!existing || existing.orderId !== orderId ||
        !/^pi_[A-Za-z0-9_]{6,120}$/.test(paymentIntentId) ||
        (existing.paymentIntentId && existing.paymentIntentId !== paymentIntentId) ||
        (existing.phase !== 'reserved' && existing.phase !== 'intent_created')) {
      throw Error('DA_CHECKOUT_FENCE_INTENT_REBIND_FORBIDDEN');
    }
    if (existing.phase === 'intent_created') return existing;
    const updated: DaCheckoutAttemptSnapshot = Object.freeze({
      ...existing, phase: 'intent_created',
      paymentIntentId, updatedAt: this.now(),
    });
    await this.persist(updated);
    return updated;
  }

  async markSheetOpened(orderId: string):
    Promise<DaCheckoutAttemptSnapshot> {
    const existing = await this.load();
    if (!existing || existing.orderId !== orderId ||
        existing.phase !== 'intent_created') {
      throw Error('DA_CHECKOUT_FENCE_SHEET_PHASE_FORBIDDEN');
    }
    const updated: DaCheckoutAttemptSnapshot = Object.freeze({
      ...existing, phase: 'sheet_open', updatedAt: this.now(),
    });
    // Persist BEFORE giving control to the bank SDK.
    await this.persist(updated);
    return updated;
  }

  async markPaymentReported(orderId: string):
    Promise<DaCheckoutAttemptSnapshot> {
    const existing = await this.load();
    if (!existing || existing.orderId !== orderId ||
        existing.phase !== 'sheet_open') {
      throw Error('DA_CHECKOUT_FENCE_PAYMENT_RESULT_FORBIDDEN');
    }
    const updated: DaCheckoutAttemptSnapshot = Object.freeze({
      ...existing, phase: 'reported_success', updatedAt: this.now(),
    });
    await this.persist(updated);
    return updated;
  }

  /**
   * Call ONLY after the API has returned and the Client has re-read the
   * same paid order/PI from its authoritative endpoint.
   */
  async clearAfterVerifiedOrder(orderId: string, paymentIntentId: string):
    Promise<void> {
    const existing = await this.load();
    if (!existing ||
        !['sheet_open', 'reported_success'].includes(existing.phase) ||
        existing.orderId !== orderId ||
        existing.paymentIntentId !== paymentIntentId) {
      throw Error('DA_CHECKOUT_FENCE_NOT_PROVEN_PAID');
    }
    try {
      await this.storage.clear();
    } catch {
      throw Error('DA_CHECKOUT_FENCE_CLEAR_FAILED');
    }
  }
}
