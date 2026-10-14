/**
 * DelishAfrica — disconnected QA-only Client order receipt read adapter.
 * NEVER imported by AppModule, never exposed to the mobile directly.
 *
 * Requires issuer+subject from the signed native Client JWT and committed
 * admission guard. A restricted app DB login has EXECUTE on the owner-scoped
 * SQL function only, not direct SELECT/UPDATE/paid privileges.
 *
 * Financial status "paid" is emitted only after the DB verifies an actual
 * finance receipt and the absence of any refund/dispute hold. This adapter
 * NEVER calls Stripe or changes an order or payment state.
 */
import type {
  QaPgPool, QaVerifiedClient,
} from './client-commerce.pg-qa.adapter';

export type QaClientOrderFinancialStatus =
  'awaiting_payment'|'paid'|'financial_hold'|'needs_review';

export type QaOwnedOrderReceipt=Readonly<{
  orderId:string;
  clientMutationId:string;
  paymentIntentId:string|null;
  financialStatus:QaClientOrderFinancialStatus;
  dispatchEligible:boolean;
  canonicalQuoteFingerprint:string;
  canonicalCartFingerprint:string;
  merchantSlug:string;
  amount:number;
  currency:'eur';
}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH=/^[a-f0-9]{64}$/;
const MUTATION=/^[A-Za-z0-9:_.-]{8,128}$/;
const STRIPE_ID=/^pi_[A-Za-z0-9_]{6,120}$/;
const ISSUER=/^https:\/\/[A-Za-z0-9.-]+\/realms\/[A-Za-z0-9_-]+$/;

export class QaClientOwnedOrderReceiptReader {
  constructor(private readonly pool:QaPgPool) {
    if(!pool || typeof pool.query!=='function')
      throw Error('qa_receipt_pg_pool_required');
  }

  async readOwned(
    principal:QaVerifiedClient,orderId:string,mutationId:string,
  ):Promise<QaOwnedOrderReceipt> {
    if(!principal||principal.role!=='client'||
       principal.authSource!=='external'||principal.ownershipEligible!==true||
       typeof principal.issuer!=='string'||!ISSUER.test(principal.issuer)||
       typeof principal.subject!=='string'||!UUID.test(principal.subject)||
       typeof orderId!=='string'||!UUID.test(orderId)||
       typeof mutationId!=='string'||!MUTATION.test(mutationId)){
      throw Error('qa_receipt_verified_client_and_order_required');
    }
    // The SQL definer filters the exact identity/order, and returns a
    // minimal, read-only receipt. Never expose issuer, subject or SQL details.
    const result=await this.pool.query(
      'SELECT * FROM public.da_qa_client_read_owned_order('+
        '$1::uuid,$2::text,$3::uuid)',
      [orderId,principal.issuer,principal.subject],
    );
    if(!result||!Array.isArray(result.rows)||result.rows.length!==1){
      throw Error('qa_receipt_order_not_found_or_not_owned');
    }
    const r=result.rows[0];
    const status=String(r.financial_status);
    const intent=r.payment_intent_id==null?null:String(r.payment_intent_id);
    const amount=Number(r.total_minor);
    const dispatched=r.dispatch_eligible;
    if(String(r.order_id).toLowerCase()!==orderId.toLowerCase()||
       r.client_mutation_id!==mutationId||
       !HASH.test(String(r.quote_fingerprint).trim())||
       !HASH.test(String(r.cart_fingerprint).trim())||
       !/^[a-z0-9][a-z0-9_-]{1,119}$/.test(String(r.merchant_slug))||
       !Number.isSafeInteger(amount)||amount<1||amount>99999999||
       String(r.currency).trim()!=='EUR'||
       !['awaiting_payment','paid','financial_hold','needs_review'].includes(status)||
       typeof dispatched!=='boolean'||
       (intent!==null&&!STRIPE_ID.test(intent))||
       (dispatched!==true&&status==='paid')||
       (dispatched===true&&status!=='paid')||
       (status==='paid'&&intent===null)||
       (status==='financial_hold'&&intent===null)){
      throw Error('qa_receipt_database_status_inconsistent');
    }
    return Object.freeze({
      orderId:String(r.order_id).toLowerCase(),
      clientMutationId:mutationId,
      paymentIntentId:intent,
      financialStatus:status as QaClientOrderFinancialStatus,
      dispatchEligible:dispatched,
      canonicalQuoteFingerprint:String(r.quote_fingerprint).trim(),
      canonicalCartFingerprint:String(r.cart_fingerprint).trim(),
      merchantSlug:String(r.merchant_slug),
      amount,currency:'eur' as const,
    });
  }
}
