/**
 * DelishAfrica disconnected QA-only real commercial fulfillment adapter.
 * Merchant and Courier roles use SEPARATE least-privilege PostgreSQL logins.
 * No class here is imported by AppModule or an Expo release.
 *
 * Authorization truth: verified external OIDC principal + committed
 * Merchant membership or ACTIVE Courier roster in the Nest caller.
 * The SQL functions cannot independently validate a JWT; never trust
 * merchantSlug/courierId supplied by HTTP, nor treat a device as paid.
 */
import type { QaPgPool } from './client-commerce.pg-qa.adapter';
import type { DaAuthPrincipal } from '../auth/auth.types';
import type { MerchantMembershipContext } from
  '../catalog-foundation/catalog-foundation.types';

export type QaMerchantFulfillmentState='new'|'accepted'|'ready';
export type QaCourierDeliveryState=
  'offered'|'accepted'|'picked_up'|'delivered';
export type QaFinancialState='paid'|'financial_hold';
export type QaMerchantOrder=Readonly<{
  orderId:string;
  merchantSlug:string;
  items:ReadonlyArray<Readonly<{
    sku:string; name:string; category:string;
    quantity:number; unitAmountMinor:number; lineAmountMinor:number;
  }>>;
  amount:number;currency:'eur';
  fulfillmentState:QaMerchantFulfillmentState;
  financialState:QaFinancialState;
  dispatchEligible:boolean;
}>;
export type QaCourierOffer=Readonly<{
  orderId:string;
  merchantSlug:string;
  deliveryState:QaCourierDeliveryState;
  financialState:QaFinancialState;
  actionEligible:boolean;
}>;
export type QaRosterEvidence=Readonly<{
  issuer:string; subject:string; active:true;source:'committed-server-roster';
}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISSUER=/^https:\/\/[A-Za-z0-9.-]+\/realms\/[A-Za-z0-9_-]+$/;
const SLUG=/^[a-z0-9][a-z0-9_-]{1,119}$/;
const SKU=/^[A-Za-z0-9][A-Za-z0-9:_-]{0,79}$/;
const MERCHANT_ROLES=new Set(['owner','admin','manager','kitchen']);
function expectId(v:unknown):asserts v is string{
  if(typeof v!=='string'||!UUID.test(v))
    throw Error('qa_fulfillment_server_uuid_required');
}
function trusted(principal:DaAuthPrincipal, role:'merchant'|'courier'):void{
  if(!principal||principal.role!==role||
     principal.authSource!=='external'||principal.ownershipEligible!==true||
     !ISSUER.test(principal.issuer)||!UUID.test(principal.subject)){
    throw Error('qa_fulfillment_verified_external_identity_required');
  }
}
function membership(principal:DaAuthPrincipal,record:MerchantMembershipContext,
                    needWrite:boolean):string{
  trusted(principal,'merchant');
  if(!record||record.issuer!==principal.issuer||
     record.subject.toLowerCase()!==principal.subject.toLowerCase()||
     !SLUG.test(record.slug)||!record.accessEligible||
     record.membershipStatus!=='active'||
     record.contractStatus!=='active'||
     record.kybStatus!=='verified'||
     record.partnerLifecycleStatus!=='published'||
     record.revokedAt!==null||
     (needWrite&&!MERCHANT_ROLES.has(record.membershipRole))){
    throw Error('qa_fulfillment_merchant_membership_denied');
  }
  if(record.expiresAt!==null){
    const t=Date.parse(record.expiresAt);
    if(!Number.isFinite(t)||t<=Date.now()){
      throw Error('qa_fulfillment_merchant_membership_expired');
    }
  }
  if(record.startsAt!==null){
    const t=Date.parse(record.startsAt);
    if(!Number.isFinite(t)||t>Date.now()){
      throw Error('qa_fulfillment_merchant_membership_not_yet_active');
    }
  }
  return record.slug;
}
function courier(principal:DaAuthPrincipal,roster:QaRosterEvidence):void{
  trusted(principal,'courier');
  if(!roster||roster.active!==true||
     roster.source!=='committed-server-roster'||
     roster.issuer!==principal.issuer||
     roster.subject.toLowerCase()!==principal.subject.toLowerCase()){
    throw Error('qa_fulfillment_courier_roster_denied');
  }
}
function row<T>(result:{rows:Record<string,unknown>[]},context:string):
    Record<string,unknown>{
  if(!result || !Array.isArray(result.rows) || result.rows.length!==1){
    throw Error(context);
  }
  return result.rows[0];
}
function lines(v:unknown):QaMerchantOrder['items']{
  if(!Array.isArray(v)||v.length<1||v.length>40)
    throw Error('qa_merchant_snapshot_invalid');
  const seen=new Set<string>();
  return Object.freeze(v.map(i=>{
    if(!i||typeof i!=='object'||Array.isArray(i)||
       !SKU.test(i.sku)||seen.has(i.sku)||
       typeof i.name!=='string'||i.name.length<1||i.name.length>180||
       typeof i.category!=='string'||i.category.length<1||i.category.length>90||
       !Number.isSafeInteger(i.quantity)||i.quantity<1||i.quantity>50||
       !Number.isSafeInteger(i.unitAmountMinor)||i.unitAmountMinor<1||
       !Number.isSafeInteger(i.lineAmountMinor)||
       i.lineAmountMinor!==i.quantity*i.unitAmountMinor){
      throw Error('qa_merchant_snapshot_item_invalid');
    }
    seen.add(i.sku);
    return Object.freeze({
      sku:i.sku,name:i.name,category:i.category,quantity:i.quantity,
      unitAmountMinor:i.unitAmountMinor,lineAmountMinor:i.lineAmountMinor,
    });
  }));
}
export class QaMerchantCourierFulfillmentPgAdapter {
  constructor(
    private readonly merchantPool:QaPgPool,
    private readonly courierPool:QaPgPool,
    private readonly dispatchPool:QaPgPool,
  ){
    if(!merchantPool?.query||!courierPool?.query||!dispatchPool?.query){
      throw Error('qa_fulfillment_dedicated_pg_pools_required');
    }
  }

  async merchantInbox(principal:DaAuthPrincipal,m:MerchantMembershipContext,
                      limit=30):Promise<ReadonlyArray<QaMerchantOrder>>{
    const slug=membership(principal,m,false);
    if(!Number.isSafeInteger(limit)||limit<1||limit>50)
      throw Error('qa_merchant_inbox_limit_invalid');
    const result=await this.merchantPool.query(
      'SELECT * FROM public.da_qa_merchant_visible_paid_orders($1::varchar,$2::integer)',
      [slug,limit]);
    if(!result||!Array.isArray(result.rows)||result.rows.length>limit)
      throw Error('qa_merchant_inbox_pg_result_invalid');
    return Object.freeze(result.rows.map(r=>{
      const orderId=String(r.order_id);
      const merchantSlug=String(r.merchant_slug);
      const total=Number(r.total_minor);
      const finance=String(r.financial_state);
      const stage=String(r.fulfillment_state);
      const dispatch=r.dispatch_eligible;
      expectId(orderId);
      if(merchantSlug!==slug||
         !Number.isSafeInteger(total)||total<1||total>100000000||
         String(r.currency).trim()!=='EUR'||
         !['paid','financial_hold'].includes(finance)||
         !['new','accepted','ready'].includes(stage)||
         typeof dispatch!=='boolean'||
         dispatch!==(finance==='paid')){
        throw Error('qa_merchant_inbox_financial_or_owner_mismatch');
      }
      return Object.freeze({
        orderId,merchantSlug,items:lines(r.items),amount:total,
        currency:'eur' as const,
        fulfillmentState:stage as QaMerchantFulfillmentState,
        financialState:finance as QaFinancialState,
        dispatchEligible:dispatch,
      });
    }));
  }

  async merchantTransition(principal:DaAuthPrincipal,
    m:MerchantMembershipContext,orderId:string,
    next:'accepted'|'ready'):Promise<'accepted'|'ready'>{
    const slug=membership(principal,m,true);
    expectId(orderId);
    if(next!=='accepted'&&next!=='ready')
      throw Error('qa_merchant_transition_invalid');
    try{
      const r=row(await this.merchantPool.query(
        'SELECT public.da_qa_merchant_transition('+
          '$1::uuid,$2::varchar,$3::text) AS state',
        [orderId,slug,next]),'qa_merchant_transition_unknown');
      if(r.state!==next)throw Error('qa_merchant_transition_mismatched_state');
      return next;
    }catch{
      throw Error('qa_merchant_transition_denied_or_financial_hold');
    }
  }

  async dispatcherOffer(evidence:QaRosterEvidence,orderId:string):
      Promise<QaCourierDeliveryState>{
    expectId(orderId);
    if(!evidence||evidence.source!=='committed-server-roster'||
       evidence.active!==true||!ISSUER.test(evidence.issuer)||
       !UUID.test(evidence.subject)){
      throw Error('qa_dispatch_trusted_roster_required');
    }
    try{
      const r=row(await this.dispatchPool.query(
        'SELECT public.da_qa_dispatch_assign_offer('+
          '$1::uuid,$2::text,$3::uuid) AS state',
        [orderId,evidence.issuer,evidence.subject]),
        'qa_dispatch_offer_missing');
      if(!['offered','accepted','picked_up','delivered'].includes(String(r.state))){
        throw Error('qa_dispatch_offer_invalid');
      }
      return r.state as QaCourierDeliveryState;
    }catch{
      throw Error('qa_dispatch_not_ready_or_financial_hold');
    }
  }

  async courierOffers(principal:DaAuthPrincipal,roster:QaRosterEvidence,
    limit=20):Promise<ReadonlyArray<QaCourierOffer>>{
    courier(principal,roster);
    if(!Number.isSafeInteger(limit)||limit<1||limit>50)
      throw Error('qa_courier_inbox_limit_invalid');
    const result=await this.courierPool.query(
      'SELECT * FROM public.da_qa_courier_assigned_offers('+
        '$1::text,$2::uuid,$3::integer)',
      [principal.issuer,principal.subject,limit]);
    if(!result||!Array.isArray(result.rows)||result.rows.length>limit)
      throw Error('qa_courier_inbox_pg_result_invalid');
    return Object.freeze(result.rows.map(r=>{
      const id=String(r.order_id),slug=String(r.merchant_slug);
      const state=String(r.delivery_state),financial=String(r.financial_state);
      const eligible=r.action_eligible;
      expectId(id);
      if(!SLUG.test(slug)||
         !['offered','accepted','picked_up','delivered'].includes(state)||
         !['paid','financial_hold'].includes(financial)||
         typeof eligible!=='boolean'||eligible!==(financial==='paid')){
        throw Error('qa_courier_inbox_financial_state_invalid');
      }
      return Object.freeze({
        orderId:id,merchantSlug:slug,
        deliveryState:state as QaCourierDeliveryState,
        financialState:financial as QaFinancialState,
        actionEligible:eligible,
      });
    }));
  }

  async courierTransition(principal:DaAuthPrincipal,
    roster:QaRosterEvidence,orderId:string,
    next:'accepted'|'picked_up'|'delivered'):
    Promise<'accepted'|'picked_up'|'delivered'>{
    courier(principal,roster);
    expectId(orderId);
    if(!['accepted','picked_up','delivered'].includes(next))
      throw Error('qa_courier_transition_invalid');
    try{
      const r=row(await this.courierPool.query(
        'SELECT public.da_qa_courier_transition('+
          '$1::uuid,$2::text,$3::uuid,$4::text) AS state',
        [orderId,principal.issuer,principal.subject,next]),
        'qa_courier_transition_missing');
      if(r.state!==next)throw Error('qa_courier_transition_mismatch');
      return next;
    }catch{
      throw Error('qa_courier_transition_denied_or_financial_hold');
    }
  }
}
