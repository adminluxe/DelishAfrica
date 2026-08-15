import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { readFileSync } from 'fs';
import { OpsAuthorityRepository } from './ops-authority.repository';
import type {
  OpsAuthorityHeaderMap,
  OpsAuthorityRequestContext,
  OpsAuthorityVerification,
} from './ops-authority.types';

const SERVICE = 'ops-authority-foundation' as const;
const VERSION = '2.0.0' as const;
const CANONICAL_VERSION = 'DA-OPS-AUTHORITY-V1';
const NONCE_HASH_VERSION = 'DA-OPS-AUTHORITY-NONCE-V1';
const VERIFY_METHOD = 'GET' as const;
const VERIFY_PATH = '/api/v1/ops/authority/verify' as const;
const EMPTY_BODY_SHA256 = createHash('sha256').update('').digest('hex');
const PRINCIPAL_RE = /^[A-Za-z0-9][A-Za-z0-9._@+_-]{0,127}$/;
const NONCE_RE = /^[A-Za-z0-9._:-]{16,128}$/;
const KEY_ID_RE = /^[A-Za-z0-9._:-]{3,64}$/;
const SIGNATURE_RE = /^[A-Za-z0-9_-]{32,128}$/;
const BODY_HASH_RE = /^[0-9a-f]{64}$/;
const METHOD_RE = /^(GET|POST|PUT|PATCH|DELETE)$/;
const PATH_RE = /^\/api\/v1\/[A-Za-z0-9/_-]{1,220}$/;

@Injectable()
export class OpsAuthorityService {
  private readonly secret: Buffer;
  private readonly keyId: string;
  private readonly maxSkewSeconds: number;

  constructor(private readonly repository: OpsAuthorityRepository) {
    const filePath = String(
      process.env.DA_OPS_AUTHORITY_SECRET_FILE ||
        '/run/secrets/da-ops-authority-v1',
    ).trim();

    let secretText = '';
    try {
      secretText = readFileSync(filePath, 'utf8').trim();
    } catch {
      throw new ServiceUnavailableException({
        ok: false,
        code: 'ops_authority_secret_unavailable',
      });
    }

    if (secretText.length < 43) {
      throw new ServiceUnavailableException({
        ok: false,
        code: 'ops_authority_secret_invalid',
      });
    }

    this.secret = Buffer.from(secretText, 'utf8');
    this.keyId = String(
      process.env.DA_OPS_AUTHORITY_KEY_ID || 'ops-authority-v1',
    ).trim();

    if (!KEY_ID_RE.test(this.keyId)) {
      throw new ServiceUnavailableException({
        ok: false,
        code: 'ops_authority_key_id_invalid',
      });
    }

    const configuredSkew = Number.parseInt(
      String(process.env.DA_OPS_AUTHORITY_MAX_SKEW_SECONDS || '60'),
      10,
    );
    this.maxSkewSeconds = Number.isFinite(configuredSkew)
      ? Math.min(Math.max(configuredSkew, 15), 300)
      : 60;
  }

  async verifyGet(
    headers: OpsAuthorityHeaderMap,
  ): Promise<OpsAuthorityVerification> {
    const context = await this.authorizeRequest(
      headers,
      VERIFY_METHOD,
      VERIFY_PATH,
      EMPTY_BODY_SHA256,
    );

    return {
      ok: true,
      service: SERVICE,
      version: VERSION,
      authorityVerified: true,
      principalHash: context.principalHash.slice(0, 20),
      keyId: context.keyId,
      timestampAccepted: true,
      nonceFormatAccepted: true,
      noncePersistenceEnabled: true,
      replayProtectionEnabled: true,
      auditPersistenceEnabled: true,
      authorityAuditRecorded: true,
      invitationWritesEnabled: false,
      membershipActivationWritesEnabled: false,
      ownershipAutoEnabled: false,
      draftEnabled: false,
      publishEnabled: false,
    };
  }

  async authorizeRequest(
    headers: OpsAuthorityHeaderMap,
    requestMethod: string,
    requestPath: string,
    actualBodySha256: string,
  ): Promise<OpsAuthorityRequestContext> {
    const method = String(requestMethod || '').trim().toUpperCase();
    const path = String(requestPath || '').trim();
    const bodyHash = String(actualBodySha256 || '').trim().toLowerCase();
    if (!METHOD_RE.test(method)) this.deny('ops_authority_method_invalid');
    if (!PATH_RE.test(path)) this.deny('ops_authority_path_invalid');
    if (!BODY_HASH_RE.test(bodyHash)) this.deny('ops_authority_actual_body_hash_invalid');

    const principal = this.header(headers, 'x-da-ops-principal');
    const authMethod = this.header(headers, 'x-da-ops-auth-method').toLowerCase();
    const timestampText = this.header(headers, 'x-da-ops-timestamp');
    const nonce = this.header(headers, 'x-da-ops-nonce');
    const suppliedBodySha256 = this.header(
      headers,
      'x-da-ops-body-sha256',
    ).toLowerCase();
    const signature = this.header(headers, 'x-da-ops-signature');
    const keyId = this.header(headers, 'x-da-ops-key-id');

    if (!PRINCIPAL_RE.test(principal)) this.deny('ops_authority_principal_invalid');
    if (authMethod !== 'basic') this.deny('ops_authority_auth_method_invalid');
    if (!NONCE_RE.test(nonce)) this.deny('ops_authority_nonce_invalid');
    if (keyId !== this.keyId) this.deny('ops_authority_key_id_invalid');
    if (!BODY_HASH_RE.test(suppliedBodySha256)) {
      this.deny('ops_authority_body_hash_invalid');
    }
    if (!this.safeEqual(suppliedBodySha256, bodyHash)) {
      this.deny('ops_authority_body_hash_mismatch');
    }
    if (!SIGNATURE_RE.test(signature)) this.deny('ops_authority_signature_invalid');

    const timestamp = Number.parseInt(timestampText, 10);
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > this.maxSkewSeconds) {
      this.deny('ops_authority_timestamp_invalid');
    }

    const canonical = this.canonical({
      requestMethod: method,
      requestPath: path,
      principal,
      authMethod,
      timestamp: timestampText,
      nonce,
      bodySha256: bodyHash,
    });
    const expected = createHmac('sha256', this.secret)
      .update(canonical)
      .digest('base64url');
    if (!this.safeEqual(signature, expected)) {
      this.deny('ops_authority_signature_mismatch');
    }

    const principalHash = createHash('sha256').update(principal).digest('hex');
    const nonceHash = createHash('sha256')
      .update([NONCE_HASH_VERSION, this.keyId, nonce].join('\n'))
      .digest('hex');
    const expiresAt = new Date((timestamp + this.maxSkewSeconds) * 1000);

    let decision;
    try {
      decision = await this.repository.consumeNonceAndAudit({
        nonceHash,
        principalHash,
        keyId: this.keyId,
        authMethod: 'basic',
        requestMethod: method,
        requestPath: path,
        bodySha256: bodyHash,
        requestTimestamp: timestamp,
        expiresAt,
      });
    } catch {
      throw new ServiceUnavailableException({
        ok: false,
        code: 'ops_authority_persistence_unavailable',
      });
    }

    if (!decision.accepted) this.deny('ops_authority_replay_detected');
    return {
      authorityVerified: true,
      principalHash,
      keyId: this.keyId,
      auditId: decision.auditId,
    };
  }

  private canonical(input: {
    requestMethod: string;
    requestPath: string;
    principal: string;
    authMethod: string;
    timestamp: string;
    nonce: string;
    bodySha256: string;
  }): string {
    return [
      CANONICAL_VERSION,
      input.requestMethod,
      input.requestPath,
      input.timestamp,
      input.nonce,
      input.principal,
      input.authMethod,
      input.bodySha256,
    ].join('\n');
  }

  private header(headers: OpsAuthorityHeaderMap, name: string): string {
    const value = headers[name];
    if (Array.isArray(value)) return String(value[0] || '').trim();
    return String(value || '').trim();
  }

  private safeEqual(leftText: string, rightText: string): boolean {
    try {
      const left = Buffer.from(leftText, 'utf8');
      const right = Buffer.from(rightText, 'utf8');
      return left.length === right.length && timingSafeEqual(left, right);
    } catch {
      return false;
    }
  }

  private deny(code: string): never {
    throw new UnauthorizedException({ ok: false, code });
  }
}
