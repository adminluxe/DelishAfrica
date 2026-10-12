/**
 * DelishAfrica disconnected QA ONLY — two-phase native Client commerce HTTP.
 *
 * Deliberately not registered in AppModule/OrdersModule/PaymentsModule.
 * 1. /qa-isolated/client-commerce/orders/create reserves a canonical server
 *    quote under a signed Client JWT + durable e-mail/SMS admission.
 * 2. /qa-isolated/client-commerce/payments/create-intent REQUIRES the order UUID,
 *    immutable mutation and quote fingerprints returned by phase 1.
 *
 * SQL PostgreSQL-first reservation is mandatory; Stripe is contacted only
 * after the exact stored reservation/quote identity is rechecked. The actual
 * public routes remain unchanged and must not adopt this code until E2E,
 * official Stripe TEST and least-privilege database certification.
 */
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  Inject,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  NativeClientNestCommerceGuard,
  NATIVE_CLIENT_ADMISSION_CONTEXT,
  type NativeClientAdmittedHttpRequest,
  type NativeClientAdmissionPrincipal,
} from '../auth/native-client-nest-commerce.guard';
import type {
  QaOrderReservation,
  QaServerQuote,
} from './client-commerce.pg-qa.adapter';
import type { QaStripeTestCheckoutIntent } from
  './stripe-test-intent-create.pg-qa.adapter';

export const QA_NATIVE_CLIENT_CHECKOUT_PORTS =
  Symbol('QA_NATIVE_CLIENT_CHECKOUT_PORTS');

export type QaNativeClientCheckoutPorts = Readonly<{
  quoteFromServerCatalog: (untrustedBody: unknown) => Promise<QaServerQuote>;
  reserveCanonicalOrder: (
    principal: NativeClientAdmissionPrincipal,
    quote: QaServerQuote,
    mutationId: string,
  ) => Promise<QaOrderReservation>;
  createOrResumeStripeTest: (
    principal: NativeClientAdmissionPrincipal,
    quote: QaServerQuote,
    mutationId: string,
  ) => Promise<QaStripeTestCheckoutIntent>;
}>;

type CartObject=Record<string, unknown>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256=/^[0-9a-f]{64}$/;
const MUTATION=/^[A-Za-z0-9:_.-]{8,128}$/;

@Controller('qa-isolated/client-commerce')
export class QaIsolatedClientCommerceController {
  constructor(
    @Inject(QA_NATIVE_CLIENT_CHECKOUT_PORTS)
    private readonly ports: QaNativeClientCheckoutPorts,
  ) {}

  private principal(request: NativeClientAdmittedHttpRequest):
      NativeClientAdmissionPrincipal {
    // The guard executes first, even if the experimental QA flag is OFF.
    // Only explicit non-production and QA enablement allow any reservation.
    if (process.env.NODE_ENV === 'production' ||
        process.env.DA_QA_ISOLATED_CLIENT_COMMERCE_ENABLED !== 'YES') {
      throw new ServiceUnavailableException({
        ok: false, code: 'qa_checkout_route_disabled',
      });
    }
    const p = request?.[NATIVE_CLIENT_ADMISSION_CONTEXT];
    if (!p || p.role !== 'client' ||
        p.authSource !== 'external' || p.ownershipEligible !== true ||
        typeof p.subject !== 'string' || !UUID.test(p.subject) ||
        typeof p.issuer !== 'string') {
      throw new UnauthorizedException({
        ok: false, code: 'qa_checkout_native_client_admission_required',
      });
    }
    return p;
  }

  private prepareRequest(
    body: unknown, mutationHeader: unknown,
  ): { body: CartObject; mutationId: string } {
    if (typeof mutationHeader !== 'string' ||
        !MUTATION.test(mutationHeader)) {
      throw new BadRequestException({
        ok: false, code: 'qa_checkout_idempotency_key_required',
      });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException({
        ok: false, code: 'qa_checkout_cart_object_required',
      });
    }
    const raw = body as CartObject;
    if (raw.clientMutationId !== undefined &&
        raw.clientMutationId !== mutationHeader) {
      throw new ConflictException({
        ok: false, code: 'qa_checkout_mutation_header_body_mismatch',
      });
    }
    return { body: raw, mutationId: mutationHeader };
  }

  private async priceCart(body: CartObject): Promise<QaServerQuote> {
    let quote: QaServerQuote;
    try {
      quote = await this.ports.quoteFromServerCatalog(body);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException({
        ok: false, code: 'qa_checkout_catalog_cart_denied',
      });
    }
    if (quote?.source !== 'server-canonical-catalog' ||
        !SHA256.test(quote.quoteFingerprint) ||
        !SHA256.test(quote.cartFingerprint) ||
        quote.currency !== 'EUR' ||
        !Number.isSafeInteger(quote.totalMinor) ||
        quote.totalMinor < 1 || quote.totalMinor > 99999999) {
      throw new ServiceUnavailableException({
        ok: false, code: 'qa_checkout_canonical_quote_invalid',
      });
    }
    return quote;
  }

  private async reserve(
    principal: NativeClientAdmissionPrincipal,
    quote: QaServerQuote,
    mutationId: string,
  ): Promise<QaOrderReservation> {
    let order: QaOrderReservation;
    try {
      // Actual PG adapter serializes (issuer,subject,mutation) and binds the
      // immutable quote. It has no permission to mark a payment as paid.
      order = await this.ports.reserveCanonicalOrder(principal,quote,mutationId);
    } catch {
      throw new ServiceUnavailableException({
        ok: false, code: 'qa_checkout_order_reservation_unavailable',
      });
    }
    if (!order || !UUID.test(order.orderId) ||
        order.issuer !== principal.issuer ||
        order.clientSubject.toLowerCase() !== principal.subject.toLowerCase() ||
        order.clientMutationId !== mutationId ||
        order.quoteFingerprint !== quote.quoteFingerprint ||
        order.cartFingerprint !== quote.cartFingerprint ||
        order.merchantSlug !== quote.merchantSlug ||
        order.currency !== quote.currency ||
        order.totalMinor !== quote.totalMinor ||
        order.state !== 'pending_payment') {
      throw new ServiceUnavailableException({
        ok: false, code: 'qa_checkout_order_binding_invalid',
      });
    }
    return order;
  }

  @Post('orders/create')
  @HttpCode(201)
  @UseGuards(NativeClientNestCommerceGuard)
  async createCanonicalOrder(
    @Req() request: NativeClientAdmittedHttpRequest,
    @Body() untrustedBody: unknown,
    @Headers('idempotency-key') mutationHeader?: unknown,
  ) {
    const principal = this.principal(request);
    const {body,mutationId} = this.prepareRequest(untrustedBody,mutationHeader);
    // Caller cannot choose a local DA-xxxx or external order UUID.
    if (body.orderId !== undefined || body.id !== undefined ||
        body.paymentIntentId !== undefined || body.clientSecret !== undefined) {
      throw new ConflictException({
        ok:false, code:'qa_checkout_server_order_identity_required',
      });
    }
    const quote = await this.priceCart(body);
    const order = await this.reserve(principal,quote,mutationId);
    return {
      ok:true, mode:'test' as const, orderId:order.orderId,
      clientMutationId:order.clientMutationId,
      state:'pending_payment' as const,
      amount:quote.totalMinor, currency:quote.currency.toLowerCase(),
      canonicalQuoteFingerprint:quote.quoteFingerprint,
      canonicalCartFingerprint:quote.cartFingerprint,
      merchantSlug:quote.merchantSlug,
      // No clientSecret, provider intent, paid flag, dispatch or Stripe call.
    };
  }

  @Post('payments/create-intent')
  @HttpCode(200)
  @UseGuards(NativeClientNestCommerceGuard)
  async createIntent(
    @Req() request: NativeClientAdmittedHttpRequest,
    @Body() untrustedBody: unknown,
    @Headers('idempotency-key') mutationHeader?: unknown,
  ) {
    const principal = this.principal(request);
    const {body,mutationId} = this.prepareRequest(untrustedBody,mutationHeader);
    // The payment contract is explicitly two-step; legacy Client-generated
    // "DA-..." order IDs are rejected before even reading the provider port.
    if (typeof body.orderId !== 'string' || !UUID.test(body.orderId) ||
        typeof body.canonicalQuoteFingerprint !== 'string' ||
        !SHA256.test(body.canonicalQuoteFingerprint) ||
        typeof body.canonicalCartFingerprint !== 'string' ||
        !SHA256.test(body.canonicalCartFingerprint)) {
      throw new BadRequestException({
        ok:false, code:'qa_checkout_server_order_and_quote_required',
      });
    }
    const quote = await this.priceCart(body);
    if (body.canonicalQuoteFingerprint !== quote.quoteFingerprint ||
        body.canonicalCartFingerprint !== quote.cartFingerprint) {
      throw new ConflictException({
        ok:false, code:'qa_checkout_canonical_quote_changed',
      });
    }
    // Re-reserve with the SAME exact mutation in PostgreSQL; different SKU,
    // quote, Client or mutation cannot bind the same order reservation.
    const order = await this.reserve(principal,quote,mutationId);
    if (order.orderId.toLowerCase() !== body.orderId.toLowerCase()) {
      throw new ConflictException({
        ok:false, code:'qa_checkout_order_id_mismatch_no_payment',
      });
    }

    let intent: QaStripeTestCheckoutIntent;
    try {
      intent = await this.ports.createOrResumeStripeTest(principal,quote,mutationId);
    } catch {
      // Never disclose provider response, SQL, PSP secret or idempotency key.
      throw new ServiceUnavailableException({
        ok:false, code:'qa_checkout_test_payment_temporarily_unavailable',
      });
    }
    if (!intent || intent.mode !== 'test' ||
        intent.orderId.toLowerCase() !== order.orderId.toLowerCase() ||
        !/^pi_[A-Za-z0-9_]{6,120}$/.test(intent.paymentIntentId) ||
        !intent.clientSecret.startsWith(intent.paymentIntentId+'_secret_') ||
        !/^pk_test_[A-Za-z0-9_]{12,250}$/.test(intent.publishableKey)) {
      throw new ServiceUnavailableException({
        ok:false, code:'qa_checkout_provider_response_invalid',
      });
    }
    return {
      ok:true, mode:'test' as const, provider:'stripe' as const,
      orderId:order.orderId, paymentIntentId:intent.paymentIntentId,
      clientSecret:intent.clientSecret, publishableKey:intent.publishableKey,
      status:intent.status, amount:quote.totalMinor,
      currency:quote.currency.toLowerCase(),
      canonicalQuoteFingerprint:quote.quoteFingerprint,
      canonicalCartFingerprint:quote.cartFingerprint,
      replayed:intent.replayed,
    };
  }
}
