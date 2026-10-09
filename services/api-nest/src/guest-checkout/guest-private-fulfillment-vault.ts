import {
  createCipheriv, createDecipheriv, createHash, createHmac,
  randomBytes, timingSafeEqual,
} from 'node:crypto';
import type { CanonicalOrderQuote } from '../order-policy/catalog-order-policy.service';
import type { GuestSqlExecutor } from './guest-checkout-ledger';
import { verifyGuestCheckoutCapability } from './guest-capability';

/**
 * Guest P4: private fulfillment vault (LAB, no HTTP integration).
 * The guest HMAC capability is NOT an account credential.
 * Only an authenticated internal backend worker may materialize these records.
 *
 * The external caller must first run verified server-side delivery-zone checks.
 * No customer names, telephone, addresses, instructions, allergen information,
 * or raw capability tokens are stored in PostgreSQL as plaintext.
 */

export type GuestContactInput = Readonly<{
  name: string;
  phone: string;
  email?: string | null;
  address: string;
  city: string;
  instructions?: string | null;
  allergenFlags?: readonly string[];
  dietaryTags?: readonly string[];
  foodSafetyNote?: string | null;
  consent: boolean;
}>;

export type TrustedDeliveryVerification = Readonly<{
  verifiedByServer: true;
  eligible: true;
  serviceAreaCode: string;
}>;

export type PrivateGuestFulfillment = {
  version: 1;
  orderId: string;
  quoteFingerprint: string;
  partnerSlug: string;
  partnerName: string;
  amountCents: number;
  currency: 'eur';
  lineItems: Array<{
    id: string;
    name: string;
    quantity: number;
    unitAmount: number;
    lineAmount: number;
  }>;
  subtotal: number;
  deliveryFee: number;
  serviceAreaCode: string;
  contact: {
    name: string;
    phone: string;
    email: string | null;
    address: string;
    city: string;
    instructions: string;
    allergenFlags: string[];
    dietaryTags: string[];
    foodSafetyNote: string;
  };
};

export type EncryptedFulfillmentRow = {
  order_id: string;
  quote_fingerprint: string;
  encryption_version: number;
  encryption_key_id: string;
  iv: Buffer;
  ciphertext: Buffer;
  auth_tag: Buffer;
  payload_mac: Buffer;
};

const SHA = /^[a-f0-9]{64}$/;
const SLUG = /^[a-z0-9][a-z0-9-_]{0,119}$/;
const KEY_ID = /^[a-z][a-z0-9_-]{2,31}$/;

function ensureText(
  value: unknown,
  min: number,
  max: number,
  code: string,
): string {
  if (typeof value !== 'string') throw new Error(code);
  const cleaned = value.trim();
  if (cleaned.length < min || cleaned.length > max || /[\u0000-\u001F\u007F]/.test(cleaned)) {
    throw new Error(code);
  }
  return cleaned;
}

function optionalText(value: unknown, max: number, code: string): string {
  if (value == null || value === '') return '';
  return ensureText(value, 1, max, code);
}

function safeTags(input: unknown, code: string): string[] {
  if (input == null) return [];
  if (!Array.isArray(input) || input.length > 12) throw new Error(code);
  return input.map((tag) => ensureText(tag, 1, 80, code));
}

export function canonicalPrivateFulfillment(
  orderId: string,
  quote: CanonicalOrderQuote,
  contact: GuestContactInput,
  delivery: TrustedDeliveryVerification,
): PrivateGuestFulfillment {
  if (!/^DA-G-[a-f0-9]{32}$/.test(orderId)) throw new Error('guest_private_order_id_invalid');
  if (!quote || quote.ok !== true || quote.currency !== 'eur' ||
      !SHA.test(quote.quoteFingerprint) || !SLUG.test(quote.partnerSlug) ||
      !Array.isArray(quote.items) || quote.items.length < 1 || quote.items.length > 40) {
    throw new Error('guest_private_catalog_quote_invalid');
  }
  if (!delivery || delivery.verifiedByServer !== true || delivery.eligible !== true ||
      !SLUG.test(delivery.serviceAreaCode)) {
    throw new Error('guest_private_delivery_not_verified');
  }
  if (!contact || contact.consent !== true) {
    throw new Error('guest_private_consent_required');
  }
  const lineItems = quote.items.map((x) => {
    const id = ensureText(x.id, 1, 120, 'guest_private_item_invalid');
    const name = ensureText(x.name, 1, 200, 'guest_private_item_invalid');
    if (!Number.isSafeInteger(x.quantity) || x.quantity < 1 || x.quantity > 50 ||
        !Number.isSafeInteger(x.unitAmount) || x.unitAmount < 1 ||
        x.lineAmount !== x.quantity * x.unitAmount) {
      throw new Error('guest_private_item_invalid');
    }
    return {
      id, name, quantity: x.quantity, unitAmount: x.unitAmount,
      lineAmount: x.lineAmount,
    };
  });
  if (!Number.isSafeInteger(quote.subtotal) || quote.subtotal < 1 ||
      !Number.isSafeInteger(quote.deliveryFee) || quote.deliveryFee < 0 ||
      quote.subtotal !== lineItems.reduce((a, x) => a + x.lineAmount, 0) ||
      quote.total !== quote.subtotal + quote.deliveryFee) {
    throw new Error('guest_private_quote_total_invalid');
  }
  const name = ensureText(contact.name, 2, 120, 'guest_private_name_required');
  const phone = ensureText(contact.phone, 7, 28, 'guest_private_phone_invalid');
  if (!/^[+() .\d-]{7,28}$/.test(phone) || phone.replace(/\D/g, '').length < 7) {
    throw new Error('guest_private_phone_invalid');
  }
  const email = optionalText(contact.email, 180, 'guest_private_email_invalid');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('guest_private_email_invalid');
  }
  return {
    version: 1, orderId,
    quoteFingerprint: quote.quoteFingerprint,
    partnerSlug: quote.partnerSlug,
    partnerName: ensureText(quote.partnerName, 1, 160, 'guest_private_partner_invalid'),
    amountCents: quote.total,
    currency: 'eur',
    lineItems, subtotal: quote.subtotal, deliveryFee: quote.deliveryFee,
    serviceAreaCode: delivery.serviceAreaCode,
    contact: {
      name, phone, email: email || null,
      address: ensureText(contact.address, 8, 500, 'guest_private_address_invalid'),
      city: ensureText(contact.city, 2, 120, 'guest_private_city_invalid'),
      instructions: optionalText(contact.instructions, 400, 'guest_private_instructions_invalid'),
      allergenFlags: safeTags(contact.allergenFlags, 'guest_private_allergens_invalid'),
      dietaryTags: safeTags(contact.dietaryTags, 'guest_private_diet_invalid'),
      foodSafetyNote: optionalText(contact.foodSafetyNote, 400, 'guest_private_food_note_invalid'),
    },
  };
}

function aad(orderId: string, fingerprint: string): Buffer {
  return Buffer.from('delishafrica:guest-private:v1:' + orderId + ':' + fingerprint);
}
function digestToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}
function macFor(key: Buffer, payload: Buffer): Buffer {
  return createHmac('sha256', key)
    .update('delishafrica:guest-private-mac:v1:')
    .update(payload)
    .digest();
}
function safeMatch(a: Buffer, b: Buffer): boolean {
  return Buffer.isBuffer(a) && Buffer.isBuffer(b) &&
    a.length === b.length && timingSafeEqual(a, b);
}

export class GuestPrivateFulfillmentVault {
  private readonly keys: Map<string, Buffer>;
  constructor(
    private readonly db: GuestSqlExecutor,
    private readonly capabilityKey: Buffer,
    keys: ReadonlyMap<string, Buffer>,
    private readonly activeKeyId: string,
    private readonly clock: () => number = Date.now,
  ) {
    if (!Buffer.isBuffer(capabilityKey) || capabilityKey.length !== 32 ||
        !KEY_ID.test(activeKeyId) || !keys.has(activeKeyId)) {
      throw new Error('guest_private_key_configuration_invalid');
    }
    this.keys = new Map();
    for (const [id, key] of keys) {
      if (!KEY_ID.test(id) || !Buffer.isBuffer(key) || key.length !== 32 ||
          safeMatch(key, capabilityKey)) {
        throw new Error('guest_private_key_configuration_invalid');
      }
      this.keys.set(id, Buffer.from(key));
    }
  }

  /** Only persist the encrypted canonical snapshot after guest quote is frozen. */
  async seal(
    guestToken: string,
    quote: CanonicalOrderQuote,
    contact: GuestContactInput,
    delivery: TrustedDeliveryVerification,
  ): Promise<{ orderId: string; sealed: true; replay: boolean }> {
    const claims = verifyGuestCheckoutCapability(
      this.capabilityKey, guestToken, this.clock(),
    );
    if (!claims) throw new Error('guest_private_capability_invalid');
    const snapshot = canonicalPrivateFulfillment(claims.orderId, quote, contact, delivery);
    const plaintext = Buffer.from(JSON.stringify(snapshot), 'utf8');
    if (plaintext.length < 24 || plaintext.length > 24000) {
      throw new Error('guest_private_payload_size_invalid');
    }
    const key = this.keys.get(this.activeKeyId)!;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(aad(claims.orderId, quote.quoteFingerprint));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const mac = macFor(key, plaintext);

    const result = await this.db.query<{ order_id: string }>(
      `INSERT INTO da_guest_fulfillment_vault
         (order_id, quote_fingerprint, encryption_version, encryption_key_id,
          iv, ciphertext, auth_tag, payload_mac)
       SELECT s.order_id, $3, 1, $4, $5::bytea, $6::bytea, $7::bytea, $8::bytea
         FROM da_guest_checkout_sessions s
        WHERE s.order_id = $1 AND s.capability_sha256 = $2::bytea
          AND s.state = 'quoted' AND s.expires_at > now()
          AND s.quote_fingerprint = $3
          AND s.quoted_amount_cents = $9 AND s.quoted_currency = 'eur'
       ON CONFLICT DO NOTHING RETURNING order_id`,
      [claims.orderId, digestToken(guestToken), quote.quoteFingerprint,
        this.activeKeyId, iv, ciphertext, authTag, mac, quote.total],
    );
    if (result.rowCount === 1) {
      return { orderId: claims.orderId, sealed: true, replay: false };
    }
    const existing = await this.db.query<{
      payload_mac: Buffer; quote_fingerprint: string; encryption_key_id: string;
    }>(
      `SELECT v.payload_mac, v.quote_fingerprint, v.encryption_key_id
         FROM da_guest_fulfillment_vault v
         JOIN da_guest_checkout_sessions s USING(order_id)
        WHERE v.order_id = $1 AND s.capability_sha256 = $2::bytea
          AND s.expires_at > now() AND s.state = 'quoted'
        LIMIT 1`,
      [claims.orderId, digestToken(guestToken)],
    );
    const row = existing.rows[0];
    const existingKey = row?.encryption_key_id && this.keys.get(row.encryption_key_id);
    if (existingKey && row?.quote_fingerprint === quote.quoteFingerprint &&
        safeMatch(row.payload_mac, macFor(existingKey, plaintext))) {
      return { orderId: claims.orderId, sealed: true, replay: true };
    }
    throw new Error('guest_private_snapshot_conflict_or_invalid_session');
  }

  /**
   * INTERNAL ONLY: caller must have acquired the paid-order transaction lock.
   * It must never be reached from an endpoint with plain orderId as authority.
   */
  openForInternalPaidOrder(
    row: EncryptedFulfillmentRow,
    orderId: string,
    fingerprint: string,
  ): PrivateGuestFulfillment {
    if (row.order_id !== orderId || row.quote_fingerprint !== fingerprint ||
        row.encryption_version !== 1) throw new Error('guest_private_binding_mismatch');
    const key = this.keys.get(row.encryption_key_id);
    if (!key || !Buffer.isBuffer(row.iv) || row.iv.length !== 12 ||
        !Buffer.isBuffer(row.auth_tag) || row.auth_tag.length !== 16 ||
        !Buffer.isBuffer(row.ciphertext) || row.ciphertext.length > 32768) {
      throw new Error('guest_private_decryption_unavailable');
    }
    let plaintext: Buffer;
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, row.iv);
      decipher.setAAD(aad(orderId, fingerprint));
      decipher.setAuthTag(row.auth_tag);
      plaintext = Buffer.concat([
        decipher.update(row.ciphertext), decipher.final(),
      ]);
    } catch {
      throw new Error('guest_private_decryption_failed');
    }
    if (!safeMatch(row.payload_mac, macFor(key, plaintext))) {
      throw new Error('guest_private_integrity_failed');
    }
    let decoded: unknown;
    try {
      decoded = JSON.parse(plaintext.toString('utf8'));
    } catch {
      throw new Error('guest_private_payload_invalid');
    }
    const value = decoded as PrivateGuestFulfillment;
    if (!value || value.version !== 1 || value.orderId !== orderId ||
        value.quoteFingerprint !== fingerprint || value.currency !== 'eur' ||
        !SLUG.test(value.partnerSlug) || !value.contact?.address ||
        !value.contact?.phone || !Array.isArray(value.lineItems) ||
        value.lineItems.length === 0 ||
        value.amountCents !== value.subtotal + value.deliveryFee ||
        value.subtotal !== value.lineItems.reduce((v, x) => v + x.lineAmount, 0)) {
      throw new Error('guest_private_payload_invalid');
    }
    return value;
  }
}
