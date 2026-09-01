import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'node:net';
import * as tls from 'node:tls';
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

type DaRedisRevocationConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  tls: boolean;
};

type DaRedisReply = string | number | null;

type DaClientRevocationCheck =
  | { ok: true; revoked: boolean }
  | { ok: false; reason: 'revocation_store_unavailable' | 'client_session_id_missing' };

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
      clientSessionRevocation: {
        mode: 'redis_hashed_sid_fail_closed',
        configured: this.redisConfigSafe() !== null,
        failClosed: true,
        rawSessionIdentifiersPersisted: false,
      },
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
      payload: this.publicTokenPayload(resolution.payload),
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
      payload: this.publicTokenPayload(resolution.payload),
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
      const revocation = await this.checkExternalClientRevocation(external.payload);
      if ('reason' in revocation) {
        return {
          ok: false,
          authenticated: false,
          reason: revocation.reason,
          principal: null,
        };
      }
      if (revocation.revoked) {
        return {
          ok: false,
          authenticated: false,
          reason: 'revoked_token',
          principal: null,
        };
      }
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

  async revokeClientSession(payload: DaAuthTokenPayload): Promise<
    | { ok: true; revoked: true; strategy: 'redis_hashed_sid'; expiresInSeconds: number }
    | { ok: false; reason: 'revocation_store_unavailable' | 'client_session_id_missing' }
  > {
    if (payload.authSource !== 'external' || payload.role !== 'client') {
      return { ok: false, reason: 'client_session_id_missing' };
    }

    const key = this.revocationKey(payload);
    if (!key) return { ok: false, reason: 'client_session_id_missing' };

    const now = Math.floor(Date.now() / 1000);
    const expiresInSeconds = Math.max(1, Math.min(3600, payload.exp - now + 120));
    try {
      const reply = await this.redisCommand(['SET', key, '1', 'EX', String(expiresInSeconds)]);
      if (reply !== 'OK') {
        return { ok: false, reason: 'revocation_store_unavailable' };
      }
      return {
        ok: true,
        revoked: true,
        strategy: 'redis_hashed_sid',
        expiresInSeconds,
      };
    } catch {
      return { ok: false, reason: 'revocation_store_unavailable' };
    }
  }

  private async checkExternalClientRevocation(
    payload: DaAuthTokenPayload,
  ): Promise<DaClientRevocationCheck> {
    if (payload.authSource !== 'external' || payload.role !== 'client') {
      return { ok: true, revoked: false };
    }

    const key = this.revocationKey(payload);
    if (!key) return { ok: false, reason: 'client_session_id_missing' };

    try {
      const reply = await this.redisCommand(['EXISTS', key]);
      if (typeof reply !== 'number') {
        return { ok: false, reason: 'revocation_store_unavailable' };
      }
      return { ok: true, revoked: reply > 0 };
    } catch {
      return { ok: false, reason: 'revocation_store_unavailable' };
    }
  }

  private revocationKey(payload: DaAuthTokenPayload): string | null {
    const sid = typeof payload.sid === 'string' ? payload.sid.trim() : '';
    if (!sid) return null;
    const digest = crypto
      .createHash('sha256')
      .update('delishafrica|client|sid|v1|')
      .update(sid)
      .digest('hex');
    return `da:auth:revoked:sid:v1:${digest}`;
  }

  private redisConfigSafe(): DaRedisRevocationConfig | null {
    try {
      return this.redisConfig();
    } catch {
      return null;
    }
  }

  private redisConfig(): DaRedisRevocationConfig {
    const raw = String(process.env.REDIS_URL || '').trim();
    if (!raw) throw new Error('revocation_store_not_configured');

    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error('revocation_store_url_invalid');
    }
    if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
      throw new Error('revocation_store_protocol_invalid');
    }

    const port = Number(parsed.port || (parsed.protocol === 'rediss:' ? 6380 : 6379));
    if (!parsed.hostname || !Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('revocation_store_endpoint_invalid');
    }

    return {
      host: parsed.hostname,
      port,
      username: decodeURIComponent(parsed.username || ''),
      password: decodeURIComponent(parsed.password || ''),
      tls: parsed.protocol === 'rediss:',
    };
  }

  private encodeRedisCommand(args: string[]): Buffer {
    const parts = [`*${args.length}\r\n`];
    for (const arg of args) {
      const value = String(arg);
      parts.push(`$${Buffer.byteLength(value)}\r\n${value}\r\n`);
    }
    return Buffer.from(parts.join(''), 'utf8');
  }

  private parseRedisReply(buffer: Buffer): { complete: boolean; value?: DaRedisReply; error?: true } {
    if (buffer.length < 3) return { complete: false };
    const text = buffer.toString('utf8');
    const lineEnd = text.indexOf('\r\n');
    if (lineEnd < 0) return { complete: false };
    const prefix = text[0];
    const line = text.slice(1, lineEnd);

    if (prefix === '+') return { complete: true, value: line };
    if (prefix === '-') return { complete: true, error: true };
    if (prefix === ':') {
      const value = Number(line);
      return Number.isFinite(value) ? { complete: true, value } : { complete: true, error: true };
    }
    if (prefix === '$') {
      const size = Number(line);
      if (!Number.isInteger(size)) return { complete: true, error: true };
      if (size === -1) return { complete: true, value: null };
      const start = lineEnd + 2;
      const end = start + size;
      if (buffer.length < end + 2) return { complete: false };
      return { complete: true, value: buffer.subarray(start, end).toString('utf8') };
    }
    return { complete: true, error: true };
  }

  private redisCommand(args: string[]): Promise<DaRedisReply> {
    const config = this.redisConfig();
    return new Promise((resolve, reject) => {
      let settled = false;
      let stage: 'auth' | 'command' = config.password ? 'auth' : 'command';
      let buffer = Buffer.alloc(0);
      const socket: net.Socket | tls.TLSSocket = config.tls
        ? tls.connect({ host: config.host, port: config.port, servername: config.host, rejectUnauthorized: true })
        : net.createConnection({ host: config.host, port: config.port });

      const finish = (error?: Error, value?: DaRedisReply) => {
        if (settled) return;
        settled = true;
        try { socket.destroy(); } catch {}
        if (error) reject(error);
        else resolve(value ?? null);
      };

      const start = () => {
        if (stage === 'auth') {
          socket.write(
            this.encodeRedisCommand(
              config.username
                ? ['AUTH', config.username, config.password]
                : ['AUTH', config.password],
            ),
          );
        } else {
          socket.write(this.encodeRedisCommand(args));
        }
      };

      socket.setTimeout(2000);
      if (config.tls) socket.once('secureConnect', start);
      else socket.once('connect', start);
      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
        const parsed = this.parseRedisReply(buffer);
        if (!parsed.complete) return;
        if (parsed.error) {
          finish(new Error('revocation_store_command_failed'));
          return;
        }
        if (stage === 'auth') {
          if (parsed.value !== 'OK') {
            finish(new Error('revocation_store_auth_failed'));
            return;
          }
          stage = 'command';
          buffer = Buffer.alloc(0);
          socket.write(this.encodeRedisCommand(args));
          return;
        }
        finish(undefined, parsed.value);
      });
      socket.on('timeout', () => finish(new Error('revocation_store_timeout')));
      socket.on('error', () => finish(new Error('revocation_store_connection_failed')));
    });
  }

  private publicTokenPayload(payload: DaAuthTokenPayload): Omit<DaAuthTokenPayload, 'sid' | 'jti'> {
    const { sid: _sid, jti: _jti, ...safe } = payload;
    return safe;
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
