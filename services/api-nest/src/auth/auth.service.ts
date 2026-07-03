import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { DaAuthRole, DaAuthTokenPayload, DaAuthUser } from './auth.types';

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

  health() {
    return {
      ok: true,
      service: 'auth',
      mode: 'progressive_nonblocking',
      roles: ['client', 'merchant', 'courier', 'ops'],
      required: false,
    };
  }

  devLogin(input: DevLoginInput = {}) {
    const user = this.makeUser(input);
    const token = this.signUser(user);
    const payload = this.verifyToken(token);

    return {
      ok: true,
      mode: 'dev-login',
      required: false,
      tokenType: 'Bearer',
      accessToken: token,
      token,
      user,
      expiresAt: payload ? new Date(payload.exp * 1000).toISOString() : null,
    };
  }

  meFromAuthorization(authorization?: string) {
    const token = this.extractBearer(authorization);
    if (!token) {
      return {
        ok: false,
        authenticated: false,
        required: false,
        reason: 'missing_bearer_token',
        user: null,
      };
    }

    const payload = this.verifyToken(token);
    if (!payload) {
      return {
        ok: false,
        authenticated: false,
        required: false,
        reason: 'invalid_or_expired_token',
        user: null,
      };
    }

    return {
      ok: true,
      authenticated: true,
      required: false,
      user: this.payloadToUser(payload),
      payload,
    };
  }

  verify(input: { token?: string; accessToken?: string } = {}) {
    const token = input.token || input.accessToken || '';
    const payload = this.verifyToken(token);

    if (!payload) {
      return {
        ok: false,
        authenticated: false,
        reason: 'invalid_or_expired_token',
      };
    }

    return {
      ok: true,
      authenticated: true,
      user: this.payloadToUser(payload),
      payload,
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

  private signUser(user: DaAuthUser): string {
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

  private verifyToken(token: string): DaAuthTokenPayload | null {
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
    const left = Buffer.from(String(a));
    const right = Buffer.from(String(b));

    if (left.length !== right.length) return false;

    return crypto.timingSafeEqual(left, right);
  }

  private secret(): string {
    const fromEnv =
      process.env.DA_AUTH_DEV_SECRET ||
      process.env.JWT_SECRET ||
      process.env.AUTH_SECRET;

    if (fromEnv && fromEnv.trim().length >= 24) {
      return fromEnv.trim();
    }

    const file = path.join(process.cwd(), '.runtime', 'auth-dev-secret.txt');
    const dir = path.dirname(file);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(file)) {
      const existing = fs.readFileSync(file, 'utf8').trim();
      if (existing.length >= 32) return existing;
    }

    const generated = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(file, generated, { encoding: 'utf8', mode: 0o600 });

    return generated;
  }
}
