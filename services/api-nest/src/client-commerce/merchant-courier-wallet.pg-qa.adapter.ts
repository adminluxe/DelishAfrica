/**
 * DelishAfrica QA 009 -- transaction-backed Merchant/Courier earnings.
 *
 * Real PostgreSQL function calls, but synthetic TEST-only money.
 * The phone never computes prices, commissions, beneficiary or paid status.
 * NO payout APIs, no bank/Stripe Connect and NO AppModule wiring.
 */
import type { QaPgPool } from './client-commerce.pg-qa.adapter';
import type { DaAuthPrincipal } from '../auth/auth.types';
import type { MerchantMembershipContext } from '../catalog-foundation/catalog-foundation.types';
import {
  qaRequireMerchantMembership,qaRequireCourierRoster,
  type QaRosterEvidence,
} from './merchant-courier-fulfillment.pg-qa.adapter';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG=/^[a-z0-9][a-z0-9_-]{1,119}$/;
const POLICY=/^QA_[A-Za-z0-9_]{3,61}$/;

export type QaWalletSummary=Readonly<{
  currency:'EUR';
  accruedMinor:number;
  pendingMinor:number;
  availableMinor:number;
  heldMinor:number;
  withdrawableMinor:0;
  payoutEnabled:false;
  orderCount:number;
  source:'stripe_test_synthetic_pg_verified_capture';
}>;
export type QaWalletActivity=Readonly<{
  orderId:string; currency:'EUR'; earnedMinor:number;
  financialState:'captured'|'financial_hold';
  stage:string; occurredAt:string;
  grossMinor?:number;feeMinor?:number;policyId?:string;
}>;
export type QaWalletResponse=Readonly<{
  summary:QaWalletSummary;
  activity:ReadonlyArray<QaWalletActivity>;
}>;

function integer(value:unknown,label:string):number{
  const v=Number(value);
  if((typeof value!=='number'&&typeof value!=='string')||
     (typeof value==='string'&&!/^[0-9]{1,15}$/.test(value))||
      !Number.isSafeInteger(v)||v<0){
    throw Error('qa_wallet_pg_invalid_'+label);
  }
  return v;
}
function single(result:{rows:Record<string,unknown>[]},label:string):
  Record<string,unknown>{
  if(!result||!Array.isArray(result.rows)||result.rows.length!==1)
    throw Error('qa_wallet_pg_unexpected_'+label);
  return result.rows[0];
}
function summary(row:Record<string,unknown>):QaWalletSummary{
  const currency=String(row.currency||'').trim();
  if(currency!=='EUR')throw Error('qa_wallet_currency_not_supported');
  const accrued=integer(row.accrued_minor,'accrued');
  const pending=integer(row.pending_minor,'pending');
  const available=integer(row.available_minor,'available');
  const held=integer(row.held_minor,'held');
  const withdrawable=integer(row.withdrawable_minor,'withdrawable');
  const count=integer(row.order_count,'count');
  if(accrued!==pending+available+held || withdrawable!==0 ||
     row.payout_enabled!==false)throw Error('qa_wallet_ledger_unbalanced');
  return Object.freeze({
    currency:'EUR' as const,
    accruedMinor:accrued,pendingMinor:pending,availableMinor:available,
    heldMinor:held,withdrawableMinor:0 as const,
    payoutEnabled:false as const,orderCount:count,
    source:'stripe_test_synthetic_pg_verified_capture' as const,
  });
}
function activity(rows:Record<string,unknown>[],merchant:boolean,limit:number):
  ReadonlyArray<QaWalletActivity>{
  if(!Array.isArray(rows)||rows.length>limit)
    throw Error('qa_wallet_activity_pg_size_invalid');
  return Object.freeze(rows.map(row=>{
    const orderId=String(row.order_id),currency=String(row.currency||'').trim();
    const state=String(row.financial_state||'');
    const stage=String(merchant?row.fulfillment_state:row.delivery_state);
    const occurredAt=new Date(String(row.occurred_at)).toISOString();
    if(!UUID.test(orderId)||currency!=='EUR'||
       (state!=='captured'&&state!=='financial_hold')||
       !(merchant?['new','accepted','ready']:['offered','accepted','picked_up','delivered'])
         .includes(stage)){
      throw Error('qa_wallet_activity_invalid');
    }
    const earned=integer(row.earned_minor,'earned');
    if(earned<1)throw Error('qa_wallet_activity_zero_earning');
    if(!merchant)return Object.freeze({
      orderId,currency:'EUR' as const,earnedMinor:earned,
      financialState:state as 'captured'|'financial_hold',
      stage,occurredAt,
    });
    const gross=integer(row.gross_minor,'gross');
    const fee=integer(row.fee_minor,'fee');
    const policy=String(row.policy_id||'');
    if(!POLICY.test(policy)||gross!==fee+earned){
      throw Error('qa_wallet_merchant_activity_unbalanced');
    }
    return Object.freeze({
      orderId,currency:'EUR' as const,earnedMinor:earned,
      financialState:state as 'captured'|'financial_hold',
      stage,occurredAt,
      grossMinor:gross,feeMinor:fee,policyId:policy,
    });
  }));
}

export class QaMerchantCourierWalletPgAdapter {
  constructor(
    private readonly merchantPool:Pick<QaPgPool,'query'>,
    private readonly courierPool:Pick<QaPgPool,'query'>,
    private readonly financePool:Pick<QaPgPool,'query'>,
  ){
    if(!merchantPool?.query||!courierPool?.query||!financePool?.query){
      throw Error('qa_wallet_separate_pg_roles_required');
    }
  }

  /** Finance reconciliation service ONLY; must never be an HTTP route. */
  async accrueVerifiedCapture(orderId:string):Promise<Readonly<{
    orderId:string;replayed:boolean;
  }>>{
    if(typeof orderId!=='string'||!UUID.test(orderId))
      throw Error('qa_wallet_order_uuid_invalid');
    const row=single(await this.financePool.query(
      'SELECT * FROM public.da_qa_wallet_accrue_verified_capture($1::uuid)',
      [orderId]),'finance_accrual');
    if(row.order_id!==orderId||typeof row.duplicate!=='boolean')
      throw Error('qa_wallet_accrual_db_mismatch');
    return Object.freeze({orderId,replayed:row.duplicate});
  }

  async merchantWallet(
    principal:DaAuthPrincipal,member:MerchantMembershipContext,limit=30,
  ):Promise<QaWalletResponse>{
    const slug=qaRequireMerchantMembership(principal,member,false);
    if(!SLUG.test(slug)||!Number.isSafeInteger(limit)||limit<1||limit>50)
      throw Error('qa_wallet_merchant_scope_invalid');
    const sm=summary(single(await this.merchantPool.query(
      'SELECT * FROM public.da_qa_wallet_merchant_summary($1::varchar)',
      [slug]),'merchant_summary'));
    const result=await this.merchantPool.query(
      'SELECT * FROM public.da_qa_wallet_merchant_activity('+
        '$1::varchar,$2::integer)',[slug,limit]);
    const list=activity(result.rows,true,limit);
    return Object.freeze({summary:sm,activity:list});
  }

  async courierWallet(
    principal:DaAuthPrincipal,roster:QaRosterEvidence,limit=20,
  ):Promise<QaWalletResponse>{
    qaRequireCourierRoster(principal,roster);
    if(!Number.isSafeInteger(limit)||limit<1||limit>50)
      throw Error('qa_wallet_courier_scope_invalid');
    const params=[principal.issuer,principal.subject];
    const sm=summary(single(await this.courierPool.query(
      'SELECT * FROM public.da_qa_wallet_courier_summary($1::text,$2::uuid)',
      params),'courier_summary'));
    const result=await this.courierPool.query(
      'SELECT * FROM public.da_qa_wallet_courier_activity('+
        '$1::text,$2::uuid,$3::integer)',[...params,limit]);
    const list=activity(result.rows,false,limit);
    return Object.freeze({summary:sm,activity:list});
  }
}
