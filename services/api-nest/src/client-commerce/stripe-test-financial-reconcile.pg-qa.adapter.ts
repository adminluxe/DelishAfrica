/**
 * DISCONNECTED QA CANDIDATE: Stripe TEST financial reconciliation.
 * NOT imported into AppModule / PaymentsModule / OrdersModule.
 * Only a finance-specific PostgreSQL role may call the finality port.
 * The webhook inbox NEVER directly marks an order paid.
 *
 * Synthetic CI requires an injected fetcher (no external calls).
 * An official TEST call requires an explicit environment gate,
 * a server-held sk_test_ key and an account-id pin; never accepts LIVE.
 */
import {createHmac} from 'node:crypto';
import type {QaPgPool} from './client-commerce.pg-qa.adapter';

type Obj = Record<string, unknown>;
function obj(v:unknown):Obj|null {
  return v!==null && typeof v==='object' && !Array.isArray(v)?v as Obj:null;
}
function s(v:unknown):string { return typeof v==='string'?v.trim():''; }
function money(v:unknown):number {
  return typeof v==='number' && Number.isSafeInteger(v)?v:-1;
}
function uuid(v:string):boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export type QaFinanceOutcome = Readonly<{
  outcome:'captured'|'awaiting_provider'|'financial_hold';
  orderId:string;
  duplicate?:boolean;
}>;
type QaFetcher=(input:string|URL,init:RequestInit)=>Promise<Response>;
export type QaFinancialStripeConfig = Readonly<{
  stripeTestSecret:string;
  expectedAccountId:string;
  financeHmacSecret:string;
  syntheticOnly:boolean;
  fetcher?:QaFetcher;
}>;
type Authority = Readonly<{
  authorityId:string;orderId:string;issuer:string;subject:string;
  mutationId:string;quoteFingerprint:string;cartFingerprint:string;
  merchantSlug:string;totalMinor:number;currency:string;
  intentId:string;paymentState:string;orderState:string;
}>;

export class QaStripeTestFinancialReconciler {
  private readonly fetcher:QaFetcher;
  constructor(
    private readonly pool:QaPgPool,
    private readonly cfg:QaFinancialStripeConfig,
  ) {
    if(!pool || typeof pool.query!=='function' || !cfg ||
       typeof cfg.stripeTestSecret!=='string' ||
       !/^sk_test_[A-Za-z0-9_]{12,250}$/.test(cfg.stripeTestSecret) ||
       !/^acct_[A-Za-z0-9]{6,120}$/.test(cfg.expectedAccountId) ||
       typeof cfg.financeHmacSecret!=='string' || cfg.financeHmacSecret.length<32 ||
       typeof cfg.syntheticOnly!=='boolean') {
      throw Error('qa_finance_server_configuration_invalid');
    }
    if(cfg.syntheticOnly && typeof cfg.fetcher!=='function') {
      throw Error('qa_finance_synthetic_fetcher_required');
    }
    if(!cfg.syntheticOnly && process.env.QA_OFFICIAL_STRIPE_TEST_ENABLED!=='YES') {
      throw Error('qa_official_stripe_test_explicit_gate_required');
    }
    this.fetcher=cfg.fetcher || fetch;
  }

  private async stripeGet(path:string):Promise<Obj> {
    // Caller cannot supply domains/URLs: only fixed Stripe API base.
    if(!/^\/(account|payment_intents\/pi_[A-Za-z0-9_]{6,120}\?expand\[\]=latest_charge)$/.test(path)){
      throw Error('qa_stripe_path_not_allowlisted');
    }
    let response:Response;
    try {
      response=await this.fetcher('https://api.stripe.com/v1'+path,{
        method:'GET',
        headers:{Authorization:'Bearer '+this.cfg.stripeTestSecret},
        redirect:'error',
        signal:AbortSignal.timeout(12000),
      });
    } catch {
      throw Error('qa_stripe_provider_network_unavailable');
    }
    let raw:string;
    try {raw=await response.text();} catch {throw Error('qa_stripe_provider_body_unreadable');}
    if(raw.length>256*1024) throw Error('qa_stripe_provider_body_too_large');
    let json:Obj|null;
    try{json=obj(JSON.parse(raw));}catch{json=null;}
    if(!response.ok || !json || obj(json.error)) {
      throw Error('qa_stripe_provider_get_rejected');
    }
    return json;
  }

  private async readAuthority(authorityId:string):Promise<Authority> {
    if(!uuid(authorityId)) throw Error('qa_finance_authority_id_invalid');
    const result=await this.pool.query(
      'SELECT * FROM public.da_qa_finance_read_authority($1::uuid)',[authorityId]);
    if(result.rows.length!==1) throw Error('qa_finance_authority_not_ready');
    const r=result.rows[0];
    const a:Authority={
      authorityId:s(r.authority_id),orderId:s(r.order_id),
      issuer:s(r.issuer),subject:s(r.client_subject),
      mutationId:s(r.client_mutation_id),quoteFingerprint:s(r.quote_fingerprint),
      cartFingerprint:s(r.cart_fingerprint),merchantSlug:s(r.merchant_slug),
      totalMinor:money(Number(r.total_minor)),currency:s(r.currency),
      intentId:s(r.payment_intent_id),paymentState:s(r.payment_state),
      orderState:s(r.order_state),
    };
    if(a.authorityId.toLowerCase()!==authorityId.toLowerCase() ||
       !uuid(a.orderId)||!uuid(a.subject)||
       !/^pi_[A-Za-z0-9_]{6,120}$/.test(a.intentId) ||
       !/^[0-9a-f]{64}$/.test(a.quoteFingerprint)||
       !/^[0-9a-f]{64}$/.test(a.cartFingerprint)||
       a.totalMinor<1||! /^[A-Z]{3}$/.test(a.currency) ||
       !['intent_created','succeeded'].includes(a.paymentState)) {
      throw Error('qa_finance_authority_storage_invalid');
    }
    return a;
  }

  private financialProofHmac(a:Authority,chargeId:string):string {
    return createHmac('sha256',this.cfg.financeHmacSecret)
      .update(['da-stripe-qa-finality-v1',a.authorityId.toLowerCase(),
        a.orderId.toLowerCase(),a.intentId,chargeId,this.cfg.expectedAccountId,
        a.quoteFingerprint,String(a.totalMinor),a.currency].join('\0'))
      .digest('hex');
  }

  private async recordHold(a:Authority,kind:'refund'|'dispute'):Promise<void> {
    // Internal deterministic observation ID, NOT represented as a Stripe
    // refund/dispute ID. Unique by authority + kind, repeat-safe.
    const marker=createHmac('sha256',this.cfg.financeHmacSecret)
      .update(['qa-stripe-finance-hold-v1',a.authorityId,kind].join('\0'))
      .digest('hex');
    const eventId=(kind==='refund'?'re_':'dp_')+marker;
    const r=await this.pool.query(
      'SELECT * FROM public.da_qa_finance_record_hold($1::uuid,$2::text,$3::text)',
      [a.authorityId,eventId,kind]);
    if(r.rows.length!==1 || s(r.rows[0].authority_id)!==a.authorityId) {
      throw Error('qa_finance_hold_not_persisted');
    }
  }

  /** Reconciles ONLY a DB-bound PI. Webhook receipt is optional because
   * provider API verification can recover from a lost webhook.
   * No Stripe create/confirm/capture endpoint is ever invoked here. */
  async reconcileAuthority(authorityId:string,webhookEventId?:string):Promise<QaFinanceOutcome> {
    const a=await this.readAuthority(authorityId);
    const account=await this.stripeGet('/account');
    if(account.object!=='account'||s(account.id)!==this.cfg.expectedAccountId) {
      throw Error('qa_finance_stripe_account_mismatch');
    }
    const pi=await this.stripeGet('/payment_intents/'+a.intentId+'?expand[]=latest_charge');
    const m=obj(pi.metadata);
    const expected:Record<string,string>={
      orderId:a.orderId,clientIssuer:a.issuer,clientSubject:a.subject,
      clientMutationId:a.mutationId,quoteFingerprint:a.quoteFingerprint,
      cartFingerprint:a.cartFingerprint,partnerSlug:a.merchantSlug,
    };
    if(pi.object!=='payment_intent' ||s(pi.id)!==a.intentId||
       pi.livemode!==false||money(pi.amount)!==a.totalMinor||
       s(pi.currency)!==a.currency.toLowerCase()||
       pi.on_behalf_of!=null||pi.transfer_data!=null||!m||
       Object.entries(expected).some(([key,value])=>s(m[key])!==value)) {
      throw Error('qa_finance_stripe_intent_binding_mismatch');
    }
    if(s(pi.status)!=='succeeded') {
      if(a.paymentState==='succeeded') {
        throw Error('qa_finance_captured_provider_status_changed');
      }
      return Object.freeze({outcome:'awaiting_provider',orderId:a.orderId});
    }
    const ch=obj(pi.latest_charge);
    if(!ch || ch.object!=='charge'||!/^ch_[A-Za-z0-9_]{6,120}$/.test(s(ch.id))||
       ch.livemode!==false ||s(ch.payment_intent)!==a.intentId||
       money(pi.amount_received)!==a.totalMinor||
       money(ch.amount)!==a.totalMinor||
       money(ch.amount_captured)!==a.totalMinor||
       s(ch.currency)!==a.currency.toLowerCase() ||
       ch.paid!==true||ch.captured!==true||s(ch.status)!=='succeeded') {
      throw Error('qa_finance_charge_not_fully_captured_or_foreign');
    }
    const refunded=ch.refunded===true||money(ch.amount_refunded)>0;
    const disputed=ch.disputed===true;
    if(refunded||disputed){
      if(a.paymentState==='succeeded'){
        if(refunded) await this.recordHold(a,'refund');
        if(disputed) await this.recordHold(a,'dispute');
      }
      return Object.freeze({outcome:'financial_hold',orderId:a.orderId});
    }
    if(ch.refunded!==false||ch.disputed!==false||money(ch.amount_refunded)!==0){
      throw Error('qa_finance_charge_adjustment_unknown');
    }
    if(webhookEventId!==undefined &&
       !/^evt_[A-Za-z0-9_]{6,120}$/.test(webhookEventId)){
      throw Error('qa_finance_event_id_invalid');
    }
    const proof=this.financialProofHmac(a,s(ch.id));
    const result=await this.pool.query(
      'SELECT * FROM public.da_qa_finance_commit_captured_test('+
        '$1::uuid,$2::text,$3::text,$4::text,$5::bigint,'+
        '$6::char(3),$7::char(64),$8::text)',
      [a.authorityId,a.intentId,s(ch.id),this.cfg.expectedAccountId,
        a.totalMinor,a.currency,proof,webhookEventId||null]);
    if(result.rows.length!==1 ||s(result.rows[0].order_id)!==a.orderId||
       result.rows[0].paid!==true ||
       typeof result.rows[0].duplicate!=='boolean') {
      throw Error('qa_finance_database_commit_inconsistent');
    }
    return Object.freeze({outcome:'captured',orderId:a.orderId,
      duplicate:result.rows[0].duplicate as boolean});
  }

  async reconcileBatch(limit:number=25):Promise<{attempted:number;failed:number;held:number}> {
    if(!Number.isSafeInteger(limit)||limit<1||limit>100)
      throw Error('qa_finance_batch_limit_invalid');
    const rows=await this.pool.query(
      'SELECT authority_id FROM public.da_qa_finance_scan($1::integer)',[limit]);
    let failed=0,held=0;
    for(const row of rows.rows) {
      try {
        const result=await this.reconcileAuthority(s(row.authority_id));
        if(result.outcome==='financial_hold') held++;
      } catch {failed++;}
    }
    return Object.freeze({attempted:rows.rows.length,failed,held});
  }
}
