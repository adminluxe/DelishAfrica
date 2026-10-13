/**
 * DelishAfrica dual-issuer integration QA bridge.
 *
 * This class can be injected into the ACTUAL OrdersAuthGuard and
 * PaymentsAuthGuard in an isolated NestJS test. The production modules DO NOT
 * provide it. Defense in depth: the bridge explicitly refuses activation
 * outside GitHub Actions synthetic QA. NEVER register it in production.
 *
 * The unverified JWT issuer is used solely as a bounded *routing hint*.
 * Authorization is possible ONLY after signature verification against
 * independently issuer-pinned RSA JWKS, AND transactionally approved
 * e-mail/SMS admission. No token can select its own trusted JWKS host.
 */
import {
  ExecutionContext,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { DaAuthPrincipal } from './auth.types';
import {
  NATIVE_CLIENT_ADMISSION_CONTEXT,
  NATIVE_CLIENT_COMMERCE_DEPS,
  NativeClientNestCommerceGuard,
  type NativeClientCommerceDependencies,
  type NativeClientAdmittedHttpRequest,
} from './native-client-nest-commerce.guard';

@Injectable()
export class NativeClientCommerceIssuerBridge {
  constructor(
    private readonly nativeGuard: NativeClientNestCommerceGuard,
    @Inject(NATIVE_CLIENT_COMMERCE_DEPS)
    private readonly pinned: NativeClientCommerceDependencies,
  ) {}

  private syntheticOnly(): boolean {
    return process.env.GITHUB_ACTIONS === 'true' &&
      process.env.QA_SYNTHETIC_ONLY === 'YES';
  }

  /** A routing hint only; NEVER a trust decision. Bounded, no network. */
  isNativeIssuerToken(authorization?: string): boolean {
    if (!this.syntheticOnly() || typeof authorization !== 'string' ||
        authorization.length > 32775) return false;
    const match = /^Bearer ([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(authorization);
    if (!match || match[2].length > 24000) return false;
    try {
      const candidate: unknown = JSON.parse(
        Buffer.from(match[2], 'base64url').toString('utf8'),
      );
      return candidate !== null && typeof candidate === 'object' &&
        !Array.isArray(candidate) &&
        (candidate as Record<string, unknown>).iss === this.pinned.issuer;
    } catch {
      return false;
    }
  }

  async authenticate(context: ExecutionContext): Promise<DaAuthPrincipal> {
    if (!this.syntheticOnly()) {
      throw new ServiceUnavailableException('Native Client bridge is not enabled');
    }
    const request = context.switchToHttp()
      .getRequest<NativeClientAdmittedHttpRequest>();
    // Clear any recycled server-only principal before independent verification.
    if (request) delete request[NATIVE_CLIENT_ADMISSION_CONTEXT];
    const authorization = request?.headers?.authorization;
    if (!this.isNativeIssuerToken(
      typeof authorization === 'string' ? authorization : undefined
    )) {
      throw new UnauthorizedException('Client authentication required');
    }

    // Full cryptographic + current durable ledger approval is the ONLY
    // source of the non-serializable admission proof below.
    const verified = await this.nativeGuard.canActivate(context);
    if (verified !== true) {
      throw new UnauthorizedException('Client authentication required');
    }
    const evidence = request[NATIVE_CLIENT_ADMISSION_CONTEXT];
    if (!evidence || !Object.isFrozen(evidence) ||
        evidence.issuer !== this.pinned.issuer ||
        evidence.role !== 'client' ||
        evidence.authSource !== 'external' ||
        evidence.ownershipEligible !== true ||
        typeof evidence.subject !== 'string' ||
        typeof evidence.email !== 'string' ||
        !evidence.email ||
        typeof evidence.expiresAt !== 'string' ||
        !(Date.parse(evidence.expiresAt) > Date.now())) {
      throw new UnauthorizedException('Client authentication required');
    }
    // Immutable principal from verified proof, NEVER request body or headers.
    return Object.freeze({
      issuer: evidence.issuer,
      subject: evidence.subject,
      role: 'client' as const,
      name: 'Client DelishAfrica',
      clientId: evidence.subject,
      email: evidence.email,
      authSource: 'external' as const,
      ownershipEligible: true,
      expiresAt: evidence.expiresAt,
    });
  }
}
