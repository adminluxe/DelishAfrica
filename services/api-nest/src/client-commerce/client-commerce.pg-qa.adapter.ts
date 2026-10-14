/**
 * Candidate PostgreSQL adapter for Client commerce in disposable QA ONLY.
 * NOT imported in AppModule / OrdersModule / PaymentsModule.
 *
 * Its caller MUST supply a principal obtained from a verified, issuer-pinned
 * Client JWT + committed e-mail/SMS admission check, and a quote produced by
 * the authoritative server catalog (NEVER from HTTP body or JWT claims).
 *
 * The PostgreSQL role must have EXECUTE on QA reservation functions only.
 * This adapter reserves records; it NEVER contacts Stripe, marks payment
 * succeeded, creates dispatch missions, or creates a live Order.
 * The payment authority verifier + its restricted DB role are NOT implemented.
 */
import { createHmac } from 'node:crypto';

export type QaPgQueryResult = { rows: Record<string, unknown>[] };
export interface QaPgClient {
  query(text: string, values?: readonly unknown[]): Promise<QaPgQueryResult>;
  release(): void;
}
export interface QaPgPool {
  query(text: string, values?: readonly unknown[]): Promise<QaPgQueryResult>;
  connect(): Promise<QaPgClient>;
}

export type QaVerifiedClient = Readonly<{
  issuer: string;
  subject: string;
  role: 'client';
  authSource: 'external';
  ownershipEligible: true;
}>;

export type QaCanonicalFulfillmentSnapshot = Readonly<{
  subtotalMinor: number;
  deliveryFeeMinor: number;
  lines: ReadonlyArray<Readonly<{
    sku: string;
    name: string;
    category: string;
    quantity: number;
    unitAmountMinor: number;
    lineAmountMinor: number;
  }>>;
}>;
export type QaServerQuote = Readonly<{
  source: 'server-canonical-catalog';
  quoteFingerprint: string;
  cartFingerprint: string;
  merchantSlug: string;
  totalMinor: number;
  currency: string;
  // Present only for the NEW atomic reservation route in disconnected QA.
  // Existing synthetic finance tests do not require merchant fulfillment.
  fulfillment?: QaCanonicalFulfillmentSnapshot;
}>;

export interface QaOrderReservation {
  orderId: string;
  issuer: string;
  clientSubject: string;
  clientMutationId: string;
  quoteFingerprint: string;
  cartFingerprint: string;
  merchantSlug: string;
  totalMinor: number;
  currency: string;
  state: string;
}
export interface QaPaymentReservation {
  authorityId: string;
  orderId: string;
  stripeMode: 'test';
  stripeIdempotencyKey: string;
  stripePaymentIntentId: string | null;
  state: string;
}

function validUuid(x: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
}
function validIssuer(x: string): boolean {
  return /^https:\/\/[A-Za-z0-9.-]+\/realms\/[A-Za-z0-9_-]+$/.test(x);
}
function validHex(x: string): boolean {
  return /^[0-9a-f]{64}$/.test(x);
}
function validateClient(client: QaVerifiedClient): void {
  if (!client || client.role !== 'client' ||
      client.authSource !== 'external' ||
      client.ownershipEligible !== true ||
      !validUuid(client.subject) || !validIssuer(client.issuer)) {
    throw Error('qa_verified_client_required');
  }
}
function validateQuote(quote: QaServerQuote): void {
  if (!quote || quote.source !== 'server-canonical-catalog' ||
      !validHex(quote.quoteFingerprint) || !validHex(quote.cartFingerprint) ||
      !/^[a-z0-9][a-z0-9_-]{1,119}$/.test(quote.merchantSlug) ||
      !Number.isSafeInteger(quote.totalMinor) ||
      quote.totalMinor < 1 || quote.totalMinor > 100000000 ||
      !/^[A-Z]{3}$/.test(quote.currency)) {
    throw Error('qa_trusted_server_quote_required');
  }
}
function requiredRow(result: QaPgQueryResult, context: string): Record<string, unknown> {
  if (result.rows.length !== 1) throw Error(context);
  return result.rows[0];
}
function moneyMinor(value: unknown): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > 100000000) {
    throw Error('qa_commerce_money_out_of_range');
  }
  return n;
}

/** One adapter can run on multiple NestJS instances with the SAME HMAC key. */
export class QaClientCommercePgAdapter {
  constructor(
    private readonly pool: QaPgPool,
    private readonly providerIdempotencyHmacKey: string,
  ) {
    if (!pool || typeof pool.query !== 'function' ||
        typeof pool.connect !== 'function' ||
        typeof providerIdempotencyHmacKey !== 'string' ||
        providerIdempotencyHmacKey.length < 32) {
      throw Error('qa_commerce_adapter_server_configuration_invalid');
    }
  }

  async reserveOrder(
    client: QaVerifiedClient,
    quote: QaServerQuote,
    mutationId: string,
  ): Promise<QaOrderReservation> {
    validateClient(client);
    validateQuote(quote);
    if (typeof mutationId !== 'string' ||
        !/^[A-Za-z0-9:_.-]{8,128}$/.test(mutationId)) {
      throw Error('qa_client_mutation_id_invalid');
    }
    const result = await this.pool.query(
      'SELECT * FROM public.da_qa_service_reserve_order(' +
      '$1::text,$2::uuid,$3::varchar,$4::char(64),' +
      '$5::char(64),$6::varchar,$7::bigint,$8::char(3))',
      [client.issuer, client.subject, mutationId,
        quote.quoteFingerprint, quote.cartFingerprint,
        quote.merchantSlug, quote.totalMinor, quote.currency],
    );
    const row=requiredRow(result,'qa_reservation_database_inconsistent');
    const order:QaOrderReservation={
      orderId:String(row.order_id),
      issuer:String(row.issuer),
      clientSubject:String(row.client_subject),
      clientMutationId:String(row.client_mutation_id),
      quoteFingerprint:String(row.quote_fingerprint).trim(),
      cartFingerprint:String(row.cart_fingerprint).trim(),
      merchantSlug:String(row.merchant_slug).trim(),
      totalMinor:moneyMinor(row.total_minor),
      currency:String(row.currency).trim(),
      state:String(row.state),
    };
    if (order.issuer!==client.issuer ||
        order.clientSubject.toLowerCase()!==client.subject.toLowerCase() ||
        order.clientMutationId!==mutationId ||
        order.quoteFingerprint!==quote.quoteFingerprint ||
        order.cartFingerprint!==quote.cartFingerprint ||
        order.totalMinor!==quote.totalMinor ||
        order.currency!==quote.currency ||
        order.merchantSlug!==quote.merchantSlug ||
        order.state!=='pending_payment') {
      throw Error('qa_order_reservation_binding_mismatch');
    }
    return Object.freeze(order);
  }

  private idempotencyKey(client: QaVerifiedClient, orderId: string): string {
    const digest=createHmac('sha256',this.providerIdempotencyHmacKey)
      .update('da-client-commerce-qa-v1\0')
      .update(client.issuer).update('\0')
      .update(client.subject.toLowerCase()).update('\0')
      .update(orderId.toLowerCase()).digest('hex');
    return 'da-qa-test-v1-'+digest;
  }

  /**
   * Atomically reserve Stripe TEST correlation after locking an existing
   * trusted order row. A replay returns the SAME payment authority and SAME
   * server-derived Stripe Idempotency-Key. It DOES NOT call Stripe.
   *
   * Do not create a new provider idempotency key to repair a failed HTTP call;
   * reconcile the already reserved order with Stripe's API instead.
   */
  async reserveTestPayment(
    client: QaVerifiedClient,
    orderId: string,
  ): Promise<QaPaymentReservation> {
    validateClient(client);
    if (!validUuid(orderId)) throw Error('qa_order_id_invalid');
    const key=this.idempotencyKey(client,orderId);
    // SQL SECURITY DEFINER port performs SELECT ... FOR UPDATE followed by
    // INSERT ON CONFLICT. The unprivileged app login has NO table DML grants.
    // The entire statement is atomic in PostgreSQL and serializes replays.
    const result=await this.pool.query(
      'SELECT * FROM public.da_qa_service_reserve_test_payment('+
      '$1::uuid,$2::text,$3::uuid,$4::varchar)',
      [orderId,client.issuer,client.subject,key],
    );
    const row=requiredRow(result,'qa_payment_authority_missing');
    if(String(row.stripe_idempotency_key)!==key ||
        String(row.stripe_mode)!=='test' ||
        String(row.issuer)!==client.issuer ||
        String(row.client_subject).toLowerCase()!==client.subject.toLowerCase() ||
        String(row.order_id).toLowerCase()!==orderId.toLowerCase()) {
      throw Error('qa_payment_authority_binding_mismatch');
    }
    return Object.freeze({
      authorityId:String(row.authority_id),
      orderId:String(row.order_id),
      stripeMode:'test' as const,
      stripeIdempotencyKey:key,
      stripePaymentIntentId:row.stripe_payment_intent_id===null
        ?null:String(row.stripe_payment_intent_id),
      state:String(row.state),
    });
  }
}
