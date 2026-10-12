/**
 * Native Client realm v1: SECOND authorization barrier after signed OIDC JWT.
 *
 * CANDIDATE / NOT WIRED TO PRODUCTION ROUTES. DO NOT DEPLOY ALONE.
 *
 * Caller MUST pass only claims verified cryptographically by an issuer-pinned
 * JWKS verifier, and load the ledger from an authoritative database. Never
 * construct verification evidence or ledger from client input or cached badges.
 *
 * Pure fail-closed policy; NOT a JWT verifier, SMS provider verifier, database
 * transaction, or permission to enable Stripe, enrollment or production.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

type JsonObject = Record<string, unknown>;

export type NativeClientCommerceClaims = {
  iss?: unknown;
  sub?: unknown;
  azp?: unknown;
  aud?: unknown;
  iat?: unknown;
  exp?: unknown;
  email?: unknown;
  email_verified?: unknown;
  realm_access?: unknown;
  resource_access?: unknown;
};

export type NativeClientVerifierEvidence = {
  /** Emitted only by the independent cryptographic JWKS verifier. */
  signatureVerified: boolean;
  issuerKeysPinned: boolean;
  claims: NativeClientCommerceClaims;
};

export type NativeClientDurableLedger = {
  schemaVersion: 1;
  status: 'approved' | 'pending' | 'revoked' | 'needs_review';
  subjectId: string;
  emailBindingHmac: string;
  smsRecipientHmac: string;
  smsVerifiedSubjectId: string;
  emailVerifiedSubjectId: string;
  providerSmsProofAccepted: boolean;
  providerEmailProofAccepted: boolean;
  transactionCommittedAtSeconds: number;
  revokedAtSeconds?: number | null;
};

export type NativeClientCommerceTrust = {
  /** Reviewed, server-controlled exact issuer allowlist (HTTPS only). */
  issuer: string;
  clientId: string;
  audience: string;
  emailHmacSecret: string;
  nowSeconds: number;
};

export type NativeClientCommerceDenial =
  | 'native_jwt_not_cryptographically_verified'
  | 'native_client_issuer_not_allowlisted'
  | 'native_client_claims_invalid'
  | 'native_client_token_expired'
  | 'native_client_subject_missing'
  | 'native_client_audience_invalid'
  | 'native_client_email_not_verified'
  | 'native_client_roles_unsafe'
  | 'native_client_ledger_missing'
  | 'native_client_ledger_not_approved'
  | 'native_client_ledger_binding_mismatch'
  | 'native_client_ledger_sms_not_authorized'
  | 'native_client_ledger_commit_invalid';

function obj(input: unknown): JsonObject | null {
  return input !== null && typeof input === 'object' && !Array.isArray(input)
    ? input as JsonObject
    : null;
}
function strArray(input: unknown): string[] | null {
  return Array.isArray(input) && input.every(x => typeof x === 'string')
    ? input as string[] : null;
}
function validEpoch(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
function equalHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(a) || !/^[0-9a-f]{64}$/.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

export function nativeClientEmailBindingHmac(secret: string, email: string): string {
  if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('native_email_hmac_secret_missing');
  }
  const normalized = String(email || '').trim().toLowerCase();
  if (normalized.length < 3 || normalized.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('native_email_invalid');
  }
  return createHmac('sha256', secret)
    .update('native-client-email-v1')
    .update('\u0000')
    .update(normalized)
    .digest('hex');
}

/**
 * Null = both a separately verified signed Client identity AND a durable,
 * authoritative e-mail/SMS admission record match. The caller must also
 * enforce product RBAC, order idempotency and payment rules independently.
 */
export function evaluateNativeClientCommerce(
  verified: NativeClientVerifierEvidence | null,
  ledger: NativeClientDurableLedger | null,
  trust: NativeClientCommerceTrust,
): NativeClientCommerceDenial | null {
  if (verified?.signatureVerified !== true || verified.issuerKeysPinned !== true) {
    return 'native_jwt_not_cryptographically_verified';
  }
  let configuredRealm: string;
  try {
    const issuer = new URL(trust.issuer);
    if (issuer.protocol !== 'https:' || issuer.username || issuer.password ||
        issuer.search || issuer.hash || issuer.port ||
        !/^\/realms\/[a-zA-Z0-9_-]+$/.test(issuer.pathname) ||
        !trust.clientId || !trust.audience) {
      return 'native_client_issuer_not_allowlisted';
    }
    configuredRealm = issuer.pathname.split('/').pop() || '';
  } catch {
    return 'native_client_issuer_not_allowlisted';
  }
  const claims = verified.claims;
  if (!claims || claims.iss !== trust.issuer ||
      claims.azp !== trust.clientId || !validEpoch(trust.nowSeconds)) {
    return 'native_client_claims_invalid';
  }
  if (!validEpoch(claims.iat) || !validEpoch(claims.exp) ||
      claims.iat > trust.nowSeconds + 60 || claims.exp <= trust.nowSeconds ||
      claims.exp < claims.iat) {
    return 'native_client_token_expired';
  }
  const sub = typeof claims.sub === 'string' ? claims.sub : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sub)) {
    return 'native_client_subject_missing';
  }
  const aud = typeof claims.aud === 'string' ? [claims.aud] : strArray(claims.aud);
  if (!aud || !aud.includes(trust.audience) ||
      aud.some(x => x !== trust.audience && x !== 'account')) {
    return 'native_client_audience_invalid';
  }
  if (claims.email_verified !== true || typeof claims.email !== 'string') {
    return 'native_client_email_not_verified';
  }

  const roles = strArray(obj(claims.realm_access)?.roles);
  const allowedRoles = new Set([
    'client', 'default-roles-' + configuredRealm,
    'offline_access', 'uma_authorization',
  ]);
  if (!roles || !roles.includes('client') ||
      roles.some(x => !allowedRoles.has(x))) {
    return 'native_client_roles_unsafe';
  }
  const resources = claims.resource_access === undefined
    ? {} : obj(claims.resource_access);
  if (!resources) return 'native_client_roles_unsafe';
  for (const [client, access] of Object.entries(resources)) {
    const grants = strArray(obj(access)?.roles);
    if (!grants || (client !== 'account' && grants.length !== 0)) {
      return 'native_client_roles_unsafe';
    }
  }

  if (!ledger || ledger.schemaVersion !== 1) return 'native_client_ledger_missing';
  if (ledger.status !== 'approved' ||
      (ledger.revokedAtSeconds !== undefined && ledger.revokedAtSeconds !== null)) {
    return 'native_client_ledger_not_approved';
  }
  if (ledger.subjectId !== sub ||
      ledger.smsVerifiedSubjectId !== sub ||
      ledger.emailVerifiedSubjectId !== sub) {
    return 'native_client_ledger_binding_mismatch';
  }
  let binding: string;
  try {
    binding = nativeClientEmailBindingHmac(trust.emailHmacSecret, claims.email);
  } catch {
    return 'native_client_ledger_binding_mismatch';
  }
  if (!equalHex(ledger.emailBindingHmac, binding)) {
    return 'native_client_ledger_binding_mismatch';
  }
  if (ledger.providerSmsProofAccepted !== true ||
      ledger.providerEmailProofAccepted !== true ||
      typeof ledger.smsRecipientHmac !== 'string' ||
      !/^[0-9a-f]{64}$/.test(ledger.smsRecipientHmac)) {
    return 'native_client_ledger_sms_not_authorized';
  }
  if (!validEpoch(ledger.transactionCommittedAtSeconds) ||
      ledger.transactionCommittedAtSeconds > trust.nowSeconds) {
    return 'native_client_ledger_commit_invalid';
  }
  return null;
}
