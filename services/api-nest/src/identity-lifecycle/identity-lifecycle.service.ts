import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { AuthService } from '../auth/auth.service';
import type { DaAuthPrincipalResolution } from '../auth/auth.types';
import {
  idempotencyFingerprint,
  identityFingerprint,
} from './identity-lifecycle.crypto';
import { IdentityLifecycleRepository } from './identity-lifecycle.repository';
import type {
  AccountDeletionApplication,
  AccountDeletionRecord,
} from './identity-lifecycle.types';

const DELETE_CONFIRMATION = 'DELETE_MY_DELISHAFRICA_ACCOUNT';
const IDENTITY_DELETION_URL =
  'https://keycloak.afritaste.delishafrica.me/realms/afritaste/account/#/personal-info';
const APPLICATIONS = new Set<AccountDeletionApplication>(['client', 'merchant', 'courier']);
const IDEMPOTENCY = /^[A-Za-z0-9._:-]{16,180}$/;

@Injectable()
export class IdentityLifecycleService {
  constructor(
    private readonly auth: AuthService,
    private readonly repository: IdentityLifecycleRepository,
  ) {}

  health() {
    return this.repository.health();
  }

  async requestDeletion(input: {
    application: string;
    authorization?: string;
    idempotencyKey?: string;
    body?: unknown;
  }) {
    const application = this.application(input.application);
    const principal = await this.principal(application, input.authorization);
    const body = this.body(input.body);
    if (
      body.confirmation !== DELETE_CONFIRMATION ||
      body.acknowledgeRetention !== true
    ) {
      throw new BadRequestException({
        ok: false,
        code: 'account_deletion_confirmation_required',
      });
    }

    const key = String(input.idempotencyKey || '').trim();
    if (!IDEMPOTENCY.test(key)) {
      throw new BadRequestException({
        ok: false,
        code: 'account_deletion_idempotency_key_invalid',
      });
    }

    const fingerprint = identityFingerprint({
      issuer: principal.principal.issuer,
      subject: principal.principal.subject,
      role: principal.principal.role,
    });
    const keyHash = idempotencyFingerprint(key);
    const now = new Date();
    const record: AccountDeletionRecord = {
      requestId: crypto.randomUUID(),
      application,
      identityFingerprint: fingerprint,
      idempotencyKeyHash: keyHash,
      status: 'requested',
      requestedAt: now.toISOString(),
      completionDeadline: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      completedAt: null,
      retentionAcknowledged: true,
      authSource: 'external',
    };

    const persisted = await this.repository.createOrRead(record);
    if (
      persisted.record.application !== application ||
      persisted.record.identityFingerprint !== fingerprint
    ) {
      throw new ConflictException({
        ok: false,
        code: 'account_deletion_idempotency_owner_mismatch',
      });
    }

    return {
      ok: true,
      requestId: persisted.record.requestId,
      application,
      status: persisted.record.status,
      requestedAt: persisted.record.requestedAt,
      completionDeadline: persisted.record.completionDeadline,
      idempotentReplay: !persisted.created,
      identityDeletionUrl: IDENTITY_DELETION_URL,
      professionalAccessGranted: false,
      retention: {
        acknowledged: true,
        policy:
          'Only legally required accounting, anti-fraud, dispute and regulatory records may be retained for their applicable periods.',
      },
    };
  }

  async mine(input: { application: string; authorization?: string }) {
    const application = this.application(input.application);
    const principal = await this.principal(application, input.authorization);
    const fingerprint = identityFingerprint({
      issuer: principal.principal.issuer,
      subject: principal.principal.subject,
      role: principal.principal.role,
    });
    const requests = await this.repository.listForIdentity(application, fingerprint);
    return {
      ok: true,
      application,
      count: requests.length,
      requests: requests.map((record) => ({
        requestId: record.requestId,
        status: record.status,
        requestedAt: record.requestedAt,
        completionDeadline: record.completionDeadline,
        completedAt: record.completedAt,
      })),
    };
  }

  private application(value: string): AccountDeletionApplication {
    const application = String(value || '').trim() as AccountDeletionApplication;
    if (!APPLICATIONS.has(application)) {
      throw new BadRequestException({
        ok: false,
        code: 'account_deletion_application_invalid',
      });
    }
    return application;
  }

  private body(value: unknown): {
    confirmation?: unknown;
    acknowledgeRetention?: unknown;
  } {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException({ ok: false, code: 'account_deletion_body_invalid' });
    }
    const body = value as Record<string, unknown>;
    const keys = Object.keys(body).sort();
    if (
      keys.length !== 2 ||
      keys[0] !== 'acknowledgeRetention' ||
      keys[1] !== 'confirmation'
    ) {
      throw new BadRequestException({ ok: false, code: 'account_deletion_body_invalid' });
    }
    return body;
  }

  private async principal(
    application: AccountDeletionApplication,
    authorization?: string,
  ): Promise<Extract<DaAuthPrincipalResolution, { ok: true }>> {
    const resolution = await this.auth.resolvePrincipalFromAuthorization(authorization);
    if ('reason' in resolution) {
      throw new UnauthorizedException({
        ok: false,
        code: 'account_deletion_auth_required',
        reason: resolution.reason,
      });
    }
    if (
      resolution.principal.authSource !== 'external' ||
      resolution.principal.ownershipEligible !== true
    ) {
      throw new ForbiddenException({
        ok: false,
        code: 'account_deletion_external_identity_required',
      });
    }
    if (resolution.principal.role !== application) {
      throw new ForbiddenException({
        ok: false,
        code: 'account_deletion_role_mismatch',
      });
    }
    return resolution;
  }
}
