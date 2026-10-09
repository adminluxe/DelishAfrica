import {
  createCipheriv, createDecipheriv, createHmac, createHash, randomBytes,
} from 'node:crypto';
import {
  verifyGuestCheckoutCapability,
} from './guest-capability';
import type { GuestTransactionalDb } from './guest-stripe-financial-finalizer';
import type { CanonicalOrderQuote } from '../order-policy/catalog-order-policy.service';

/**
 * P4 LAB: atomic capture of verified catalog quote + encrypted delivery data.
 * NEVER expose decryptDelivery to a public guest endpoint.
 * NO Stripe payment or actual dispatch is performed by this class.
 */
type AnyObj = Record<string, unknown>;
export type GuestQuotePolicy = {
  quote(cart: Record<string, any>): Promise<CanonicalOrderQuote>;
};
type NormalizedDelivery = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  instructions: string;
  allergenFlags: string[];
  foodSafetyNote: string;
  giftDelivery: boolean;
};

function clean(value: unknown, limit: number, required: boolean): string {
  if (typeof value !== 'string') {
    if (required) throw new Error('guest_delivery_invalid');
    return '';
  }
  const v = value.trim().replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if ((required && v.length < 2) || v.length > limit) throw new Error('guest_delivery_invalid');
  return v;
}
function normalizeDelivery(input: AnyObj): NormalizedDelivery {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('guest_delivery_invalid');
  }
  const firstName = clean(input.firstName, 70, true);
  const lastName = clean(input.lastName, 70, true);
  const phone = clean(input.phone, 35, true);
  const email = clean(input.email, 180, false);
  const address = clean(input.address, 250, true);
  const city = clean(input.city, 120, true);
  const instructions = clean(input.instructions, 500, false);
  const foodSafetyNote = clean(input.foodSafetyNote, 500, false);
  if (!/^[+\d()\s.-]{7,35}$/.test(phone) ||
      (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new Error('guest_delivery_invalid');
  }
  const flags = Array.isArray(input.allergenFlags) ? input.allergenFlags : [];
  if (flags.length > 20 || flags.some((x) => typeof x !== 'string')) {
    throw new Error('guest_delivery_invalid');
  }
  return {
    firstName,lastName,phone,email,address,city,instructions,foodSafetyNote,
    allergenFlags:flags.map((x) => clean(x,60,false)),
    giftDelivery:input.giftDelivery === true,
  };
}

function derive(key: Buffer, usage: string): Buffer {
  if (!Buffer.isBuffer(key) || key.length !== 32) {
    throw new Error('guest_delivery_key_requires_32_bytes');
  }
  return createHmac('sha256',key).update('delishafrica-guest-delivery-v1:'+usage).digest();
}
function digest(value: string): Buffer {
  return createHash('sha256').update(value,'utf8').digest();
}
export type SealedDelivery = {
  iv: Buffer;
  tag: Buffer;
  ciphertext: Buffer;
  fingerprint: Buffer;
};

/** AES-256-GCM + binding to the orderId via authenticated additional data. */
export function sealGuestDelivery(
  key: Buffer, orderId: string, input: AnyObj,
): SealedDelivery {
  const normalized = normalizeDelivery(input);
  const body = Buffer.from(JSON.stringify(normalized),'utf8');
  if (body.length > 5000) throw new Error('guest_delivery_too_large');
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',derive(key,'encryption'),iv);
  cipher.setAAD(Buffer.from('guest-order-v1:'+orderId));
  const ciphertext=Buffer.concat([cipher.update(body),cipher.final()]);
  return {
    iv,tag:cipher.getAuthTag(),ciphertext,
    fingerprint:createHmac('sha256',derive(key,'fingerprint')).update(body).digest(),
  };
}
/** Server-authorized fulfillment worker only. Never log or return plaintext to a guest API. */
export function openGuestDelivery(
  key: Buffer, orderId: string, sealed: SealedDelivery,
): NormalizedDelivery {
  if (!sealed || sealed.iv.length!==12 || sealed.tag.length!==16 ||
      sealed.ciphertext.length > 12000) {
    throw new Error('guest_delivery_cipher_invalid');
  }
  try {
    const decipher=createDecipheriv('aes-256-gcm',derive(key,'encryption'),sealed.iv);
    decipher.setAAD(Buffer.from('guest-order-v1:'+orderId));
    decipher.setAuthTag(sealed.tag);
    const plain=Buffer.concat([decipher.update(sealed.ciphertext),decipher.final()]);
    const normalized=normalizeDelivery(JSON.parse(plain.toString('utf8')) as AnyObj);
    const fp=createHmac('sha256',derive(key,'fingerprint')).update(plain).digest();
    if (!fp.equals(sealed.fingerprint)) throw new Error('fingerprint mismatch');
    return normalized;
  } catch {
    throw new Error('guest_delivery_cipher_invalid');
  }
}

export type GuestPreparedQuote = {
  ok: true; orderId: string; mutationId: string;
  state: 'quoted'; total: number; currency: 'eur';
  partnerSlug: string; quoteFingerprint: string; expiresAt: string;
};

export class GuestCheckoutQuoteContext {
  constructor(
    private readonly db: GuestTransactionalDb,
    private readonly signingKey: Buffer,
    private readonly deliveryKey: Buffer,
    private readonly policy: GuestQuotePolicy,
    private readonly clock: () => number = Date.now,
  ) {
    if (signingKey.length < 32 || deliveryKey.length !== 32 ||
        signingKey.equals(deliveryKey)) {
      throw new Error('guest_context_separate_keys_required');
    }
  }
  async prepare(
    token: string, cart: Record<string,any>, delivery: AnyObj,
  ): Promise<GuestPreparedQuote> {
    const claims = verifyGuestCheckoutCapability(this.signingKey,token,this.clock());
    if (!claims) throw new Error('guest_context_token_invalid');
    // Quote comes from server catalog. Client amount, currency and prices ignored.
    const quote=await this.policy.quote(cart);
    if (!quote.ok || quote.currency!=='eur' ||
        !Number.isSafeInteger(quote.total) || quote.total<1 ||
        !/^[a-f0-9]{64}$/.test(quote.quoteFingerprint) ||
        typeof quote.partnerSlug!=='string') {
      throw new Error('guest_context_untrusted_quote');
    }
    const sealed=sealGuestDelivery(this.deliveryKey,claims.orderId,delivery);
    const client=await this.db.connect();
    let open=false;
    try {
      await client.query('BEGIN');open=true;
      const session=await client.query<Record<string,any>>(
        `SELECT state,expires_at,guest_subject,mutation_id,capability_sha256
           FROM da_guest_checkout_sessions
          WHERE order_id=$1 FOR UPDATE`,[claims.orderId],
      );
      const row=session.rows[0];
      if (!row || row.guest_subject!==claims.subject ||
          row.mutation_id!==claims.mutationId ||
          !Buffer.from(row.capability_sha256).equals(digest(token)) ||
          new Date(row.expires_at).getTime()<=this.clock()) {
        throw new Error('guest_context_unauthorized_or_expired');
      }
      if (row.state==='issued') {
        const inserted=await client.query<{order_id:string}>(
          `INSERT INTO da_guest_order_context(
              order_id,delivery_iv,delivery_tag,delivery_ciphertext,
              delivery_fingerprint,quote_snapshot,quote_fingerprint,partner_slug)
            VALUES($1,$2::bytea,$3::bytea,$4::bytea,$5::bytea,$6::jsonb,$7,$8)
            ON CONFLICT DO NOTHING RETURNING order_id`,
          [claims.orderId,sealed.iv,sealed.tag,sealed.ciphertext,
            sealed.fingerprint,JSON.stringify(quote),quote.quoteFingerprint,quote.partnerSlug],
        );
        if (inserted.rowCount!==1) throw new Error('guest_context_duplicate_record');
        const moved=await client.query<{order_id:string}>(
          `UPDATE da_guest_checkout_sessions
              SET state='quoted',quoted_amount_cents=$2,quoted_currency='eur',
                  quote_fingerprint=$3,updated_at=now()
            WHERE order_id=$1 AND state='issued'
            RETURNING order_id`,[claims.orderId,quote.total,quote.quoteFingerprint],
        );
        if (moved.rowCount!==1) throw new Error('guest_context_quote_transition_failed');
      } else if (row.state==='quoted') {
        const existing=await client.query<Record<string,any>>(
          `SELECT delivery_fingerprint,quote_fingerprint
            FROM da_guest_order_context WHERE order_id=$1`,[claims.orderId],
        );
        const same=existing.rows[0] &&
          Buffer.from(existing.rows[0].delivery_fingerprint).equals(sealed.fingerprint) &&
          existing.rows[0].quote_fingerprint===quote.quoteFingerprint;
        if (!same) throw new Error('guest_context_immutable_after_quote');
      } else {
        throw new Error('guest_context_already_in_payment');
      }
      await client.query('COMMIT');open=false;
      return {
        ok:true,orderId:claims.orderId,mutationId:claims.mutationId,
        state:'quoted',total:quote.total,currency:quote.currency,
        partnerSlug:quote.partnerSlug,quoteFingerprint:quote.quoteFingerprint,
        expiresAt:new Date(claims.expiresAt*1000).toISOString(),
      };
    } catch(error) {
      if (open) await client.query('ROLLBACK').catch(()=>undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
