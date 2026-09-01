import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as https from 'node:https';
import * as path from 'node:path';
import type { DaAuthTokenPayload } from './auth.types';
import type {
  DaExternalTokenVerification,
  DaTrustedIdentityConfig,
  DaTrustedIdentityHealth,
} from './external-jwks-verifier.types';

type JsonObject = Record<string, unknown>;
type CachedKey = {
  kid: string;
  alg: 'RS256';
  key: crypto.KeyObject;
};

const CONFIG_PATH = path.resolve(
  __dirname,
  '../../.runtime-config/keycloak-trusted-identity.json',
);
const MAX_RESPONSE_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 7000;
const CLIENT_AUDIENCE = 'delishafrica-client';
const COURIER_AUDIENCE = 'delishafrica-courier';
const DASHBOARD_AUDIENCE = 'delishafrica-master-dashboard';

@Injectable()
export class ExternalJwksVerifierService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly config: DaTrustedIdentityConfig;
  private readonly keys = new Map<string, CachedKey>();
  private refreshTimer: NodeJS.Timeout | null = null;
  private refreshPromise: Promise<void> | null = null;
  private ready = false;
  private lastRefreshAt: string | null = null;
  private lastError: string | null = null;

  constructor() {
    this.config = this.readConfig();
  }

  async onModuleInit(): Promise<void> {
    await this.refreshKeys();
    this.refreshTimer = setInterval(
      () => void this.refreshKeys(),
      this.config.refreshSeconds * 1000,
    );
    this.refreshTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = null;
  }

  health(): DaTrustedIdentityHealth {
    return {
      ok: this.ready,
      service: 'trusted-identity-jwks-verifier',
      ready: this.ready,
      issuer: this.config.issuer,
      discoveryUrl: this.config.discoveryUrl,
      advertisedJwksUrl: this.config.advertisedJwksUrl,
      audience: this.config.audience,
      clientAudience: CLIENT_AUDIENCE,
      courierAudience: COURIER_AUDIENCE,
      opsAudience: DASHBOARD_AUDIENCE,
      supportedRoles: ['client', 'merchant', 'courier', 'ops'],
      jwksUrl: this.config.jwksUrl,
      allowedAlgorithms: [...this.config.allowedAlgorithms],
      keyCount: this.keys.size,
      lastRefreshAt: this.lastRefreshAt,
      lastError: this.lastError,
      ownershipEligibleRole: 'merchant',
      devLoginAccepted: false,
    };
  }

  async verifyToken(token: string): Promise<DaExternalTokenVerification> {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return { ok: false, reason: 'malformed_token' };

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = this.decodeJson(encodedHeader);
    const claims = this.decodeJson(encodedPayload);
    if (!header || !claims) return { ok: false, reason: 'malformed_token' };

    if (header.alg !== 'RS256') {
      return { ok: false, reason: 'unsupported_algorithm' };
    }
    if (
      header.typ !== undefined &&
      header.typ !== 'JWT' &&
      header.typ !== 'at+jwt'
    ) {
      return { ok: false, reason: 'malformed_token' };
    }

    const kid = typeof header.kid === 'string' ? header.kid.trim() : '';
    if (!kid) return { ok: false, reason: 'unknown_signing_key' };

    if (!this.ready || this.keys.size === 0) await this.refreshKeys();
    let cached = this.keys.get(kid);
    if (!cached) {
      await this.refreshKeys();
      cached = this.keys.get(kid);
    }
    if (!this.ready) {
      return { ok: false, reason: 'trusted_identity_not_ready' };
    }
    if (!cached) return { ok: false, reason: 'unknown_signing_key' };

    let signature: Buffer;
    try {
      signature = Buffer.from(encodedSignature, 'base64url');
    } catch {
      return { ok: false, reason: 'malformed_token' };
    }

    const verified = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${encodedHeader}.${encodedPayload}`, 'ascii'),
      cached.key,
      signature,
    );
    if (!verified) return { ok: false, reason: 'invalid_signature' };

    if (claims.iss !== this.config.issuer) {
      return { ok: false, reason: 'issuer_mismatch' };
    }
    const externalRole = this.resolveExternalRole(claims);
    if (!externalRole) {
      return { ok: false, reason: 'audience_mismatch' };
    }
    if (externalRole === 'client') {
      if (!this.hasClientAuthorizedParty(claims)) {
        return { ok: false, reason: 'authorized_party_mismatch' };
      }
      if (!this.hasClientRole(claims)) {
        return { ok: false, reason: 'client_role_missing' };
      }
    }
    if (externalRole === 'ops') {
      if (!this.hasOpsAuthorizedParty(claims)) {
        return { ok: false, reason: 'authorized_party_mismatch' };
      }
      if (!this.hasOpsRole(claims)) {
        return { ok: false, reason: 'ops_role_missing' };
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const skew = this.config.clockSkewSeconds;
    const exp = this.numericDate(claims.exp);
    const iat = this.numericDate(claims.iat);
    const nbf = claims.nbf === undefined ? null : this.numericDate(claims.nbf);

    if (exp === null || exp <= now - skew) {
      return { ok: false, reason: 'token_expired' };
    }
    if (iat === null || iat > now + skew) {
      return { ok: false, reason: 'issued_in_future' };
    }
    if (nbf !== null && nbf > now + skew) {
      return { ok: false, reason: 'token_not_active' };
    }

    const subject = typeof claims.sub === 'string' ? claims.sub.trim() : '';
    if (!subject) return { ok: false, reason: 'subject_missing' };
    if (externalRole === 'merchant' && !this.hasMerchantRole(claims)) {
      return { ok: false, reason: 'merchant_role_missing' };
    }
    if (externalRole === 'courier' && !this.hasCourierRole(claims)) {
      return { ok: false, reason: 'courier_role_missing' };
    }

    const name = this.firstString(
      externalRole === 'client'
        ? 'Client DelishAfrica'
        : externalRole === 'courier'
          ? 'Courier DelishAfrica'
          : externalRole === 'ops'
            ? 'DelishAfrica Ops'
            : 'Merchant DelishAfrica',
      claims.name,
      claims.preferred_username,
      claims.email,
      subject,
    );
    const email = typeof claims.email === 'string' ? claims.email : undefined;
    const audience = Array.isArray(claims.aud)
      ? claims.aud.filter((value): value is string => typeof value === 'string')
      : String(claims.aud || '');

    const payload: DaAuthTokenPayload = {
      sub: subject,
      role: externalRole,
      name,
      email,
      ...(externalRole === 'client' ? { clientId: subject } : {}),
      authSource: 'external',
      iat,
      exp,
      iss: this.config.issuer,
      aud: audience,
      azp: typeof claims.azp === 'string' ? claims.azp.trim() : undefined,
      sid: typeof claims.sid === 'string' && claims.sid.trim() ? claims.sid.trim() : undefined,
      jti: typeof claims.jti === 'string' && claims.jti.trim() ? claims.jti.trim() : undefined,
    };

    return { ok: true, payload };
  }

  private async refreshKeys(): Promise<void> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = this.refreshKeysInternal().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private async refreshKeysInternal(): Promise<void> {
    try {
      const discovery = await this.requestJson(this.config.discoveryUrl);
      if (discovery.issuer !== this.config.issuer) {
        throw new Error('discovery_issuer_mismatch');
      }
      if (discovery.jwks_uri !== this.config.advertisedJwksUrl) {
        throw new Error('discovery_jwks_uri_mismatch');
      }

      const jwks = await this.requestJson(this.config.jwksUrl);
      const rawKeys = Array.isArray(jwks.keys) ? jwks.keys : [];
      const next = new Map<string, CachedKey>();

      for (const candidate of rawKeys) {
        if (!candidate || typeof candidate !== 'object') continue;
        const jwk = candidate as JsonObject;
        const kid = typeof jwk.kid === 'string' ? jwk.kid.trim() : '';
        const kty = typeof jwk.kty === 'string' ? jwk.kty : '';
        const use = typeof jwk.use === 'string' ? jwk.use : undefined;
        const alg = typeof jwk.alg === 'string' ? jwk.alg : undefined;
        if (!kid || kty !== 'RSA') continue;
        if (use && use !== 'sig') continue;
        if (alg && alg !== 'RS256') continue;

        try {
          const key = crypto.createPublicKey({ key: jwk as any, format: 'jwk' });
          next.set(kid, { kid, alg: 'RS256', key });
        } catch {
          // Invalid or unsupported key: ignore it and keep the gate closed if none remain.
        }
      }

      if (next.size === 0) throw new Error('jwks_contains_no_usable_rs256_key');
      this.keys.clear();
      for (const [kid, value] of next) this.keys.set(kid, value);
      this.ready = true;
      this.lastRefreshAt = new Date().toISOString();
      this.lastError = null;
    } catch (error) {
      this.ready = false;
      this.lastError = this.sanitizeError(error);
    }
  }

  private requestJson(urlValue: string): Promise<JsonObject> {
    return new Promise((resolve, reject) => {
      const url = new URL(urlValue);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        reject(new Error('unsupported_jwks_protocol'));
        return;
      }
      const client = url.protocol === 'https:' ? https : http;
      const request = client.get(
        url,
        { timeout: REQUEST_TIMEOUT_MS, headers: { accept: 'application/json' } },
        (response) => {
          const status = response.statusCode || 0;
          if (status !== 200) {
            response.resume();
            reject(new Error(`trusted_identity_http_${status}`));
            return;
          }

          const chunks: Buffer[] = [];
          let size = 0;
          response.on('data', (chunk: Buffer | string) => {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            size += buffer.length;
            if (size > MAX_RESPONSE_BYTES) {
              request.destroy(new Error('trusted_identity_response_too_large'));
              return;
            }
            chunks.push(buffer);
          });
          response.on('end', () => {
            try {
              const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
              if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                reject(new Error('trusted_identity_invalid_json_object'));
                return;
              }
              resolve(parsed as JsonObject);
            } catch {
              reject(new Error('trusted_identity_invalid_json'));
            }
          });
        },
      );
      request.on('timeout', () => request.destroy(new Error('trusted_identity_timeout')));
      request.on('error', reject);
    });
  }

  private decodeJson(value: string): JsonObject | null {
    try {
      if (!value || value.length > 65536) return null;
      const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      return parsed as JsonObject;
    } catch {
      return null;
    }
  }

  private audienceIncludes(value: unknown, expected: string): boolean {
    if (typeof value === 'string') return value === expected;
    return Array.isArray(value) && value.includes(expected);
  }

  private resolveExternalRole(
    claims: JsonObject,
  ): 'client' | 'merchant' | 'courier' | 'ops' | null {
    // Audience selects the trusted application role. Ops is deliberately
    // checked first: a token carrying the Dashboard audience must satisfy the
    // Dashboard-specific azp + resource_access role gates below and must never
    // fall through to a less privileged application role.
    if (this.audienceIncludes(claims.aud, DASHBOARD_AUDIENCE)) return 'ops';
    if (this.audienceIncludes(claims.aud, CLIENT_AUDIENCE)) return 'client';
    if (this.audienceIncludes(claims.aud, COURIER_AUDIENCE)) return 'courier';
    if (this.audienceIncludes(claims.aud, this.config.audience)) return 'merchant';
    return null;
  }

  private hasOpsAuthorizedParty(claims: JsonObject): boolean {
    return (
      typeof claims.azp === 'string' &&
      claims.azp.trim() === DASHBOARD_AUDIENCE
    );
  }

  private hasOpsRole(claims: JsonObject): boolean {
    const resourceAccess = claims.resource_access as JsonObject | undefined;
    const dashboardAccess = resourceAccess?.[DASHBOARD_AUDIENCE] as
      | JsonObject
      | undefined;
    const dashboardRoles = this.stringArray(dashboardAccess?.roles);
    return dashboardRoles.includes('ops');
  }

  private hasClientAuthorizedParty(claims: JsonObject): boolean {
    return typeof claims.azp === 'string' && claims.azp.trim() === CLIENT_AUDIENCE;
  }

  private hasClientRole(claims: JsonObject): boolean {
    const realmRoles = this.stringArray(
      (claims.realm_access as JsonObject | undefined)?.roles,
    );
    return realmRoles.includes('client');
  }

  private hasMerchantRole(claims: JsonObject): boolean {
    const realmRoles = this.stringArray(
      (claims.realm_access as JsonObject | undefined)?.roles,
    );
    if (this.config.merchantRealmRoles.some((role) => realmRoles.includes(role))) {
      return true;
    }

    const resourceAccess = claims.resource_access as JsonObject | undefined;
    const clientAccess = resourceAccess?.[this.config.audience] as
      | JsonObject
      | undefined;
    const clientRoles = this.stringArray(clientAccess?.roles);
    return this.config.merchantClientRoles.some((role) =>
      clientRoles.includes(role),
    );
  }

  private hasCourierRole(claims: JsonObject): boolean {
    const realmRoles = this.stringArray(
      (claims.realm_access as JsonObject | undefined)?.roles,
    );
    if (realmRoles.includes('courier')) return true;

    const resourceAccess = claims.resource_access as JsonObject | undefined;
    const courierAccess = resourceAccess?.[COURIER_AUDIENCE] as
      | JsonObject
      | undefined;
    const courierRoles = this.stringArray(courierAccess?.roles);
    return courierRoles.includes('courier');
  }

  private stringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
  }

  private numericDate(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value)
      ? Math.trunc(value)
      : null;
  }

  private firstString(fallback: string, ...values: unknown[]): string {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return fallback;
  }

  private readConfig(): DaTrustedIdentityConfig {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as JsonObject;
    const issuer = String(parsed.issuer || '').replace(/\/$/, '');
    const discoveryUrl = String(
      parsed.discoveryUrl || `${issuer}/.well-known/openid-configuration`,
    );
    const advertisedJwksUrl = String(parsed.advertisedJwksUrl || parsed.jwksUrl || '');
    const jwksUrl = String(parsed.jwksUrl || '');
    const audience = String(parsed.audience || '');
    const allowedAlgorithms = parsed.allowedAlgorithms;
    const merchantRealmRoles = this.stringArray(parsed.merchantRealmRoles);
    const merchantClientRoles = this.stringArray(parsed.merchantClientRoles);
    const clockSkewSeconds = Number(parsed.clockSkewSeconds);
    const refreshSeconds = Number(parsed.refreshSeconds);

    if (!issuer || !discoveryUrl || !advertisedJwksUrl || !jwksUrl || !audience) {
      throw new Error('trusted_identity_config_missing');
    }
    for (const [name, value] of [
      ['issuer', issuer],
      ['discoveryUrl', discoveryUrl],
      ['advertisedJwksUrl', advertisedJwksUrl],
      ['jwksUrl', jwksUrl],
    ] as const) {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(value);
      } catch {
        throw new Error(`trusted_identity_${name}_invalid`);
      }
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error(`trusted_identity_${name}_protocol_invalid`);
      }
    }
    if (!Array.isArray(allowedAlgorithms) || allowedAlgorithms.length !== 1 || allowedAlgorithms[0] !== 'RS256') {
      throw new Error('trusted_identity_algorithms_must_be_rs256_only');
    }
    if (merchantRealmRoles.length === 0 && merchantClientRoles.length === 0) {
      throw new Error('trusted_identity_merchant_roles_missing');
    }
    if (!Number.isFinite(clockSkewSeconds) || clockSkewSeconds < 0 || clockSkewSeconds > 120) {
      throw new Error('trusted_identity_clock_skew_invalid');
    }
    if (!Number.isFinite(refreshSeconds) || refreshSeconds < 60 || refreshSeconds > 3600) {
      throw new Error('trusted_identity_refresh_interval_invalid');
    }

    return {
      issuer,
      discoveryUrl,
      advertisedJwksUrl,
      jwksUrl,
      audience,
      allowedAlgorithms: ['RS256'],
      merchantRealmRoles,
      merchantClientRoles,
      clockSkewSeconds: Math.trunc(clockSkewSeconds),
      refreshSeconds: Math.trunc(refreshSeconds),
    };
  }

  private sanitizeError(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error || 'unknown_error');
    return raw.replace(/[\r\n\t]/g, ' ').replace(/[^a-zA-Z0-9_.:-]/g, '_').slice(0, 180);
  }
}
