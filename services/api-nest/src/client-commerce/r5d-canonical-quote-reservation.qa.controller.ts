/**
 * Private R5D QA integration endpoint. Never mount this controller in the
 * public AppModule, accept money, or reuse its loopback issuer in production.
 * The exact CatalogOrderPolicyService recalculates the quote from PostgreSQL
 * via CatalogFoundationRepository; the HTTP body cannot supply a price.
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
import { createHash } from 'node:crypto';
import { AuthService } from '../auth/auth.service';
import { CatalogOrderPolicyService } from '../order-policy/catalog-order-policy.service';
import type { CanonicalOrderQuote } from '../order-policy/catalog-order-policy.service';

export const R5D_CANONICAL_RESERVATION_QA_PORT = 'R5D_CANONICAL_RESERVATION_QA_PORT';

export type R5DTrustedQuote = {
  issuer: string;
  subject: string;
  partnerId: string;
  partnerSlug: string;
  expectedPublishedRevision: number;
  mutationKey: string;
  quoteFingerprint: string;
  quoteSnapshot: Record<string, unknown>;
};
export type R5DCommittedRow = {
  reservation_id: string;
  issuer: string;
  subject: string;
  partner_id: string;
  mutation_key: string;
  quote_fingerprint: string;
  amount_minor: number;
  currency: string;
  status: 'reserved' | 'intent_claimed' | 'intent_recorded';
};
export type R5DReservationQaPort = {
  resolvePublishedPartner(slug: string):
    Promise<{ partnerId: string; slug: string; revision: number } | null>;
  reserve(input: R5DTrustedQuote): Promise<R5DCommittedRow>;
  readCommitted(issuer: string, subject: string, mutationKey: string):
    Promise<R5DCommittedRow | null>;
};
export class R5DReservationQaPortError extends Error {
  constructor(public readonly kind:
    'conflict' | 'partner_denied' | 'revision_changed' | 'sql_unavailable',
  ) { super('r5d_' + kind); }
}
function closed(): never {
  throw new ServiceUnavailableException({
    ok: false, code: 'r5d_private_qa_checkout_unavailable',
  });
}
type CustomerItem = { id: string; quantity: number };
const QA_ISSUER = 'http://127.0.0.1:18195/realms/afritaste';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validateBody(body: unknown):
  { partnerSlug: string; items: CustomerItem[]; mutationKey: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('r5d_invalid_request_body');
  }
  const obj = body as Record<string, unknown>;
  if (Object.keys(obj).length !== 3 ||
      Object.keys(obj).some(key => !['partnerSlug', 'items', 'mutationKey'].includes(key))) {
    throw new BadRequestException('r5d_unknown_or_privileged_field');
  }
  if (typeof obj.partnerSlug !== 'string' ||
      !/^qa-[a-z0-9-]{2,60}$/.test(obj.partnerSlug) ||
      typeof obj.mutationKey !== 'string' ||
      !/^[A-Za-z0-9_-]{12,80}$/.test(obj.mutationKey) ||
      !Array.isArray(obj.items) || obj.items.length < 1 || obj.items.length > 8) {
    throw new BadRequestException('r5d_invalid_order_request');
  }
  const seen = new Set<string>();
  const items: CustomerItem[] = [];
  for (const value of obj.items) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('r5d_invalid_item');
    }
    const item = value as Record<string, unknown>;
    if (Object.keys(item).length !== 2 ||
        Object.keys(item).some(key => !['id', 'quantity'].includes(key)) ||
        typeof item.id !== 'string' ||
        !/^[a-z0-9_-]{3,80}$/.test(item.id) ||
        seen.has(item.id) ||
        typeof item.quantity !== 'number' ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 || item.quantity > 30) {
      throw new BadRequestException('r5d_item_invalid_or_duplicate');
    }
    seen.add(item.id);
    items.push({ id: item.id, quantity: item.quantity });
  }
  return { partnerSlug: obj.partnerSlug, mutationKey: obj.mutationKey, items };
}
function stableSnapshot(q: CanonicalOrderQuote): Record<string, unknown> {
  // Preserve property order of the exact quoteCore in CatalogOrderPolicyService.
  // quotedAt and partnerName are presentation fields, not charge authority.
  return {
    version: q.version,
    partnerSlug: q.partnerSlug,
    availabilityDate: q.availabilityDate,
    availabilityDay: q.availabilityDay,
    items: q.items,
    subtotal: q.subtotal,
    deliveryFee: q.deliveryFee,
    total: q.total,
    minimumOrderAmount: q.minimumOrderAmount,
    currency: q.currency,
  };
}

@Controller('qa-isolated/r5d-canonical-quote/v1')
export class R5DCanonicalQuoteReservationQaController {
  constructor(
    private readonly auth: AuthService,
    private readonly policy: CatalogOrderPolicyService,
    @Inject(R5D_CANONICAL_RESERVATION_QA_PORT)
    private readonly store: R5DReservationQaPort,
  ) {}

  @Post('reserve')
  @HttpCode(201)
  @Header('Cache-Control', 'no-store, private')
  async reserve(@Headers('authorization') authorization?: string,
                @Body() body?: unknown) {
    if (process.env.NODE_ENV !== 'test' ||
        process.env.GITHUB_ACTIONS !== 'true' ||
        process.env.QA_SYNTHETIC_ONLY !== 'YES') return closed();

    // Authenticate BEFORE ANY SQL catalogue or reservation call.
    const identity = await this.auth.resolvePrincipalFromAuthorization(authorization);
    if ('reason' in identity) {
      if (identity.reason === 'revocation_store_unavailable') return closed();
      throw new UnauthorizedException('r5d_client_jwt_required');
    }
    const p = identity.principal;
    if (p.role !== 'client' || p.authSource !== 'external' ||
        !p.ownershipEligible || p.issuer !== QA_ISSUER ||
        !UUID.test(p.subject)) {
      throw new ForbiddenException('r5d_verified_external_client_only');
    }

    const request = validateBody(body);
    try {
      const partner = await this.store.resolvePublishedPartner(request.partnerSlug);
      if (!partner || partner.slug !== request.partnerSlug ||
          !Number.isInteger(partner.revision) || partner.revision < 1) {
        throw new R5DReservationQaPortError('partner_denied');
      }
      // Actual DelishAfrica quote engine, reading the canonical PostgreSQL
      // published_payload; no fallback list and no pricing from body.
      const quote = await this.policy.quote({
        partnerSlug: request.partnerSlug,
        items: request.items,
      });
      if (quote.partnerSlug !== partner.slug || quote.currency !== 'eur' ||
          !Number.isSafeInteger(quote.total) || quote.total <= 0 ||
          quote.total > 20000000 || quote.items.length !== request.items.length) {
        return closed();
      }
      const snapshot = stableSnapshot(quote);
      const exactFingerprint = createHash('sha256')
        .update(JSON.stringify(snapshot))
        .digest('hex');
      if (exactFingerprint !== quote.quoteFingerprint) return closed();

      const trusted: R5DTrustedQuote = {
        issuer: p.issuer,
        subject: p.subject,
        partnerId: partner.partnerId,
        partnerSlug: partner.slug,
        expectedPublishedRevision: partner.revision,
        mutationKey: request.mutationKey,
        quoteFingerprint: exactFingerprint,
        quoteSnapshot: snapshot,
      };
      const reserved = await this.store.reserve(trusted);
      const committed = await this.store.readCommitted(
        p.issuer, p.subject, request.mutationKey,
      );
      if (!committed || committed.reservation_id !== reserved.reservation_id ||
          committed.issuer !== p.issuer || committed.subject !== p.subject ||
          committed.partner_id !== partner.partnerId ||
          committed.mutation_key !== request.mutationKey ||
          committed.quote_fingerprint !== exactFingerprint ||
          committed.amount_minor !== quote.total ||
          reserved.amount_minor !== quote.total ||
          committed.currency !== 'eur' || reserved.currency !== 'eur' ||
          committed.status !== 'reserved' || reserved.status !== 'reserved') {
        return closed();
      }
      return {
        ok: true,
        mode: 'r5d_private_qa' as const,
        reservationId: committed.reservation_id,
        amountMinor: committed.amount_minor,
        currency: 'eur' as const,
        status: 'reserved' as const,
        committedBeforePsp: true as const,
        paymentIntentCreated: false as const,
      };
    } catch (error: unknown) {
      if (error instanceof R5DReservationQaPortError) {
        if (error.kind === 'conflict' || error.kind === 'revision_changed') {
          throw new ConflictException('r5d_reservation_conflict');
        }
        if (error.kind === 'partner_denied') {
          throw new ForbiddenException('r5d_partner_not_available');
        }
      }
      if (error instanceof BadRequestException ||
          error instanceof ForbiddenException ||
          error instanceof ServiceUnavailableException ||
          error instanceof ConflictException) {
        throw error;
      }
      return closed();
    }
  }
}
