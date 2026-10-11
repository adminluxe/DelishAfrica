import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { IdentityProofService } from '../identity-proof/identity-proof.service';
import { ClientEnrollmentKeycloak } from './client-enrollment.keycloak';
import {
  ClientEnrollmentRepository,
  type ClientEnrollmentReservation,
} from './client-enrollment.repository';
import {
  enrollmentHmac,
  enrollmentReadyForProduction,
  parseClientEnrollmentCommand,
} from './client-enrollment.policy';

@Injectable()
export class ClientEnrollmentService {
  constructor(
    private readonly identityProof: IdentityProofService,
    private readonly repository: ClientEnrollmentRepository,
    private readonly keycloak: ClientEnrollmentKeycloak,
  ) {}

  readiness() {
    return {
      ok: true,
      service: 'delishafrica-client-enrollment',
      version: 'v1',
      enabled: enrollmentReadyForProduction(process.env),
      rolePolicy: 'realm_role_client_only',
      tokenPolicy: 'signed_sms_and_email_required',
      replayPolicy: 'durable_postgres_single_use',
      paymentAuthority: 'none',
    };
  }

  async register(body: Record<string, unknown>, requesterKey: string) {
    // Default OFF until PostgreSQL migration, a scoped service account,
    // Keycloak e-mail recovery/branding and independent QA have all passed.
    if (!enrollmentReadyForProduction(process.env)) {
      throw new ServiceUnavailableException({
        ok: false,
        code: 'client_enrollment_not_ready',
        retryable: false,
      });
    }
    const parsed = parseClientEnrollmentCommand(body);
    if (!parsed) {
      throw new BadRequestException({
        ok: false,
        code: 'client_enrollment_fields_invalid',
      });
    }

    // Never accept proofs based on a local mobile badge or a client-provided
    // 'verified' boolean. Re-validate exact recipient and Client role on the API.
    const emailProof = this.identityProof.attest({
      channel: 'email',
      role: 'client',
      destination: parsed.email,
      proofToken: parsed.emailProofToken,
    }, requesterKey);
    const smsProof = this.identityProof.attest({
      channel: 'sms',
      role: 'client',
      destination: parsed.phone,
      proofToken: parsed.smsProofToken,
    }, requesterKey);
    if (emailProof.valid !== true || smsProof.valid !== true) {
      throw new BadRequestException({
        ok: false,
        code: 'client_enrollment_proofs_invalid',
      });
    }

    const key = String(process.env.DA_CLIENT_ENROLLMENT_HMAC_SECRET || '');
    const reservation: ClientEnrollmentReservation = {
      emailHash: enrollmentHmac(key, 'email', parsed.email),
      phoneHash: enrollmentHmac(key, 'phone', parsed.phone),
      requesterHash: enrollmentHmac(key, 'remote', requesterKey || 'unknown'),
      requestHash: enrollmentHmac(key, 'request', parsed.requestId),
      emailProofHash: enrollmentHmac(key, 'email-proof', parsed.emailProofToken),
      smsProofHash: enrollmentHmac(key, 'sms-proof', parsed.smsProofToken),
    };

    let reserved: string | null;
    try {
      reserved = await this.repository.reserve(reservation);
    } catch (error) {
      if (error instanceof Error && error.message === 'client_enrollment_rate_limit') {
        throw new HttpException(
          { ok: false, code: 'client_enrollment_please_wait' },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new ServiceUnavailableException({
        ok: false,
        code: 'client_enrollment_service_unavailable',
      });
    }
    if (!reserved) {
      // Identical response for replay, repeated email, phone or proof token.
      // Do not expose whether an existing user account was found.
      throw new ConflictException({
        ok: false,
        code: 'client_enrollment_already_requested',
      });
    }

    try {
      const subjectId = await this.keycloak.createClientIdentity({
        email: parsed.email,
        phone: parsed.phone,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        password: parsed.password,
      });
      await this.repository.complete(reserved, subjectId);
      return {
        ok: true,
        status: 'account_created',
        next: 'secure_delishafrica_sign_in',
        role: 'client',
        paymentStarted: false,
      };
    } catch {
      await this.repository.flagForReview(reserved).catch(() => undefined);
      // No raw database/Keycloak exception, provider URL, email or password
      // must escape to the mobile app or into an application log.
      throw new ServiceUnavailableException({
        ok: false,
        code: 'client_enrollment_pending_review',
        retryable: false,
      });
    }
  }
}
