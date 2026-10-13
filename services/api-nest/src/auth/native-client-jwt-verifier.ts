/**
 * Candidate dedicated Client-realm JWT verification, NOT WIRED TO PRODUCTION.
 *
 * The caller is responsible for acquiring JWKS from a separately reviewed,
 * issuer-pinned trusted source. Never use jku/x5u from JWT headers, tenant
 * input or JWKS fetched using an untrusted issuer. No network occurs here.
 *
 * The verifier returns internal trust evidence for the independent commerce
 * admission gate ONLY after RSA signature + issuer/aud/azp/time validation.
 * Business roles and durable e-mail/SMS ledger are checked separately.
 */
import * as crypto from 'node:crypto';
import type {
  NativeClientCommerceClaims,
  NativeClientVerifierEvidence,
} from './native-client-commerce.policy';

type JsonObject = Record<string, unknown>;
export type NativeClientRsaJwk = {
  kty?: unknown;
  kid?: unknown;
  alg?: unknown;
  use?: unknown;
  n?: unknown;
  e?: unknown;
};
export type NativeClientIssuerPinnedJwks = {
  /** Exactly the reviewed issuer; never a value obtained from the JWT. */
  issuer: string;
  /** True ONLY when the real JWKS resolver checked issuer and discovery. */
  provenanceVerified: boolean;
  keys: readonly NativeClientRsaJwk[];
};
export type NativeClientJwtVerifyConfig = {
  issuer: string;
  clientId: string;
  audience: string;
  nowSeconds: number;
  maxTokenLifetimeSeconds: number;
};
export type NativeClientJwtRejection =
  | 'native_signature_provenance_untrusted'
  | 'native_jwt_malformed'
  | 'native_jwt_algorithm_rejected'
  | 'native_jwt_key_not_pinned'
  | 'native_jwt_signature_invalid'
  | 'native_jwt_claims_invalid'
  | 'native_jwt_issuer_invalid'
  | 'native_jwt_audience_invalid'
  | 'native_jwt_subject_invalid'
  | 'native_jwt_expired_or_unbounded';

export type NativeClientJwtVerification =
  | { ok: true; evidence: NativeClientVerifierEvidence }
  | { ok: false; reason: NativeClientJwtRejection };

function isObj(v: unknown): v is JsonObject {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
function parsePart(value: string): JsonObject | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > 24000) return null;
  try {
    const obj = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    return isObj(obj) ? obj : null;
  } catch {
    return null;
  }
}
function validIssuer(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      !url.search && !url.hash && !url.port &&
      /^\/realms\/[A-Za-z0-9_-]+$/.test(url.pathname);
  } catch {
    return false;
  }
}
const reject = (reason: NativeClientJwtRejection): NativeClientJwtVerification =>
  ({ ok: false, reason });

export function verifyNativeClientJwt(
  compact: string,
  pinned: NativeClientIssuerPinnedJwks,
  config: NativeClientJwtVerifyConfig,
): NativeClientJwtVerification {
  // The source must be a distinct, server-configured realm JWKS resolver.
  if (!pinned || pinned.provenanceVerified !== true ||
      pinned.issuer !== config.issuer || !validIssuer(config.issuer) ||
      !Array.isArray(pinned.keys) || pinned.keys.length === 0 ||
      pinned.keys.length > 16) {
    return reject('native_signature_provenance_untrusted');
  }
  if (!compact || typeof compact !== 'string' || compact.length > 32768) {
    return reject('native_jwt_malformed');
  }
  const p = compact.split('.');
  if (p.length !== 3 || p.some(x => !/^[A-Za-z0-9_-]+$/.test(x))) {
    return reject('native_jwt_malformed');
  }
  const header = parsePart(p[0]);
  const claims = parsePart(p[1]);
  if (!header || !claims) return reject('native_jwt_malformed');
  if (header.alg !== 'RS256' ||
      (header.typ !== undefined && header.typ !== 'at+jwt' && header.typ !== 'JWT') ||
      header.jku !== undefined || header.x5u !== undefined || header.crit !== undefined) {
    return reject('native_jwt_algorithm_rejected');
  }
  const kid = typeof header.kid === 'string' ? header.kid : '';
  if (kid.length < 1 || kid.length > 128) return reject('native_jwt_key_not_pinned');
  const matches = pinned.keys.filter(k => k.kid === kid && k.kty === 'RSA' &&
    (k.use === undefined || k.use === 'sig') &&
    (k.alg === undefined || k.alg === 'RS256') &&
    typeof k.n === 'string' && typeof k.e === 'string');
  // No duplicate kid or alternate-alg key fallback.
  if (matches.length !== 1) return reject('native_jwt_key_not_pinned');
  try {
    const key = crypto.createPublicKey({ key: matches[0] as any, format: 'jwk' });
    if (!crypto.verify('RSA-SHA256',Buffer.from(p[0]+'.'+p[1]),
      key,Buffer.from(p[2],'base64url'))) {
      return reject('native_jwt_signature_invalid');
    }
  } catch {
    return reject('native_jwt_signature_invalid');
  }

  const now = config.nowSeconds;
  if (!Number.isInteger(now) || now <= 0 ||
      !Number.isInteger(config.maxTokenLifetimeSeconds) ||
      config.maxTokenLifetimeSeconds < 60 ||
      config.maxTokenLifetimeSeconds > 3600) {
    return reject('native_jwt_claims_invalid');
  }
  if (claims.iss !== config.issuer) return reject('native_jwt_issuer_invalid');
  const audiences = typeof claims.aud === 'string' ?
    [claims.aud] : Array.isArray(claims.aud) ? claims.aud : null;
  if (!audiences || !audiences.includes(config.audience) ||
      !audiences.every(a => typeof a === 'string' &&
        (a === config.audience || a === 'account')) ||
      claims.azp !== config.clientId) {
    return reject('native_jwt_audience_invalid');
  }
  if (typeof claims.sub !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(claims.sub)) {
    return reject('native_jwt_subject_invalid');
  }
  const exp=claims.exp,iat=claims.iat,nbf=claims.nbf;
  if (typeof exp !== 'number' || !Number.isInteger(exp) ||
      typeof iat !== 'number' || !Number.isInteger(iat) ||
      exp <= now || iat > now + 60 || exp < iat ||
      exp - iat > config.maxTokenLifetimeSeconds ||
      (nbf !== undefined && (typeof nbf !== 'number' ||
        !Number.isInteger(nbf) || nbf > now + 60))) {
    return reject('native_jwt_expired_or_unbounded');
  }
  return {
    ok: true,
    evidence: {
      signatureVerified: true,
      issuerKeysPinned: true,
      claims: claims as NativeClientCommerceClaims,
    },
  };
}
