/**
 * Stripe TEST PaymentIntent creation — disconnected QA candidate ONLY.
 * NOT imported by AppModule, controllers, PaymentSheet or production runtime.
 *
 * SQL first: reserveOrder -> reserveTestPayment -> read bounded authority;
 * then Stripe TEST account check -> POST /v1/payment_intents with the SINGLE
 * server-derived Idempotency-Key -> bind same intent in PostgreSQL.
 *
 * On ambiguous HTTP/SQL failure, caller must retry this exact reservation,
 * never choose a new provider key. After conservative 18h expiry, return
 * manual_review_required, not a second PaymentIntent. No capture/confirm.
 */
import type {
  QaClientCommercePgAdapter,
  QaPgPool,
  QaServerQuote,
  QaVerifiedClient,
} from './client-commerce.pg-qa.adapter';

type Obj=Record<string,unknown>;
type QaFetcher=(url:string,options:RequestInit)=>Promise<Response>;
function object(v:unknown):Obj|null {
  return v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Obj:null;
}
function string(v:unknown):string {return typeof v==='string'?v.trim():'';}
function number(v:unknown):number {
  return typeof v==='number'&&Number.isSafeInteger(v)?v:-1;
}
function uuid(v:string):boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
type TrustedReservation=Readonly<{
  authorityId:string;orderId:string;issuer:string;subject:string;
  mutationId:string;quoteFingerprint:string;cartFingerprint:string;
  merchantSlug:string;amountMinor:number;currency:string;
  stripeKey:string;intentId:string|null;state:'reserved'|'intent_created';
  createdMs:number;
}>;
export type QaStripeTestCheckoutIntent=Readonly<{
  authorityId:string;orderId:string;paymentIntentId:string;
  clientSecret:string;publishableKey:string;
  status:string;mode:'test';replayed:boolean;
}>;
export type QaStripeTestIntentConfig=Readonly<{
  secretKey:string;
  publishableKey:string;
  expectedAccountId:string;
  syntheticOnly:boolean;
  fetcher?:QaFetcher;
  nowMs?:()=>number;
}>;
const MAX_REPLAY_AGE_MS=18*60*60*1000;
export class QaStripeTestIntentCreator {
  private readonly fetcher:QaFetcher;
  private readonly nowMs:()=>number;
  constructor(
    private readonly commerce:QaClientCommercePgAdapter,
    private readonly creatorPool:QaPgPool,
    private readonly cfg:QaStripeTestIntentConfig,
  ) {
    if(!commerce||!creatorPool||typeof creatorPool.query!=='function'||
       !cfg||typeof cfg.syntheticOnly!=='boolean'||
       !/^sk_test_[A-Za-z0-9_]{12,250}$/.test(cfg.secretKey)||
       !/^pk_test_[A-Za-z0-9_]{12,250}$/.test(cfg.publishableKey)||
       !/^acct_[A-Za-z0-9]{6,120}$/.test(cfg.expectedAccountId)||
       (cfg.syntheticOnly&&typeof cfg.fetcher!=='function')) {
      throw Error('qa_checkout_test_only_server_config_required');
    }
    if(!cfg.syntheticOnly&&(
       process.env.QA_OFFICIAL_STRIPE_TEST_ENABLED!=='YES' ||
       process.env.QA_OFFICIAL_STRIPE_TEST_ISOLATED_RUNTIME!=='YES')) {
      throw Error('qa_checkout_explicit_stripe_test_gate_required');
    }
    this.fetcher=cfg.fetcher||fetch;
    this.nowMs=cfg.nowMs||Date.now;
  }

  private async call(method:'GET'|'POST',path:string,
      body?:URLSearchParams,stripeKey?:string):Promise<Obj> {
    if(!['/account','/payment_intents'].includes(path)&&
       !/^\/payment_intents\/pi_[A-Za-z0-9_]{6,120}$/.test(path)) {
      throw Error('qa_checkout_provider_path_forbidden');
    }
    if(method==='POST'&&path!=='/payment_intents') {
      throw Error('qa_checkout_provider_mutation_forbidden');
    }
    let response:Response;
    try {
      response=await this.fetcher('https://api.stripe.com/v1'+path,{
        method,redirect:'error',
        signal:AbortSignal.timeout(12000),
        headers:{
          Authorization:'Bearer '+this.cfg.secretKey,
          ...(method==='POST'?{
            'Content-Type':'application/x-www-form-urlencoded',
            'Idempotency-Key':string(stripeKey),
          }:{}),
        },
        ...(body?{body:body.toString()}:{}),
      });
    }catch {
      throw Error('qa_checkout_provider_transport_ambiguous_retry_same_key');
    }
    let raw:string;
    try {raw=await response.text();}catch{
      throw Error('qa_checkout_provider_response_unreadable');
    }
    if(raw.length>256*1024) throw Error('qa_checkout_provider_body_limit');
    let value:Obj|null;
    try {value=object(JSON.parse(raw));}catch {value=null;}
    if(!response.ok ||!value||object(value.error)) {
      throw Error('qa_checkout_provider_non_success_retry_same_key');
    }
    return value;
  }

  private async readReservation(
    authorityId:string,client:QaVerifiedClient,
  ):Promise<TrustedReservation> {
    const result=await this.creatorPool.query(
      'SELECT * FROM public.da_qa_provider_read_reserved_test_intent('+
      '$1::uuid,$2::text,$3::uuid)',
      [authorityId,client.issuer,client.subject]);
    if(result.rows.length!==1) throw Error('qa_checkout_authority_not_ready');
    const r=result.rows[0];
    const createdMs=new Date(String(r.created_at)).getTime();
    const state=string(r.payment_state);
    if(!uuid(string(r.authority_id)) ||!uuid(string(r.order_id)) ||
       !uuid(string(r.client_subject)) ||
       !['reserved','intent_created'].includes(state) ||
       !/^da-qa-test-v1-[0-9a-f]{64}$/.test(string(r.stripe_idempotency_key)) ||
       !Number.isFinite(createdMs) ||
       number(Number(r.total_minor))<1 ||
       !/^[A-Z]{3}$/.test(string(r.currency))) {
      throw Error('qa_checkout_pg_reservation_invalid');
    }
    return Object.freeze({
      authorityId:string(r.authority_id),orderId:string(r.order_id),
      issuer:string(r.issuer),subject:string(r.client_subject),
      mutationId:string(r.client_mutation_id),
      quoteFingerprint:string(r.quote_fingerprint),
      cartFingerprint:string(r.cart_fingerprint),
      merchantSlug:string(r.merchant_slug),
      amountMinor:number(Number(r.total_minor)),currency:string(r.currency),
      stripeKey:string(r.stripe_idempotency_key),
      intentId:r.stripe_payment_intent_id==null?null:string(r.stripe_payment_intent_id),
      state:state as 'reserved'|'intent_created',
      createdMs,
    });
  }

  private verifyResponse(v:Obj,a:TrustedReservation):{
    id:string;clientSecret:string;status:string;
  } {
    const id=string(v.id),clientSecret=string(v.client_secret);
    const m=object(v.metadata);
    const binding:Record<string,string>={
      orderId:a.orderId,clientIssuer:a.issuer,clientSubject:a.subject,
      clientMutationId:a.mutationId,quoteFingerprint:a.quoteFingerprint,
      cartFingerprint:a.cartFingerprint,partnerSlug:a.merchantSlug,
    };
    if(v.object!=='payment_intent'||!/^pi_[A-Za-z0-9_]{6,120}$/.test(id)||
       v.livemode!==false ||number(v.amount)!==a.amountMinor||
       string(v.currency)!==a.currency.toLowerCase()||
       !m||Object.entries(binding).some(([k,val])=>string(m[k])!==val)||
       !clientSecret.startsWith(id+'_secret_')||
       !/^[A-Za-z0-9_]+$/.test(clientSecret.slice(id.length+8))||
       v.on_behalf_of!=null||v.transfer_data!=null||
       !['requires_payment_method','requires_confirmation','requires_action',
         'processing','succeeded'].includes(string(v.status))) {
      throw Error('qa_checkout_provider_intent_binding_mismatch');
    }
    return {id,clientSecret,status:string(v.status)};
  }

  async createOrResume(
    client:QaVerifiedClient,serverQuote:QaServerQuote,mutationId:string,
  ):Promise<QaStripeTestCheckoutIntent> {
    // reserveOrder verifies the caller principal and immutable server quote.
    // reserveTestPayment serializes the authority and derives its server HMAC
    // idempotency key. This MUST precede any Stripe HTTP operation.
    const order=await this.commerce.reserveOrder(client,serverQuote,mutationId);
    const authority=await this.commerce.reserveTestPayment(client,order.orderId);
    const a=await this.readReservation(authority.authorityId,client);
    if(a.orderId!==order.orderId||a.issuer!==client.issuer||
       a.subject.toLowerCase()!==client.subject.toLowerCase()||
       a.mutationId!==mutationId||
       a.quoteFingerprint!==serverQuote.quoteFingerprint||
       a.cartFingerprint!==serverQuote.cartFingerprint||
       a.merchantSlug!==serverQuote.merchantSlug||
       a.amountMinor!==serverQuote.totalMinor||a.currency!=='EUR'||
       a.amountMinor>99999999||
       a.stripeKey!==authority.stripeIdempotencyKey||
       a.intentId!==authority.stripePaymentIntentId) {
      throw Error('qa_checkout_commerce_quote_or_authority_mismatch');
    }
    const now=this.nowMs();
    if(!Number.isSafeInteger(now)||now<a.createdMs-300000) {
      throw Error('qa_checkout_server_clock_invalid');
    }
    // Stripe may prune idempotency results after 24h. 18h is a strict stop.
    // A missing DB intent after that point requires operator reconciliation,
    // NOT blindly creating a potentially second PaymentIntent.
    if(!a.intentId &&now-a.createdMs>=MAX_REPLAY_AGE_MS) {
      throw Error('qa_checkout_ambiguous_old_reservation_manual_review');
    }
    const account=await this.call('GET','/account');
    if(account.object!=='account'||
       string(account.id)!==this.cfg.expectedAccountId) {
      throw Error('qa_checkout_wrong_stripe_test_account');
    }
    let v:Obj;
    if(a.intentId){
      v=await this.call('GET','/payment_intents/'+a.intentId);
    }else{
      const params=new URLSearchParams();
      params.set('amount',String(a.amountMinor));
      params.set('currency',a.currency.toLowerCase());
      params.set('automatic_payment_methods[enabled]','true');
      params.set('capture_method','automatic');
      params.set('confirm','false');
      const metadata:Record<string,string>={
        orderId:a.orderId,clientIssuer:a.issuer,clientSubject:a.subject,
        clientMutationId:a.mutationId,quoteFingerprint:a.quoteFingerprint,
        cartFingerprint:a.cartFingerprint,partnerSlug:a.merchantSlug,
      };
      for(const [k,value] of Object.entries(metadata))
        params.set('metadata['+k+']',value);
      v=await this.call('POST','/payment_intents',params,a.stripeKey);
    }
    const verified=this.verifyResponse(v,a);
    if(a.intentId&&verified.id!==a.intentId) {
      throw Error('qa_checkout_existing_provider_intent_changed');
    }
    // DB binding failure after provider POST is retried with SAME reserved
    // HMAC key and SAME provider parameters; no new reservation is created.
    const recorded=await this.creatorPool.query(
      'SELECT * FROM public.da_qa_provider_bind_test_intent('+
      '$1::uuid,$2::text,$3::bigint,$4::char(3))',
      [a.authorityId,verified.id,a.amountMinor,a.currency]);
    if(recorded.rows.length!==1||
       string(recorded.rows[0].authority_id)!==a.authorityId||
       string(recorded.rows[0].stripe_payment_intent_id)!==verified.id) {
      throw Error('qa_checkout_pg_intent_bind_failed');
    }
    return Object.freeze({
      authorityId:a.authorityId,orderId:a.orderId,
      paymentIntentId:verified.id,clientSecret:verified.clientSecret,
      publishableKey:this.cfg.publishableKey,
      status:verified.status,mode:'test' as const,
      replayed:recorded.rows[0].duplicate===true,
    });
  }
}
