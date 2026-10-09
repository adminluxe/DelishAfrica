import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * DelishAfrica guest checkout — isolated cryptographic primitive (v1).
 *
 * A capability proves possession of one specific checkout, never account identity.
 * It is deliberately NOT accepted by OrdersAuthGuard or PaymentsAuthGuard in stage 1.
 * Do not enable payments until independent server-side post-Stripe finalisation
 * and durable storage have passed the security gate.
 *
 * The envelope is signed (NOT encrypted); do not put PII in its claims.
 */
export const GUEST_TOKEN_PREFIX = 'dagc1';
export const GUEST_CHECKOUT_TTL_SECONDS = 4 * 60 * 60;
const ISSUER = 'urn:delishafrica:guest-checkout:v1';
const AUDIENCE = 'delishafrica:guest-checkout';
const SCOPE = 'checkout:single-order' as const;

export type GuestCheckoutClaims = {
  version: 1;
  issuer: typeof ISSUER;
  audience: typeof AUDIENCE;
  scope: typeof SCOPE;
  subject: string;
  orderId: string;
  mutationId: string;
  issuedAt: number;
  expiresAt: number;
};

export type NewGuestCheckout = {
  token: string;
  orderId: string;
  mutationId: string;
  expiresAt: string;
};

const ORDER_RE = /^DA-G-[a-f0-9]{32}$/;
const SUBJECT_RE = /^guest_[a-f0-9]{32}$/;
const MUTATION_RE = /^guest:DA-G-[a-f0-9]{32}$/;

function secureKey(key: Buffer): void {
  if (!Buffer.isBuffer(key) || key.length < 32) {
    throw new Error('guest_capability_strong_key_required');
  }
}

/** Secret must be 32+ random bytes in canonical unpadded base64url notation. */
export function loadGuestCapabilityKey(encoded: string | undefined): Buffer | null {
  if (!encoded || !/^[A-Za-z0-9_-]{43,}$/.test(encoded)) return null;
  let key: Buffer;
  try {
    key = Buffer.from(encoded, 'base64url');
  } catch {
    return null;
  }
  return key.length >= 32 && key.toString('base64url') === encoded ? key : null;
}

function sign(key: Buffer, body: string): Buffer {
  return createHmac('sha256', key)
    .update(`${GUEST_TOKEN_PREFIX}.${body}`, 'utf8')
    .digest();
}

/** Mint every identifier on the server. Never accept a client-supplied order ID. */
export function createGuestCheckoutCapability(
  key: Buffer,
  nowMs = Date.now(),
): NewGuestCheckout {
  secureKey(key);
  if (!Number.isFinite(nowMs) || nowMs < 0) throw new Error('guest_capability_clock_invalid');

  const orderId = `DA-G-${randomBytes(16).toString('hex')}`;
  const mutationId = `guest:${orderId}`;
  const issuedAt = Math.floor(nowMs / 1000);
  const claims: GuestCheckoutClaims = {
    version: 1,
    issuer: ISSUER,
    audience: AUDIENCE,
    scope: SCOPE,
    subject: `guest_${randomBytes(16).toString('hex')}`,
    orderId,
    mutationId,
    issuedAt,
    expiresAt: issuedAt + GUEST_CHECKOUT_TTL_SECONDS,
  };

  const body = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const signature = sign(key, body).toString('base64url');

  return {
    token: `${GUEST_TOKEN_PREFIX}.${body}.${signature}`,
    orderId,
    mutationId,
    expiresAt: new Date(claims.expiresAt * 1000).toISOString(),
  };
}

/** Verify a bounded, signed, single-order claim; returns null on any failure. */
export function verifyGuestCheckoutCapability(
  key: Buffer,
  token: string,
  nowMs = Date.now(),
): GuestCheckoutClaims | null {
  secureKey(key);
  if (typeof token !== 'string' || token.length > 2048 || token.length < 80) return null;
  if (!Number.isFinite(nowMs) || nowMs < 0) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== GUEST_TOKEN_PREFIX) return null;
  const [, body, encodedMac] = parts;
  if (!/^[A-Za-z0-9_-]+$/.test(body) || !/^[A-Za-z0-9_-]{43}$/.test(encodedMac)) return null;

  let claims: unknown;
  try {
    const mac = Buffer.from(encodedMac, 'base64url');
    const expected = sign(key, body);
    if (mac.length !== expected.length || !timingSafeEqual(mac, expected)) return null;
    const bytes = Buffer.from(body, 'base64url');
    if (bytes.length > 768 || bytes.toString('base64url') !== body) return null;
    claims = JSON.parse(bytes.toString('utf8'));
  } catch {
    return null;
  }
  if (!claims || typeof claims !== 'object' || Array.isArray(claims)) return null;
  const c = claims as Record<string, unknown>;
  const now = Math.floor(nowMs / 1000);
  if (
    c.version !== 1 ||
    c.issuer !== ISSUER ||
    c.audience !== AUDIENCE ||
    c.scope !== SCOPE ||
    typeof c.subject !== 'string' || !SUBJECT_RE.test(c.subject) ||
    typeof c.orderId !== 'string' || !ORDER_RE.test(c.orderId) ||
    typeof c.mutationId !== 'string' || !MUTATION_RE.test(c.mutationId) ||
    c.mutationId !== `guest:${c.orderId}` ||
    typeof c.issuedAt !== 'number' || !Number.isInteger(c.issuedAt) ||
    typeof c.expiresAt !== 'number' || !Number.isInteger(c.expiresAt) ||
    c.issuedAt > now + 30 ||
    c.expiresAt <= now ||
    c.expiresAt - c.issuedAt !== GUEST_CHECKOUT_TTL_SECONDS
  ) return null;

  return c as GuestCheckoutClaims;
}

export function guestCapabilityMatchesOrder(
  claims: GuestCheckoutClaims,
  orderId: string,
  mutationId: string,
): boolean {
  return claims.orderId === orderId && claims.mutationId === mutationId;
}
