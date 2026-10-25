/**
 * R5B private QA candidate. This class is deliberately NOT imported into
 * public AppModule. Never expose it on a production listener.
 * Keycloak signature, audience, role isolation and Redis revocation are
 * checked by the actual DelishAfrica AuthService before any SQL operation.
 * PSP remains disabled by the separate PR #48 hardstop.
 */
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Header,
  Headers,
  HttpCode,
  Inject,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

export const R5B_CLIENT_RESERVATION_QA_PORT = 'R5B_CLIENT_RESERVATION_QA_PORT';
export type R5BReserveInput = {
  issuer: string;
  subject: string;
  tenantId: string;
  merchantId: string;
  sku: string;
  quantity: number;
  currency: 'EUR';
  mutationKey: string;
  claimedAmountMinor: number | null;
};
export type R5BReservationRow = {
  reservation_id: string;
  issuer: string;
  subject: string;
  tenant?: string;
  merchant?: string;
  amount_minor: number;
  currency: string;
  status: string;
};
export type R5BReservationQaPort = {
  resolveTenantForMerchant(merchantId: string): Promise<string | null>;
  reserve(input: R5BReserveInput): Promise<R5BReservationRow>;
  readCommitted(issuer: string, subject: string, mutationKey: string):
    Promise<R5BReservationRow | null>;
};
export class R5BReservationQaPortError extends Error {
  constructor(
    public readonly kind: 'conflict' | 'catalog_denied' | 'sql_unavailable',
  ) { super('r5b_checkout_' + kind); }
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEYS = new Set([
  'merchantId', 'sku', 'quantity', 'currency',
  'mutationKey', 'claimedAmountMinor',
]);

function deny(): never {
  throw new ServiceUnavailableException({
    ok: false, code: 'qa_checkout_not_authorized_for_public_use',
  });
}

@Controller('qa-isolated/r5b-client-reservation/v1')
export class R5BClientReservationQaController {
  constructor(
    private readonly auth: AuthService,
    @Inject(R5B_CLIENT_RESERVATION_QA_PORT)
    private readonly reservation: R5BReservationQaPort,
  ) {}

  @Post('reserve')
  @HttpCode(201)
  @Header('Cache-Control', 'no-store, private')
  async reserve(
    @Headers('authorization') authorization?: string,
    @Body() body?: Record<string, unknown>,
  ) {
    if (
      process.env.NODE_ENV === 'production' ||
      process.env.GITHUB_ACTIONS !== 'true' ||
      process.env.QA_SYNTHETIC_ONLY !== 'YES'
    ) return deny();

    // Real Nest AuthService enforces actual external JWKS / role / Redis
    // revocation; internal dev-login must never authorize checkout.
    const resolution = await this.auth.resolvePrincipalFromAuthorization(authorization);
    if ('reason' in resolution) {
      if (resolution.reason === 'revocation_store_unavailable') return deny();
      throw new UnauthorizedException({
        ok: false, code: 'qa_client_identity_unverified',
      });
    }
    const p = resolution.principal;
    if (p.role !== 'client' || p.authSource !== 'external' ||
        !p.ownershipEligible || !UUID.test(p.subject) ||
        typeof p.issuer !== 'string' || !p.issuer.startsWith('http://127.0.0.1:18195/realms/')) {
      throw new ForbiddenException({
        ok: false, code: 'qa_external_client_only',
      });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some(key => !KEYS.has(key))) {
      throw new BadRequestException({
        ok: false, code: 'qa_client_identity_or_tenant_override_forbidden',
      });
    }
    const merchantId = body.merchantId;
    const sku = body.sku;
    const quantity = body.quantity;
    const mutationKey = body.mutationKey;
    const currency = body.currency;
    const claimed = body.claimedAmountMinor;
    if (
      typeof merchantId !== 'string' || !UUID.test(merchantId) ||
      typeof sku !== 'string' || !/^qa-[a-z0-9_-]{2,64}$/.test(sku) ||
      typeof quantity !== 'number' || !Number.isInteger(quantity) ||
      quantity < 1 || quantity > 30 ||
      typeof mutationKey !== 'string' ||
      !/^[A-Za-z0-9_-]{12,80}$/.test(mutationKey) ||
      currency !== 'EUR' ||
      (claimed !== undefined &&
       (typeof claimed !== 'number' || !Number.isSafeInteger(claimed) ||
        claimed < 1 || claimed > 200000))
    ) {
      throw new BadRequestException({
        ok: false, code: 'qa_checkout_invalid_input',
      });
    }

    try {
      // Merchant -> tenant is a server-only authorization decision. The
      // caller cannot provide tenant, issuer or subject as JSON values.
      const tenantId = await this.reservation.resolveTenantForMerchant(merchantId);
      if (!tenantId || !/^tenant-(alpha|beta)$/.test(tenantId)) {
        throw new R5BReservationQaPortError('catalog_denied');
      }
      const trusted: R5BReserveInput = {
        issuer: p.issuer,
        subject: p.subject,
        tenantId, merchantId, sku, quantity,
        currency: 'EUR', mutationKey,
        claimedAmountMinor: typeof claimed === 'number' ? claimed : null,
      };
      const row = await this.reservation.reserve(trusted);
      // Independently read via a NEW PostgreSQL session to prove that
      // a database COMMIT happened before any possible PSP dispatch.
      const committed = await this.reservation.readCommitted(
        trusted.issuer, trusted.subject, trusted.mutationKey,
      );
      if (!committed || committed.reservation_id !== row.reservation_id ||
          committed.amount_minor !== row.amount_minor ||
          committed.currency !== 'EUR' || row.currency !== 'EUR' ||
          committed.status !== 'reserved' || row.status !== 'reserved') return deny();

      return {
        ok: true,
        mode: 'qa_isolated_private_only' as const,
        reservationId: row.reservation_id,
        currency: 'EUR' as const,
        amountMinor: row.amount_minor,
        status: 'reserved' as const,
        committedBeforePsp: true as const,
        paymentIntentCreated: false as const,
      };
    } catch (err: unknown) {
      if (err instanceof R5BReservationQaPortError) {
        if (err.kind === 'conflict') throw new ConflictException({
          ok: false, code: 'qa_reservation_conflict',
        });
        if (err.kind === 'catalog_denied') throw new ForbiddenException({
          ok: false, code: 'qa_merchant_catalog_not_authorized',
        });
      }
      return deny(); // SQL outage or unknown failures must fail closed.
    }
  }
}
