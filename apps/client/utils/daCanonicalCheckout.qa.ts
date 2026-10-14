/**
 * DelishAfrica Client — TWO-PHASE checkout transport contract (QA ONLY).
 *
 * This file is NOT imported by any Client screen, app entrypoint or release
 * module. The production checkout still uses old endpoints and remains frozen.
 *
 * A future QA-only UI must inject a transport that authenticates the real
 * Client OIDC session, pins the HTTPS API origin and throws on TLS/auth errors.
 * These two routes are currently present ONLY in the isolated Nest test
 * controller. Nothing here can activate a public route or contact Stripe.
 *
 * The client provides SKU + quantity, partner slug, a mutation ID and a local
 * checkout lock. The SERVER returns the order UUID, amount and fingerprints.
 * Never trust device-computed money, or treat PaymentSheet as proof of PAID.
 */
import {
  DaCheckoutAttemptFence,
  type DaCheckoutAttemptSnapshot,
} from './daCheckoutAttemptFence';

export type DaQaOrderSku=Readonly<{id:string;quantity:number}>;
export type DaQaCanonicalCheckoutInput=Readonly<{
  ownerScope:string;
  cartFingerprint:string;      // LOCAL lock fingerprint only, not financial.
  reservationDraftId:string;  // reserve:<nonce>, securely stored BEFORE HTTP.
  clientMutationId:string;
  partnerSlug:string;
  items:ReadonlyArray<DaQaOrderSku>;
}>;
export type DaQaCommerceResponse=Readonly<{
  status:number;
  data:unknown;
}>;
export interface DaQaAuthenticatedCommerceTransport {
  post(
    path:'/qa-isolated/client-commerce/orders/create' |
         '/qa-isolated/client-commerce/payments/create-intent' |
         '/qa-isolated/client-commerce/orders/status',
    payload:Record<string,unknown>,
    headers:Readonly<{ 'Idempotency-Key':string }>,
  ):Promise<DaQaCommerceResponse>;
}
export type DaQaServerOrder=Readonly<{
  orderId:string;
  clientMutationId:string;
  merchantSlug:string;
  amount:number;
  currency:'eur';
  canonicalQuoteFingerprint:string;
  canonicalCartFingerprint:string;
  state:'pending_payment';
}>;
export type DaQaPreparedStripeIntent=Readonly<{
  orderId:string;
  paymentIntentId:string;
  clientSecret:string;
  publishableKey:string;
  amount:number;
  currency:'eur';
  status:string;
  canonicalQuoteFingerprint:string;
  canonicalCartFingerprint:string;
}>;

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH=/^[a-f0-9]{64}$/;
const MUTATION=/^[A-Za-z0-9:_.-]{8,128}$/;
const SLUG=/^[a-z0-9][a-z0-9_-]{1,119}$/;
const SKU=/^[A-Za-z0-9][A-Za-z0-9:_-]{0,79}$/;
const DRAFT=/^reserve:[A-Za-z0-9_-]{10,65}$/;
function obj(raw:unknown):Record<string,unknown>|null{
  return raw!==null&&typeof raw==='object'&&!Array.isArray(raw)
    ?raw as Record<string,unknown>:null;
}
function validString(v:unknown,pattern:RegExp):v is string{
  return typeof v==='string'&&pattern.test(v);
}
function validateOrder(v:unknown,mutation:string,partner:string):
    DaQaServerOrder {
  const o=obj(v);
  if(!o||o.ok!==true||o.mode!=='test'||o.state!=='pending_payment' ||
     !validString(o.orderId,UUID)||o.clientMutationId!==mutation||
     o.merchantSlug!==partner||
     !Number.isSafeInteger(o.amount)||Number(o.amount)<1||
     Number(o.amount)>99999999||o.currency!=='eur'||
     !validString(o.canonicalQuoteFingerprint,HASH)||
     !validString(o.canonicalCartFingerprint,HASH)||
     o.paymentIntentId!==undefined||o.clientSecret!==undefined){
    throw Error('DA_QA_CANONICAL_ORDER_RESPONSE_INVALID_NO_PAYMENT');
  }
  return Object.freeze({
    orderId:o.orderId as string,
    clientMutationId:mutation,
    merchantSlug:partner,
    amount:o.amount as number,
    currency:'eur' as const,
    state:'pending_payment' as const,
    canonicalQuoteFingerprint:o.canonicalQuoteFingerprint as string,
    canonicalCartFingerprint:o.canonicalCartFingerprint as string,
  });
}
function validateIntent(v:unknown,order:DaQaServerOrder):
    DaQaPreparedStripeIntent{
  const o=obj(v);
  if(!o||o.ok!==true||o.mode!=='test'||o.provider!=='stripe'||
     o.orderId!==order.orderId||
     !validString(o.paymentIntentId,/^pi_[A-Za-z0-9_]{6,120}$/)||
     typeof o.clientSecret!=='string'||
     !o.clientSecret.startsWith(o.paymentIntentId+'_secret_')||
     !validString(o.publishableKey,/^pk_test_[A-Za-z0-9_]{12,250}$/)||
     !['requires_payment_method','requires_action','requires_confirmation'].includes(
       String(o.status))||
     o.currency!=='eur'||o.amount!==order.amount||
     o.canonicalQuoteFingerprint!==order.canonicalQuoteFingerprint||
     o.canonicalCartFingerprint!==order.canonicalCartFingerprint||
     o.paid===true||o.providerVerified===true){
    throw Error('DA_QA_CANONICAL_INTENT_RESPONSE_INVALID_NO_PAYMENT');
  }
  return Object.freeze({
    orderId:order.orderId,paymentIntentId:o.paymentIntentId as string,
    clientSecret:o.clientSecret,publishableKey:o.publishableKey as string,
    amount:order.amount,currency:'eur' as const,status:o.status as string,
    canonicalQuoteFingerprint:order.canonicalQuoteFingerprint,
    canonicalCartFingerprint:order.canonicalCartFingerprint,
  });
}

export class DaQaCanonicalCheckoutSequence {
  private busy=false;
  constructor(
    private readonly transport:DaQaAuthenticatedCommerceTransport,
    private readonly fence:DaCheckoutAttemptFence,
  ){
    if(!transport || typeof transport.post!=='function'||!fence ||
       typeof fence.begin!=='function'||typeof fence.bindServerOrderId!=='function'){
      throw Error('DA_QA_CANONICAL_DEPENDENCIES_REQUIRED');
    }
  }

  /**
   * This method only PREPARES PaymentSheet. It never presents the sheet,
   * confirms a payment, marks a remote order paid, or clears the local fence.
   */
  async reserveAndPrepare(input:DaQaCanonicalCheckoutInput):
      Promise<DaQaPreparedStripeIntent>{
    if(process.env.NODE_ENV==='production' ||
       process.env.EXPO_PUBLIC_DA_CANONICAL_CHECKOUT_QA!=='YES'){
      throw Error('DA_QA_CANONICAL_CHECKOUT_DISABLED');
    }
    if(this.busy)throw Error('DA_QA_CANONICAL_CHECKOUT_ALREADY_IN_PROGRESS');
    if(!input||!DRAFT.test(input.reservationDraftId)||
       !MUTATION.test(input.clientMutationId)||
       !SLUG.test(input.partnerSlug)||
       !Array.isArray(input.items)||input.items.length<1||input.items.length>40){
      throw Error('DA_QA_CANONICAL_CHECKOUT_INPUT_INVALID');
    }
    const ids=new Set<string>();
    const items=input.items.map((it)=>{
      if(!it||!SKU.test(it.id)||ids.has(it.id)||
         !Number.isSafeInteger(it.quantity)||
         it.quantity<1||it.quantity>50){
        throw Error('DA_QA_CANONICAL_CHECKOUT_ITEMS_INVALID');
      }
      ids.add(it.id);
      return Object.freeze({id:it.id,quantity:it.quantity});
    });
    if(items.reduce((sum,item)=>sum+item.quantity,0)>100){
      throw Error('DA_QA_CANONICAL_CHECKOUT_ITEMS_INVALID');
    }
    this.busy=true;
    try {
      // Must be written to SecureStore before even POST /orders/create.
      // On retry, begin() returns the original mutation, NEVER a fresh one.
      const started:DaCheckoutAttemptSnapshot=await this.fence.begin({
        ownerScope:input.ownerScope,
        cartFingerprint:input.cartFingerprint,
        orderId:input.reservationDraftId,
        clientMutationId:input.clientMutationId,
      });
      const mutationId=started.clientMutationId;
      const payload={partnerSlug:input.partnerSlug,items,
        clientMutationId:mutationId};
      const headers=Object.freeze({'Idempotency-Key':mutationId});
      // This authenticated transport MUST NOT retry with a new JWT subject,
      // mutation key or a different cart on network errors.
      const reserved=await this.transport.post(
        '/qa-isolated/client-commerce/orders/create',payload,headers);
      if(reserved?.status!==201){
        throw Error('DA_QA_CANONICAL_ORDER_HTTP_REJECTED_NO_PAYMENT');
      }
      const order=validateOrder(reserved.data,mutationId,input.partnerSlug);
      await this.fence.bindServerOrderId(started.orderId,order.orderId);

      const intentResponse=await this.transport.post(
        '/qa-isolated/client-commerce/payments/create-intent',
        {
          ...payload,
          orderId:order.orderId,
          canonicalQuoteFingerprint:order.canonicalQuoteFingerprint,
          canonicalCartFingerprint:order.canonicalCartFingerprint,
          // No price/total/currency/paid/clientSubject/metadata from phone.
        },headers);
      if(intentResponse?.status!==200){
        throw Error('DA_QA_CANONICAL_INTENT_HTTP_REJECTED_NO_PAYMENT');
      }
      const intent=validateIntent(intentResponse.data,order);
      // Must persist PI ID before PaymentSheet is ever presented.
      await this.fence.markIntent(order.orderId,intent.paymentIntentId);
      return intent;
    }finally {
      this.busy=false;
    }
  }

  /**
   * Only a server-side finance proof can release an uncertain PaymentSheet
   * attempt. This is NEVER called automatically as a consequence of a
   * PaymentSheet callback. It is read-only except for clearing SecureStore
   * after a signed Client-owned paid receipt matches the original PI exactly.
   */
  async reconcileVerifiedPayment():Promise<{
    financialStatus:'paid'|'awaiting_payment'|'financial_hold'|'needs_review'|'not_ready';
    cleared:boolean;
  }>{
    if(process.env.NODE_ENV==='production' ||
       process.env.EXPO_PUBLIC_DA_CANONICAL_CHECKOUT_QA!=='YES'){
      throw Error('DA_QA_CANONICAL_CHECKOUT_DISABLED');
    }
    if(this.busy)throw Error('DA_QA_CANONICAL_CHECKOUT_ALREADY_IN_PROGRESS');
    this.busy=true;
    try{
      const snapshot=await this.fence.inspect();
      if(!snapshot || !UUID.test(snapshot.orderId) ||
         !snapshot.paymentIntentId ||
         !['sheet_open','reported_success'].includes(snapshot.phase)){
        return {financialStatus:'not_ready',cleared:false};
      }
      const response=await this.transport.post(
        '/qa-isolated/client-commerce/orders/status',
        {
          orderId:snapshot.orderId,
          clientMutationId:snapshot.clientMutationId,
        },
        Object.freeze({'Idempotency-Key':snapshot.clientMutationId}),
      );
      if(response?.status!==200){
        throw Error('DA_QA_CANONICAL_FINANCE_HTTP_UNAVAILABLE');
      }
      const row=obj(response.data);
      const status=row?.financialStatus;
      if(!row||row.ok!==true||row.mode!=='test'||
         row.orderId!==snapshot.orderId||
         row.clientMutationId!==snapshot.clientMutationId||
         !['paid','awaiting_payment','financial_hold','needs_review'].includes(
           String(status))||
         row.dispatchEligible!==(status==='paid') ||
         (row.paymentIntentId!==null &&
          !validString(row.paymentIntentId,/^pi_[A-Za-z0-9_]{6,120}$/)) ||
         !validString(row.canonicalQuoteFingerprint,HASH) ||
         !validString(row.canonicalCartFingerprint,HASH) ||
         !Number.isSafeInteger(row.amount) ||
         Number(row.amount)<1 ||
         row.currency!=='eur'){
        throw Error('DA_QA_CANONICAL_FINANCE_RECEIPT_INVALID');
      }
      if(status==='paid'){
        if(row.paymentIntentId!==snapshot.paymentIntentId){
          throw Error('DA_QA_CANONICAL_FINANCE_PI_MISMATCH');
        }
        await this.fence.clearAfterVerifiedOrder(
          snapshot.orderId,snapshot.paymentIntentId);
        return {financialStatus:'paid',cleared:true};
      }
      // A refund/dispute hold, pending provider or review state must
      // preserve the lock. There is no automatic retry with a new PI.
      return {
        financialStatus:status as 'awaiting_payment'|'financial_hold'|'needs_review',
        cleared:false,
      };
    }finally{
      this.busy=false;
    }
  }
}
