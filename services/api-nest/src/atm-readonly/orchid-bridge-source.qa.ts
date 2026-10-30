/**
 * Isolated server-side candidate for OrchidPay -> DelishAfrica -> ATM.
 * Never call from mobile. No live financial claims or bank balances.
 * Strictly shadow-only; blocked until data authority and issuer/audience are certified.
 */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {isAbsolute} from 'node:path';
import type {ReadScope} from './atm-readonly.core';

type PaymentRef = Readonly<{orderId:string; merchantSlug:string; paymentIntentId:string}>;
export type ScopedOrderPort = Readonly<{
  listRecentMerchantPaymentReferences:(merchantSlug:string,limit:number)=>Promise<readonly PaymentRef[]>;
}>;
export type OrchidOrderRead = Readonly<{
  readReconciliation:(orderId:string)=>Promise<unknown>;
}>;
const safeId=(x:unknown):x is string=>
  typeof x==='string' && /^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/.test(x);
const object=(x:unknown):x is Record<string,unknown>=>
  !!x && typeof x==='object' && !Array.isArray(x);

export class ServerOnlyOrchidBridgeRead implements OrchidOrderRead {
  private readonly endpoint='http://127.0.0.1:8091';
  constructor(private readonly transport:typeof fetch=globalThis.fetch,
              private readonly readToken:(file:string)=>string=path=>readFileSync(path,'utf8')) {}
  async readReconciliation(orderId:string):Promise<unknown> {
    if(process.env.NODE_ENV==='production' ||
       process.env.DA_ATM_ORCHID_BRIDGE_QA_ENABLED!=='YES' || !safeId(orderId))
      throw Error('orchidpay_read_not_certified');
    const file=String(process.env.DA_ATM_ORCHID_BFF_TOKEN_FILE||'').trim();
    if(!isAbsolute(file) || file.length>350 || /[\r\n]/.test(file))
      throw Error('orchidpay_service_secret_not_provisioned');
    const secret=this.readToken(file).trim();
    if(secret.length<32 || secret.length>512 || /\s/.test(secret))
      throw Error('orchidpay_service_secret_not_provisioned');
    const abort=new AbortController();
    const timeout=setTimeout(()=>abort.abort(),3500);
    try {
      const response=await this.transport(
        this.endpoint+'/api/pay/orchidpay/reconciliation/order/'+encodeURIComponent(orderId),{
          method:'GET',redirect:'error',cache:'no-store',signal:abort.signal,
          headers:{'Accept':'application/json','X-ATM-Token':secret},
        });
      if(response.status!==200 || !String(response.headers.get('content-type')||'')
          .includes('application/json')) throw Error('orchidpay_response_unavailable');
      const length=Number(response.headers.get('content-length')||0);
      if(length>16384) throw Error('orchidpay_response_too_large');
      const body=await response.text();
      if(Buffer.byteLength(body,'utf8')>16384) throw Error('orchidpay_response_too_large');
      return JSON.parse(body) as unknown;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class OrchidBridgeScopedShadowSource {
  constructor(private readonly orders:ScopedOrderPort,
              private readonly bridge:OrchidOrderRead) {}

  async readFinance(scope:ReadScope):Promise<unknown>{
    if(process.env.NODE_ENV==='production' ||
       process.env.DA_ATM_ORCHID_BRIDGE_QA_ENABLED!=='YES' ||
       !/^[a-z0-9][a-z0-9_-]{1,119}$/.test(scope.slug))
      throw Error('orchidpay_financial_read_not_certified');

    // Scope from server-side owner + eligible finance membership, never URL/body.
    const refs=await this.orders.listRecentMerchantPaymentReferences(scope.slug,10);
    if(!Array.isArray(refs)||refs.length>10)throw Error('untrusted_order_scope');
    const seen=new Set<string>();
    const events=[];
    const now=new Date().toISOString();
    for(const row of refs){
      if(row.merchantSlug!==scope.slug || !safeId(row.orderId) ||
         !safeId(row.paymentIntentId) || seen.has(row.orderId))
        throw Error('order_scope_mismatch');
      seen.add(row.orderId);
      const upstream=await this.bridge.readReconciliation(row.orderId);
      if(!object(upstream) || upstream.ok!==true || upstream.orderId!==row.orderId ||
         upstream.paymentIntentId!==row.paymentIntentId ||
         !safeId(upstream.recordId) ||
         !['pending','confirmed','failed','reversed'].includes(String(upstream.state))) {
        // No mapping from an unknown upstream schema into invented money.
        throw Error('orchidpay_reconciliation_contract_unrecognized');
      }
      const canonical=JSON.stringify([
        scope.slug,row.orderId,row.paymentIntentId,upstream.recordId,upstream.state]);
      const digest=createHash('sha256').update(canonical).digest('hex');
      events.push({
        tenantId:'delishafrica',merchantId:scope.merchantId,
        siteId:'marketplace',partyId:scope.merchantId,orderId:row.orderId,
        id:'bridge_'+digest.slice(0,32),sourceKind:'orchidpay-bridge-shadow',
        sourceRef:String(upstream.recordId),sourceSHA:digest,observedAt:now,effectiveAt:now,
        eventVersion:1,mode:'SHADOW',kind:'LEDGER_SHADOW',verified:false,
        amountMinor:null,currency:null,paymentId:row.paymentIntentId,
      });
    }
    return {mode:'SHADOW',readOnly:true,tenantId:'delishafrica',
      merchantId:scope.merchantId,events};
  }
}
