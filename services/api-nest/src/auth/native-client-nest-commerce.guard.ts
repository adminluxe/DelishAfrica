/**
 * Candidate NestJS Client-commerce entry guard: QA ONLY, not in AppModule.
 *
 * Never add this to live orders/checkout/payments without independent QA,
 * a production-grade pinned HTTPS JWKS resolver, a verified SMS adapter and
 * an authoritative transactional PostgreSQL repository.
 *
 * No dependency here may ever be assembled from request body/query/headers.
 */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  verifyNativeClientJwt,
  type NativeClientIssuerPinnedJwks,
} from './native-client-jwt-verifier';
import {
  evaluateNativeClientCommerce,
  type NativeClientDurableLedger,
} from './native-client-commerce.policy';

export const NATIVE_CLIENT_COMMERCE_DEPS = Symbol('NATIVE_CLIENT_COMMERCE_DEPS');

export interface NativeClientCommerceDependencies {
  /** Configuration must be reviewed and server-controlled, NEVER HTTP input. */
  readonly issuer: string;
  readonly clientId: string;
  readonly audience: string;
  readonly emailHmacSecret: string;
  readonly maxTokenLifetimeSeconds: number;

  /** MUST use issuer-pinned HTTPS JWKS + discovery, not a JWT's jku/x5u. */
  readonly loadTrustedJwks: () => Promise<NativeClientIssuerPinnedJwks>;

  /** MUST read a committed DB transaction bound to this exact issuer + sub. */
  readonly readCommittedAdmission: (
    issuer: string,
    subjectId: string,
  ) => Promise<NativeClientDurableLedger | null>;
}

@Injectable()
export class NativeClientNestCommerceGuard implements CanActivate {
  constructor(
    @Inject(NATIVE_CLIENT_COMMERCE_DEPS)
    private readonly dependencies: NativeClientCommerceDependencies,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers?: Record<string, unknown>;
    }>();
    const authorization = request?.headers?.authorization;
    // Reject duplicate, malformed, excessive or non-Bearer Authorization
    // values. Do not read X-User, X-Role, body, cookie or forwarded headers.
    if (typeof authorization !== 'string' ||
        !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(authorization) ||
        authorization.length > 32775) {
      throw new UnauthorizedException('Client authentication required');
    }
    const jwt = authorization.slice('Bearer '.length);
    let pinned: NativeClientIssuerPinnedJwks;
    try {
      pinned = await this.dependencies.loadTrustedJwks();
    } catch {
      throw new ServiceUnavailableException('Identity verification temporarily unavailable');
    }
    const now = Math.floor(Date.now() / 1000);
    const verified = verifyNativeClientJwt(jwt, pinned, {
      issuer: this.dependencies.issuer,
      clientId: this.dependencies.clientId,
      audience: this.dependencies.audience,
      nowSeconds: now,
      maxTokenLifetimeSeconds: this.dependencies.maxTokenLifetimeSeconds,
    });
    if (!verified.ok) {
      // Do not disclose key rotation, signatures, users or identity rules.
      throw new UnauthorizedException('Client authentication required');
    }

    let ledger: NativeClientDurableLedger | null;
    try {
      ledger = await this.dependencies.readCommittedAdmission(
        this.dependencies.issuer,
        String(verified.evidence.claims.sub),
      );
    } catch {
      // Database outages MUST NOT degrade to an allowed request.
      throw new ServiceUnavailableException('Admission service temporarily unavailable');
    }
    const result = evaluateNativeClientCommerce(verified.evidence, ledger, {
      issuer: this.dependencies.issuer,
      audience: this.dependencies.audience,
      clientId: this.dependencies.clientId,
      emailHmacSecret: this.dependencies.emailHmacSecret,
      nowSeconds: now,
    });
    if (result) {
      throw new ForbiddenException('Client admission not approved');
    }
    // This grants ONLY the wrapped route. Ownership, prices, idempotency,
    // business authorization and Stripe gating require separate checks.
    return true;
  }
}
