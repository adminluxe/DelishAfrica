import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import { AuthService } from '../auth/auth.service';
import { MerchantInvitationsCrypto } from './merchant-invitations.crypto';
import { MerchantInvitationsProvider } from './merchant-invitations.provider';
import { MerchantInvitationsRepository } from './merchant-invitations.repository';
import {
  MERCHANT_INVITATION_ROLES,
  type MerchantInvitationAuthority,
  type MerchantInvitationCommand,
  type MerchantInvitationPrepareBody,
  type MerchantInvitationRole,
  type MerchantInvitationTokenBody,
} from './merchant-invitations.types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PARTNER_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,127}$/;
const IDEMPOTENCY_RE = /^[A-Za-z0-9._:@+-]{16,128}$/;
const INVITATION_TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;
const TEMPLATE_ALIAS = 'merchant-contractual-invitation-v1';

@Injectable()
export class MerchantInvitationsService {
  private readonly writesEnabled =
    String(process.env.INVITATION_WRITES || '0').trim() === '1';
  private readonly acceptanceWritesEnabled =
    String(process.env.INVITATION_ACCEPTANCE_WRITES || '0').trim() === '1';

  constructor(
    private readonly crypto: MerchantInvitationsCrypto,
    private readonly provider: MerchantInvitationsProvider,
    private readonly repository: MerchantInvitationsRepository,
    private readonly auth: AuthService,
  ) {}

  async prepare(
    rawBody: MerchantInvitationPrepareBody,
    authority: MerchantInvitationAuthority,
  ) {
    const command = this.validatePrepare(rawBody);
    const provider = this.provider.readiness();

    if (!this.writesEnabled) {
      throw new ServiceUnavailableException({
        ok: false,
        code: 'invitation_writes_disabled',
        commandSurfaceReady: true,
        encryptionKeyReady: true,
        provider,
      });
    }

    const invitationId = randomUUID();
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + command.expiresInHours * 3600 * 1000);
    const emailHash = this.crypto.sha256(command.recipientEmail);
    const tokenHash = this.crypto.sha256(token);
    const idempotencyKeyHash = this.crypto.sha256(
      `DA-MERCHANT-INVITATION-IDEMPOTENCY-V1\n${authority.principalHash}\n${command.idempotencyKey}`,
    );
    const outboxIdempotencyKeyHash = this.crypto.sha256(
      `DA-MERCHANT-INVITATION-OUTBOX-V1\n${idempotencyKeyHash}`,
    );
    const requestIdHash = this.crypto.sha256(command.idempotencyKey);
    const authorityAuditIdHash = this.crypto.sha256(authority.authorityAuditId);
    const encryptedEmail = this.crypto.encryptUtf8(
      command.recipientEmail,
      'recipient-email',
    );
    const payloadJson = stableJson({
      version: 1,
      invitationId,
      partnerId: command.partnerId,
      recipientEmail: command.recipientEmail,
      membershipRole: command.membershipRole,
      token,
      expiresAt: expiresAt.toISOString(),
    });
    const encryptedPayload = this.crypto.encryptUtf8(
      payloadJson,
      'postmark-payload',
    );

    try {
      const result = await this.repository.createTransactional({
        invitationId,
        partnerId: command.partnerId,
        recipientEmailHash: emailHash,
        recipientEmailCiphertext: encryptedEmail.ciphertext,
        recipientEmailKeyId: encryptedEmail.keyId,
        tokenHash,
        idempotencyKeyHash,
        issuedBySubjectHash: authority.principalHash,
        membershipRole: command.membershipRole,
        expiresAt,
        templateAlias: TEMPLATE_ALIAS,
        payloadCiphertext: encryptedPayload.ciphertext,
        payloadKeyId: encryptedPayload.keyId,
        payloadSha256: this.crypto.sha256(payloadJson),
        outboxIdempotencyKeyHash,
        requestIdHash,
        authorityAuditIdHash,
      });
      return {
        ok: true,
        invitationId: result.invitationId,
        invitationStatus: result.invitationStatus,
        outboxStatus: result.outboxStatus,
        idempotentReplay: result.idempotentReplay,
        emailDispatched: false,
        provider,
        encryptionKeyId: this.crypto.getKeyId(),
      };
    } catch (error) {
      const message = this.errorMessage(error);
      if (/duplicate key|unique constraint/i.test(message)) {
        throw new ConflictException({ ok: false, code: 'invitation_conflict' });
      }
      throw new ServiceUnavailableException({
        ok: false,
        code: 'invitation_transaction_unavailable',
      });
    }
  }

  async dispatchOne() {
    const provider = this.provider.readiness();
    if (!provider.readyToSend) throw new ServiceUnavailableException({ ok: false, code: 'invitation_provider_not_ready', provider });
    const result = await this.repository.dispatchOldestPending(async (record) => {
      const payloadJson = this.crypto.decryptUtf8(record.payloadCiphertext, record.payloadKeyId, 'postmark-payload');
      let model: Record<string, unknown>;
      try { model = JSON.parse(payloadJson) as Record<string, unknown>; } catch { throw new Error('merchant_invitation_payload_invalid'); }
      const to = String(model.recipientEmail || '').trim().toLowerCase();
      if (!EMAIL_RE.test(to)) throw new Error('merchant_invitation_recipient_invalid');
      return this.provider.sendTemplate({ to, templateAlias: record.templateAlias, templateModel: model });
    });
    return { ok: true, ...result, provider: 'postmark' as const };
  }

  async preview(rawBody: MerchantInvitationTokenBody) {
    const token = this.validateToken(rawBody?.token);
    const record = await this.repository.previewByTokenHash(
      this.crypto.sha256(token),
    );
    if (!record) this.notFound();

    const now = Date.now();
    let state: 'ready' | 'accepted' | 'expired' | 'revoked' | 'unavailable' =
      'ready';
    if (record.revokedAt || record.invitationStatus === 'revoked') state = 'revoked';
    else if (record.expiresAt.getTime() <= now || record.invitationStatus === 'expired') {
      state = 'expired';
    } else if (record.invitationStatus === 'accepted') state = 'accepted';
    else if (!['pending', 'queued', 'sent'].includes(record.invitationStatus)) {
      state = 'unavailable';
    }

    return {
      ok: true,
      invitation: {
        state,
        partnerId: record.partnerId,
        partnerSlug: record.partnerSlug,
        partnerName: record.partnerName,
        membershipRole: record.membershipRole,
        invitationStatus: record.invitationStatus,
        contractStatus: record.contractStatus,
        kybStatus: record.kybStatus,
        expiresAt: record.expiresAt.toISOString(),
        acceptedAt: record.acceptedAt?.toISOString() || null,
      },
      acceptanceRequires: {
        externalMerchantIdentity: true,
        matchingVerifiedEmail: true,
        contractAcceptance: true,
        kybBeforeOperationalAccess: true,
      },
    };
  }

  async accept(
    rawBody: MerchantInvitationTokenBody,
    authorization: string | undefined,
    requestId: string | undefined,
  ) {
    if (!this.acceptanceWritesEnabled) {
      throw new ServiceUnavailableException({
        ok: false,
        code: 'invitation_acceptance_writes_disabled',
      });
    }

    const token = this.validateToken(rawBody?.token);
    const resolution = await this.auth.resolvePrincipalFromAuthorization(
      authorization,
    );
    if ('reason' in resolution) {
      throw new UnauthorizedException({
        ok: false,
        code: 'merchant_auth_required',
        reason: resolution.reason,
      });
    }

    const principal = resolution.principal;
    if (
      principal.role !== 'merchant' ||
      principal.authSource !== 'external' ||
      !principal.ownershipEligible
    ) {
      throw new ForbiddenException({
        ok: false,
        code: 'trusted_external_merchant_identity_required',
      });
    }

    const normalizedEmail = this.verifiedExternalEmailFromAuthorization(
      authorization,
      principal.issuer,
      principal.subject,
      principal.email,
    );
    if (!normalizedEmail) {
      throw new ForbiddenException({
        ok: false,
        code: 'verified_merchant_email_required',
      });
    }

    try {
      const result = await this.repository.acceptTransactional({
        tokenHash: this.crypto.sha256(token),
        issuer: principal.issuer,
        subject: principal.subject,
        principalEmailHash: this.crypto.sha256(normalizedEmail),
        actorSubjectHash: this.crypto.sha256(
          `DA-MERCHANT-INVITATION-ACTOR-V1\n${principal.issuer}\n${principal.subject}`,
        ),
        requestIdHash: this.crypto.sha256(
          String(requestId || randomUUID()).slice(0, 256),
        ),
      });

      const accessEligible =
        result.membershipStatus === 'active' &&
        result.contractStatus === 'active' &&
        result.kybStatus === 'verified';

      return {
        ok: true,
        invitation: {
          invitationId: result.invitationId,
          invitationStatus: result.invitationStatus,
          contractStatus: result.invitationContractStatus,
          idempotentReplay: result.idempotentReplay,
        },
        partner: {
          partnerId: result.partnerId,
          slug: result.partnerSlug,
          name: result.partnerName,
        },
        membership: {
          membershipId: result.membershipId,
          role: result.membershipRole,
          status: result.membershipStatus,
          contractStatus: result.contractStatus,
          kybStatus: result.kybStatus,
          accessEligible,
        },
        nextStep: accessEligible
          ? 'merchant_space_ready'
          : 'complete_kyb_for_operational_access',
      };
    } catch (error) {
      this.mapAcceptanceError(this.errorMessage(error));
    }
  }

  private validatePrepare(body: MerchantInvitationPrepareBody): MerchantInvitationCommand {
    const partnerId = String(body?.partnerId || '').trim();
    const recipientEmail = String(body?.recipientEmail || '').trim().toLowerCase();
    const membershipRole = String(body?.membershipRole || 'manager').trim();
    const idempotencyKey = String(body?.idempotencyKey || '').trim();
    const expiresInHoursRaw = Number(body?.expiresInHours ?? 72);

    if (!PARTNER_RE.test(partnerId)) this.invalid('partner_id_invalid');
    if (!EMAIL_RE.test(recipientEmail) || recipientEmail.length > 254) {
      this.invalid('recipient_email_invalid');
    }
    if (!(MERCHANT_INVITATION_ROLES as readonly string[]).includes(membershipRole)) {
      this.invalid('membership_role_invalid');
    }
    if (!IDEMPOTENCY_RE.test(idempotencyKey)) {
      this.invalid('idempotency_key_invalid');
    }
    if (!Number.isInteger(expiresInHoursRaw) || expiresInHoursRaw < 1 || expiresInHoursRaw > 168) {
      this.invalid('expires_in_hours_invalid');
    }

    return {
      partnerId,
      recipientEmail,
      membershipRole: membershipRole as MerchantInvitationRole,
      idempotencyKey,
      expiresInHours: expiresInHoursRaw,
    };
  }

  private validateToken(value: unknown): string {
    const token = String(value || '').trim();
    if (!INVITATION_TOKEN_RE.test(token)) {
      this.notFound();
    }
    return token;
  }

  private normalizeEmail(value: unknown): string | null {
    const email = String(value || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 254) return null;
    return email;
  }

  private verifiedExternalEmailFromAuthorization(
    authorization: string | undefined,
    issuer: string,
    subject: string,
    principalEmail: unknown,
  ): string | null {
    const match = String(authorization || '').trim().match(/^Bearer\s+(.+)$/i);
    if (!match) return null;
    const parts = match[1].split('.');
    if (parts.length !== 3) return null;

    try {
      const claims = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8'),
      ) as Record<string, unknown>;
      if (claims.iss !== issuer || claims.sub !== subject) return null;
      if (claims.email_verified !== true) return null;

      const claimEmail = this.normalizeEmail(claims.email);
      const resolvedEmail = this.normalizeEmail(principalEmail);
      if (!claimEmail || !resolvedEmail || claimEmail !== resolvedEmail) return null;
      return claimEmail;
    } catch {
      return null;
    }
  }

  private mapAcceptanceError(message: string): never {
    if (message === 'invitation_invalid') this.notFound();
    if (message === 'invitation_identity_email_mismatch') {
      throw new ForbiddenException({
        ok: false,
        code: 'invitation_not_issued_for_authenticated_email',
      });
    }
    if (message === 'invitation_expired') {
      throw new GoneException({ ok: false, code: 'invitation_expired' });
    }
    if (message === 'invitation_revoked') {
      throw new GoneException({ ok: false, code: 'invitation_revoked' });
    }
    if (message === 'invitation_failed' || message === 'invitation_unavailable') {
      throw new ConflictException({ ok: false, code: 'invitation_unavailable' });
    }
    if (message === 'invitation_already_consumed') {
      throw new ConflictException({ ok: false, code: 'invitation_already_consumed' });
    }
    if (message === 'identity_subject_not_active') {
      throw new ForbiddenException({ ok: false, code: 'merchant_identity_not_active' });
    }
    if (message === 'membership_reactivation_requires_ops_review') {
      throw new ConflictException({
        ok: false,
        code: 'membership_reactivation_requires_ops_review',
      });
    }
    throw new ServiceUnavailableException({
      ok: false,
      code: 'invitation_acceptance_transaction_unavailable',
    });
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error || 'unknown_error');
  }

  private invalid(code: string): never {
    throw new BadRequestException({ ok: false, code });
  }

  private notFound(): never {
    throw new NotFoundException({ ok: false, code: 'invitation_invalid' });
  }
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`;
}
