import type {
  DaOidcJwtClaims,
  DaOidcJwtHeader,
  DaOidcSession,
  DaOidcUserInfo,
  DaOidcValidationResult,
} from './daOidcTypes';
import { DaOidcError } from './daOidcTypes';
import { DA_OIDC_CONFIG } from './daOidcConfig';

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  let buffer = 0;
  let bits = 0;
  let out = '';

  for (const char of padded) {
    if (char === '=') break;
    const index = BASE64_ALPHABET.indexOf(char);
    if (index < 0) throw new DaOidcError('jwt_base64_invalid', 'Jeton JWT mal encodé.');
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }

  return out;
}

function decodeUtf8(binary: string): string {
  let encoded = '';
  for (let index = 0; index < binary.length; index += 1) {
    encoded += `%${binary.charCodeAt(index).toString(16).padStart(2, '0')}`;
  }
  try {
    return decodeURIComponent(encoded);
  } catch {
    throw new DaOidcError('jwt_utf8_invalid', 'Jeton JWT illisible.');
  }
}

function parseJwtPart<T>(value: string): T {
  try {
    return JSON.parse(decodeUtf8(decodeBase64(value))) as T;
  } catch (error) {
    if (error instanceof DaOidcError) throw error;
    throw new DaOidcError('jwt_json_invalid', 'Jeton JWT invalide.');
  }
}

function splitJwt(token: string): [string, string, string] {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new DaOidcError('jwt_shape_invalid', 'Jeton JWT incomplet.');
  }
  return [parts[0], parts[1], parts[2]];
}

export function decodeJwtHeader(token: string): DaOidcJwtHeader {
  return parseJwtPart<DaOidcJwtHeader>(splitJwt(token)[0]);
}

export function decodeJwtPayload(token: string): DaOidcJwtClaims {
  return parseJwtPart<DaOidcJwtClaims>(splitJwt(token)[1]);
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return typeof value === 'string' ? [value] : [];
}

function assertNumericDate(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new DaOidcError(`jwt_${name}_missing`, `Claim ${name} absent ou invalide.`);
  }
  return value;
}

type JwtValidationOptions = {
  expectedAudience: string;
  expectedNonce?: string;
  enforceExpiry: boolean;
};

function validateJwtContract(
  token: string,
  options: JwtValidationOptions,
): DaOidcValidationResult {
  const header = decodeJwtHeader(token);
  const claims = decodeJwtPayload(token);
  const now = Math.floor(Date.now() / 1000);
  const skew = DA_OIDC_CONFIG.clockSkewSeconds;

  if (header.alg !== 'RS256') {
    throw new DaOidcError('jwt_alg_rejected', 'Algorithme JWT refusé.');
  }
  if (claims.iss !== DA_OIDC_CONFIG.issuer) {
    throw new DaOidcError('jwt_issuer_mismatch', 'Issuer JWT non conforme.');
  }

  const audiences = asStringArray(claims.aud);
  if (!audiences.includes(options.expectedAudience)) {
    throw new DaOidcError('jwt_audience_mismatch', 'Audience JWT non conforme.');
  }
  if (claims.azp && claims.azp !== DA_OIDC_CONFIG.clientId) {
    throw new DaOidcError('jwt_azp_mismatch', 'Authorized party JWT non conforme.');
  }
  if (audiences.length > 1 && claims.azp !== DA_OIDC_CONFIG.clientId) {
    throw new DaOidcError('jwt_azp_missing', 'Authorized party JWT absent.');
  }

  const iat = assertNumericDate(claims.iat, 'iat');
  if (iat > now + skew) {
    throw new DaOidcError('jwt_iat_future', 'Date d’émission JWT incohérente.');
  }
  if (typeof claims.nbf === 'number' && claims.nbf > now + skew) {
    throw new DaOidcError('jwt_not_active', 'Jeton JWT pas encore actif.');
  }
  if (options.enforceExpiry) {
    const exp = assertNumericDate(claims.exp, 'exp');
    if (exp <= now - skew) {
      throw new DaOidcError('jwt_expired', 'Session expirée.', true);
    }
  }
  if (options.expectedNonce !== undefined && claims.nonce !== options.expectedNonce) {
    throw new DaOidcError('jwt_nonce_mismatch', 'Nonce OIDC non conforme.');
  }

  return { header, claims };
}

export function extractExpectedRole(claims: DaOidcJwtClaims): boolean {
  const candidates = new Set<string>();
  for (const role of asStringArray(claims.roles)) candidates.add(role);
  for (const role of asStringArray(claims.role)) candidates.add(role);
  for (const role of asStringArray(claims.realm_access?.roles)) candidates.add(role);
  for (const role of asStringArray(claims.resource_access?.[DA_OIDC_CONFIG.clientId]?.roles)) {
    candidates.add(role);
  }
  return candidates.has(DA_OIDC_CONFIG.role);
}

function assertSubjectPair(access: DaOidcJwtClaims, id: DaOidcJwtClaims): void {
  if (!access.sub || !id.sub || access.sub !== id.sub) {
    throw new DaOidcError('jwt_subject_mismatch', 'Identité JWT incohérente.');
  }
}

export function validateInitialTokenSet(
  accessToken: string,
  idToken: string,
  expectedNonce: string,
): { access: DaOidcValidationResult; id: DaOidcValidationResult } {
  const access = validateJwtContract(accessToken, {
    expectedAudience: DA_OIDC_CONFIG.audience,
    enforceExpiry: true,
  });
  const id = validateJwtContract(idToken, {
    expectedAudience: DA_OIDC_CONFIG.clientId,
    expectedNonce,
    enforceExpiry: true,
  });
  if (!extractExpectedRole(access.claims)) {
    throw new DaOidcError('jwt_role_missing', 'Rôle Keycloak attendu absent.');
  }
  assertSubjectPair(access.claims, id.claims);
  return { access, id };
}

export function validateStoredTokenSet(
  accessToken: string,
  idToken: string,
): { access: DaOidcValidationResult; id: DaOidcValidationResult } {
  const access = validateJwtContract(accessToken, {
    expectedAudience: DA_OIDC_CONFIG.audience,
    enforceExpiry: true,
  });
  // After a refresh, an OIDC provider may omit a replacement ID token.
  // The preserved ID token remains useful for RP-initiated logout, but its
  // expiration must not drive access-token freshness. Its immutable contract
  // (alg/issuer/audience/azp/subject) is still checked.
  const id = validateJwtContract(idToken, {
    expectedAudience: DA_OIDC_CONFIG.clientId,
    enforceExpiry: false,
  });
  if (!extractExpectedRole(access.claims)) {
    throw new DaOidcError('jwt_role_missing', 'Rôle Keycloak attendu absent.');
  }
  assertSubjectPair(access.claims, id.claims);
  return { access, id };
}

export function assertUserInfoMatches(
  claims: DaOidcJwtClaims,
  userInfo: DaOidcUserInfo,
): void {
  if (!claims.sub || !userInfo.sub || claims.sub !== userInfo.sub) {
    throw new DaOidcError('userinfo_subject_mismatch', 'Identité userinfo non conforme.');
  }
}

export function toSafeSession(
  claims: DaOidcJwtClaims,
  userInfo?: DaOidcUserInfo,
): DaOidcSession {
  const subject = typeof claims.sub === 'string' ? claims.sub : undefined;
  const displayName =
    (typeof userInfo?.name === 'string' && userInfo.name) ||
    (typeof claims.name === 'string' && claims.name) ||
    (typeof userInfo?.preferred_username === 'string' && userInfo.preferred_username) ||
    (typeof claims.preferred_username === 'string' && claims.preferred_username) ||
    undefined;
  const email =
    (typeof userInfo?.email === 'string' && userInfo.email) ||
    (typeof claims.email === 'string' && claims.email) ||
    undefined;

  return {
    status: 'authenticated',
    provider: 'keycloak',
    role: DA_OIDC_CONFIG.role,
    subject,
    displayName,
    email,
    issuedAt: typeof claims.iat === 'number' ? claims.iat : undefined,
    expiresAt: typeof claims.exp === 'number' ? claims.exp : undefined,
  };
}
