import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type {
  DaAuthPrincipal,
  DaAuthPrincipalResolution,
  DaAuthRole,
  DaAuthTokenPayload,
  DaAuthTokenSource,
  DaAuthUser,
  DaResolvedAuthSource,
} from './auth.types';
import { ExternalJwksVerifierService } from './external-jwks-verifier.service';

type DevLoginInput = {
  role?: DaAuthRole | string;
  name?: string;
  email?: string;
  merchantSlug?: string;
  courierId?: string;
  clientId?: string;
};

@Injectable()
export class AuthService {
  private readonly issuer = 'delishafrica-api';
  private readonly audience = 'delishafrica-apps';
  private readonly ttlSeconds = 60 * 60 * 24 * 7;

  constructor(private readonly trustedIdentity: ExternalJwksVerifierService) {}

  health() {
    return {
      ok: true,
      service: 'auth',
      mode: 'progressive_nonblocking',
      roles: ['client', 'merchant', 'courier', 'ops'],
      required: false,
      ownershipEligibleSources: ['external'],
      devLoginOwnershipEligible: false,
      trustedIdentity: this.trustedIdentity.health(),
    };
  }

  trustedIdentityHealth() {
    return this.trustedIdentity.health();
  }

  devLogin(input: DevLoginInput = {}) {
    const user = this.makeUser(input);
    const token = this.signUser(user, 'dev-login');
    const payload = this.verifyInternalToken(token);
    const authSource = this.resolveAuthSource(payload?.authSource);

    return {
      ok: true,
      mode: 'dev-login',
      required: false,
      tokenType: 'Bearer',
      accessToken: token,
      token,
      user,
      authSource,
      ownershipEligible: this.isOwnershipEligibleSource(authSource),
      expiresAt: payload ? new Date(payload.exp * 1000).toISOString() : null,
    };
  }

  async meFromAuthorization(authorization?: string) {
    const resolution = await this.resolvePrincipalFromAuthorization(authorization);

    if ('reason' in resolution) {
      return {
        ok: false,
        authenticated: false,
        required: false,
        reason: resolution.reason,
        user: null,
      };
    }

    return {
      ok: true,
      authenticated: true,
      required: false,
      user: this.payloadToUser(resolution.payload),
      principal: resolution.principal,
      payload: resolution.payload,
      authSource: resolution.principal.authSource,
      ownershipEligible: resolution.principal.ownershipEligible,
    };
  }

  async verify(input: { token?: string; accessToken?: string } = {}) {
    const token = input.token || input.accessToken || '';
    const resolution = await this.resolveToken(token);

    if ('reason' in resolution) {
      return {
        ok: false,
        authenticated: false,
        reason: resolution.reason,
      };
    }

    return {
      ok: true,
      authenticated: true,
      user: this.payloadToUser(resolution.payload),
      principal: resolution.principal,
      payload: resolution.payload,
      authSource: resolution.principal.authSource,
      ownershipEligible: resolution.principal.ownershipEligible,
    };
  }

  async resolvePrincipalFromAuthorization(
    authorization?: string,
  ): Promise<DaAuthPrincipalResolution> {
    const token = this.extractBearer(authorization);
    if (!token) {
      return {
        ok: false,
        authenticated: false,
        reason: 'missing_bearer_token',
        principal: null,
      };
    }

    return this.resolveToken(token);
  }

  async resolveToken(token: string): Promise<DaAuthPrincipalResolution> {
    const internalPayload = this.verifyInternalToken(token);
    if (internalPayload) {
      return {
        ok: true,
        authenticated: true,
        principal: this.payloadToPrincipal(internalPayload),
        payload: internalPayload,
      };
    }

    const external = await this.trustedIdentity.verifyToken(token);
    if (external.ok) {
      return {
        ok: true,
        authenticated: true,
        principal: this.payloadToPrincipal(external.payload),
        payload: external.payload,
      };
    }

    return {
      ok: false,
      authenticated: false,
      reason: 'invalid_or_expired_token',
      principal: null,
    };
  }

  private makeUser(input: DevLoginInput): DaAuthUser {
    const role = this.normalizeRole(input.role);
    const name = String(input.name || this.defaultName(role));
    const email = input.email ? String(input.email) : undefined;

    if (role === 'merchant') {
      const merchantSlug = String(input.merchantSlug || 'thieyp');
      return {
        id: `merchant_${merchantSlug}`,
        role,
        name,
        email,
        merchantSlug,
      };
    }

    if (role === 'courier') {
      const courierId = String(input.courierId || 'demo_courier_0001');
      return {
        id: courierId,
        role,
        name,
        email,
        courierId,
      };
    }

    if (role === 'ops') {
      return {
        id: 'demo_ops_0001',
        role,
        name,
        email,
        opsScope: ['orders', 'payments', 'support'],
      };
    }

    const clientId = String(input.clientId || 'demo_client_0001');
    return {
      id: clientId,
      role: 'client',
      name,
      email,
      clientId,
    };
  }

  private defaultName(role: DaAuthRole): string {
    if (role === 'merchant') return 'Partenaire Thieyp';
    if (role === 'courier') return 'Coursier DelishAfrica';
    if (role === 'ops') return 'Ops DelishAfrica';
    return 'Client DelishAfrica';
  }

  private normalizeRole(value: unknown): DaAuthRole {
    const role = String(value || 'client').toLowerCase();

    if (role === 'merchant') return 'merchant';
    if (role === 'courier') return 'courier';
    if (role === 'ops') return 'ops';

    return 'client';
  }

  private signUser(user: DaAuthUser, authSource: DaAuthTokenSource): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: DaAuthTokenPayload = {
      sub: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      merchantSlug: user.merchantSlug,
      courierId: user.courierId,
      clientId: user.clientId,
      opsScope: user.opsScope,
      authSource,
      iat: now,
      exp: now + this.ttlSeconds,
      iss: this.issuer,
      aud: this.audience,
    };

    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    const encodedHeader = this.base64UrlJson(header);
    const encodedPayload = this.base64UrlJson(payload);
    const signature = this.sign(`${encodedHeader}.${encodedPayload}`);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  private verifyInternalToken(token: string): DaAuthTokenPayload | null {
    try {
      const parts = String(token || '').split('.');
      if (parts.length !== 3) return null;

      const [encodedHeader, encodedPayload, signature] = parts;
      const expected = this.sign(`${encodedHeader}.${encodedPayload}`);

      if (!this.safeEqual(signature, expected)) return null;

      const payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as DaAuthTokenPayload;

      const now = Math.floor(Date.now() / 1000);

      if (payload.iss !== this.issuer) return null;
      if (payload.aud !== this.audience) return null;
      if (!payload.exp || payload.exp < now) return null;
      if (!payload.sub || !payload.role) return null;

      return payload;
    } catch {
      return null;
    }
  }

  private payloadToUser(payload: DaAuthTokenPayload): DaAuthUser {
    return {
      id: payload.sub,
      role: payload.role,
      name: payload.name,
      email: payload.email,
      merchantSlug: payload.merchantSlug,
      courierId: payload.courierId,
      clientId: payload.clientId,
      opsScope: payload.opsScope,
    };
  }

  private payloadToPrincipal(payload: DaAuthTokenPayload): DaAuthPrincipal {
    const authSource = this.resolveAuthSource(payload.authSource);

    return {
      issuer: String(payload.iss || ''),
      subject: payload.sub,
      role: payload.role,
      name: payload.name,
      email: payload.email,
      merchantSlug: payload.merchantSlug,
      courierId: payload.courierId,
      clientId: payload.clientId,
      opsScope: payload.opsScope,
      authSource,
      ownershipEligible: this.isOwnershipEligibleSource(authSource),
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    };
  }

  private resolveAuthSource(
    value: DaAuthTokenSource | undefined,
  ): DaResolvedAuthSource {
    if (value === 'dev-login') return 'dev-login';
    if (value === 'external') return 'external';
    return 'legacy-unknown';
  }

  private isOwnershipEligibleSource(source: DaResolvedAuthSource): boolean {
    return source === 'external';
  }

  private extractBearer(authorization?: string): string {
    const value = String(authorization || '').trim();
    if (!value) return '';

    const match = value.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : '';
  }

  private base64UrlJson(value: unknown): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }

  private sign(value: string): string {
    return crypto
      .createHmac('sha256', this.secret())
      .update(value)
      .digest('base64url');
  }

  private safeEqual(a: string, b: string): boolean {
    try {
      const left = Buffer.from(a);
      const right = Buffer.from(b);
      if (left.length !== right.length) return false;
      return crypto.timingSafeEqual(left, right);
    } catch {
      return false;
    }
  }

  private secret(): string {
    const explicit = String(process.env.DA_AUTH_SECRET || '').trim();
    if (explicit) return explicit;

    const filePath = String(
      process.env.DA_AUTH_SECRET_FILE || '/run/secrets/delishafrica-auth-secret',
    ).trim();

    try {
      const fileSecret = fs.readFileSync(filePath, 'utf8').trim();
      if (fileSecret) return fileSecret;
    } catch {
      // Progressive fallback below.
    }

    const host = String(process.env.HOSTNAME || 'local');
    return crypto
      .createHash('sha256')
      .update(path.resolve(process.cwd()))
      .update('|')
      .update(host)
      .digest('hex');
  }
}
