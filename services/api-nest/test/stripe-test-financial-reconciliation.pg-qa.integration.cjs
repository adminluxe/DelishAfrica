'use strict';
/**
 * Real PostgreSQL 17 + independent Stripe API retrieval STUB:
 * all client/charge identities are synthetic; provider HTTP calls ZERO.
 * DISCONNECTED CI ONLY. No VPS, no real Stripe, no production roles.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {Pool}=require('pg');
const {QaClientCommercePgAdapter}=
  require('/qa-built/client-commerce.pg-qa.adapter.js');
const {QaStripeTestWebhookInboxAdapter}=
  require('/qa-built/stripe-test-webhook-inbox.pg-qa.adapter.js');
const {QaStripeTestFinancialReconciler}=
  require('/qa-built/stripe-test-financial-reconcile.pg-qa.adapter.js');

if(process.env.QA_SYNTHETIC_ONLY!=='YES' ||
   process.env.GITHUB_ACTIONS!=='true' ||
   !process.env.QA_FINANCE_HMAC_KEY ||
   !process.env.QA_WEBHOOK_TEST_SECRET) {
  throw Error('QA_FINANCIAL_DISCONNECTED_CI_FLAGS_REQUIRED');
}
const host='127.0.0.1';
function pool(user){
  return new Pool({
    host,database:'postgres',user,port:5432,
    max:12,connectionTimeoutMillis:5000,
    statement_timeout:12000,query_timeout:12000,
  });
}
const admin=pool('postgres'),app=pool('da_qa_client_commerce_app'),
  receiver=pool('da_qa_webhook_inbox_receiver'),
  creator=pool('da_qa_stripe_intent_creator'),
  financeA=pool('da_qa_stripe_finance_reconciler'),
  financeB=pool('da_qa_stripe_finance_reconciler');
const accountId='acct_QARECONACCOUNT01';
const intentId='pi_QARECONPAYMENT00001';
const chargeId='ch_QARECONCHARGE00001';
const eventId='evt_QARECONEVENT00001';
const identity={
  issuer:'https://qa.example.invalid/realms/da-client',
  subject:'50c11746-79a3-49a1-8eaa-257ba54785f7',
  role:'client',authSource:'external',ownershipEligible:true,
};
const quote={
  source:'server-canonical-catalog',
  quoteFingerprint:'a'.repeat(64),cartFingerprint:'b'.repeat(64),
  merchantSlug:'qa-restaurant',totalMinor:2190,currency:'EUR',
};
const mutationId='recon-qa-mutation-20261012';
const fakeStripeKey=['sk','test','QA_SYNTHETIC_NONNETWORK_ONLY_20261012'].join('_');
let order,authority;
let fakePi,fetchCalls=0,injectFailure=false;
const fakeFetch=async(url,opts)=>{
  fetchCalls++;
  assert.equal(opts.method,'GET','GET-only reconciliation must never create/capture');
  assert.match(String(opts.headers.Authorization),/^Bearer sk_test_/);
  const path=String(url);
  if(path==='https://api.stripe.com/v1/account')
    return Response.json({id:accountId,object:'account'});
  if(path==='https://api.stripe.com/v1/payment_intents/'+intentId+
     '?expand[]=latest_charge')return Response.json(fakePi);
  throw Error('STUB_EXTERNAL_NETWORK_FORBIDDEN');
};
const setupFixture=async()=>{
  const reservation=new QaClientCommercePgAdapter(
    app,process.env.QA_COMMERCE_HMAC_KEY);
  order=await reservation.reserveOrder(identity,quote,mutationId);
  authority=await reservation.reserveTestPayment(identity,order.orderId);
  assert.equal(authority.state,'reserved');
  const bound=await creator.query(
    'SELECT * FROM public.da_qa_provider_bind_test_intent('+
      '$1::uuid,$2::text,$3::bigint,$4::char(3))',
    [authority.authorityId,intentId,2190,'EUR']);
  assert.equal(bound.rows[0].stripe_payment_intent_id,intentId);
  assert.equal(bound.rows[0].duplicate,false);
  const boundAgain=await creator.query(
    'SELECT * FROM public.da_qa_provider_bind_test_intent('+
      '$1::uuid,$2::text,$3::bigint,$4::char(3))',
    [authority.authorityId,intentId,2190,'EUR']);
  assert.equal(boundAgain.rows[0].duplicate,true);
  fakePi={
    id:intentId,object:'payment_intent',livemode:false,
    amount:2190,amount_received:2190,currency:'eur',status:'succeeded',
    on_behalf_of:null,transfer_data:null,
    metadata:{
      orderId:order.orderId,clientIssuer:identity.issuer,
      clientSubject:identity.subject,clientMutationId:mutationId,
      quoteFingerprint:quote.quoteFingerprint,
      cartFingerprint:quote.cartFingerprint,partnerSlug:quote.merchantSlug,
    },
    latest_charge:{
      id:chargeId,object:'charge',livemode:false,
      payment_intent:intentId,amount:2190,amount_captured:2190,
      amount_refunded:0,currency:'eur',paid:true,captured:true,
      refunded:false,disputed:false,status:'succeeded',
    },
  };
};
const verifier=(pg,opts={})=>new QaStripeTestFinancialReconciler(pg,{
  stripeTestSecret:fakeStripeKey,expectedAccountId:accountId,
  financeHmacSecret:process.env.QA_FINANCE_HMAC_KEY,
  syntheticOnly:true,fetcher:opts.fetcher||fakeFetch,
});
const row=async(sql,args=[])=>(await admin.query(sql,args)).rows[0];
function signedWebhook(payload){
  const raw=Buffer.from(JSON.stringify(payload));
  const time=Math.floor(Date.now()/1000);
  const signature=crypto.createHmac('sha256',process.env.QA_WEBHOOK_TEST_SECRET)
    .update(String(time)).update('.').update(raw).digest('hex');
  return {raw,header:'t='+time+',v1='+signature};
}
async function deny(fn,regex){
  await assert.rejects(fn,regex);
}

test('disconnected real Postgres 17 financial reconciliation + roles + 8-way',async()=>{
  try{
    await setupFixture();
    await deny(()=>app.query('UPDATE public.da_client_commerce_orders_qa SET state=$1 WHERE order_id=$2',
      ['paid',order.orderId]),/permission denied/);
    await deny(()=>app.query('SELECT * FROM public.da_qa_finance_commit_captured_test('+
      '$1::uuid,$2::text,$3::text,$4::text,$5::bigint,$6::char(3),$7::char(64),$8::text)',
      [authority.authorityId,intentId,chargeId,accountId,2190,'EUR',
        'f'.repeat(64),null]),/permission denied/);
    await deny(()=>receiver.query('SELECT * FROM public.da_qa_finance_scan(1)'),/permission denied/);
    await deny(()=>financeA.query('UPDATE public.da_client_commerce_payment_authority_qa SET provider_verified=true'),
      /permission denied/);
    console.log('QA_FINANCE_ROLES_APP_WEBHOOK_NO_DIRECT_PAID=PASS');

    const incoming=signedWebhook({
      id:eventId,object:'event',type:'payment_intent.succeeded',
      livemode:false,data:{object:{
        id:intentId,object:'payment_intent',livemode:false,
      }},
    });
    const stored=await new QaStripeTestWebhookInboxAdapter(
      receiver,process.env.QA_WEBHOOK_TEST_SECRET)
      .receiveSignedTestWebhook(incoming.raw,incoming.header);
    assert.equal(stored.duplicate,false);
    assert.equal(stored.authorityId,authority.authorityId);
    const before=await row(
      'SELECT o.state order_state,a.state payment_state,a.provider_verified '+
      'FROM public.da_client_commerce_orders_qa o '+
      'JOIN public.da_client_commerce_payment_authority_qa a ON o.order_id=a.order_id '+
      'WHERE o.order_id=$1',[order.orderId]);
    assert.equal(before.order_state,'pending_payment');
    assert.equal(before.payment_state,'intent_created');
    assert.equal(before.provider_verified,false);
    console.log('QA_FINANCE_SIGNED_WEBHOOK_ALONE=NEVER_PAID');

    const verifierA=verifier(financeA),verifierB=verifier(financeB);
    // Independent provider identity/account and exact order/charge binding.
    await deny(()=>verifier(financeA,{fetcher:async(url,opts)=>{
      const r=await fakeFetch(url,opts);
      return String(url).endsWith('/account')
        ?Response.json({id:'acct_FOREIGNACCOUNT01',object:'account'}):r;
    }}).reconcileAuthority(authority.authorityId),/account_mismatch/);
    const original=structuredClone(fakePi);
    fakePi.latest_charge.payment_intent='pi_FOREIGNCHARGE0001';
    await deny(()=>verifierA.reconcileAuthority(authority.authorityId),
      /charge_not_fully_captured_or_foreign/);
    fakePi=original;
    fakePi.livemode=true;
    await deny(()=>verifierA.reconcileAuthority(authority.authorityId),
      /intent_binding_mismatch/);
    fakePi=original;
    fakePi.latest_charge.amount_refunded=30;
    fakePi.latest_charge.refunded=true;
    const premature=await verifierA.reconcileAuthority(authority.authorityId);
    assert.equal(premature.outcome,'financial_hold');
    assert.equal((await row(
      'SELECT state FROM public.da_client_commerce_orders_qa WHERE order_id=$1',
      [order.orderId])).state,'pending_payment');
    fakePi=original;
    console.log('QA_FINANCE_FOREIGN_ACCOUNT_CHARGE_MODE_REFUND=REJECTED');

    // A provider success followed by a lost SQL response MUST be repaired
    // against the exact same PI: no second Stripe creation request.
    const failingPool={
      query:async(sql,args)=>{
        if(sql.includes('da_qa_finance_commit_captured_test') && !injectFailure){
          injectFailure=true;throw Error('QA_SYNTHETIC_DATABASE_UNAVAILABLE');
        }
        return financeA.query(sql,args);
      },
    };
    await deny(()=>verifier(failingPool).reconcileAuthority(authority.authorityId),
      /QA_SYNTHETIC_DATABASE_UNAVAILABLE/);
    assert.equal((await row(
      'SELECT state FROM public.da_client_commerce_orders_qa WHERE order_id=$1',
      [order.orderId])).state,'pending_payment');
    console.log('QA_FINANCE_PROVIDER_SUCCESS_SQL_FAILURE=RECONCILABLE');

    const results=await Promise.all(Array.from({length:8},(_,n)=>
      (n%2===0?verifierA:verifierB).reconcileAuthority(authority.authorityId,eventId)));
    assert.equal(results.filter(r=>r.outcome==='captured').length,8);
    assert.equal(results.filter(r=>r.duplicate===false).length,1);
    assert.equal(results.filter(r=>r.duplicate===true).length,7);
    assert.equal((await row('SELECT count(*)::integer as n FROM '+
      'public.da_stripe_test_financial_receipts_qa')).n,1);
    assert.equal((await row(
      'SELECT state FROM public.da_client_commerce_orders_qa WHERE order_id=$1',
      [order.orderId])).state,'paid');
    assert.equal((await row(
      'SELECT public.da_qa_commerce_order_dispatch_eligible($1::uuid) as eligible',
      [order.orderId])).eligible,true);
    console.log('QA_FINANCE_8_WAY_2_POOLS=ONE_ATOMIC_PAID_COMMIT');

    fakePi.latest_charge.refunded=true;
    fakePi.latest_charge.amount_refunded=100;
    const hold=await verifierA.reconcileAuthority(authority.authorityId);
    assert.equal(hold.outcome,'financial_hold');
    assert.equal((await row('SELECT count(*)::integer as n FROM '+
      'public.da_stripe_test_financial_holds_qa')).n,1);
    const another=await verifierB.reconcileAuthority(authority.authorityId);
    assert.equal(another.outcome,'financial_hold');
    assert.equal((await row('SELECT count(*)::integer as n FROM '+
      'public.da_stripe_test_financial_holds_qa')).n,1);
    assert.equal((await row(
      'SELECT public.da_qa_commerce_order_dispatch_eligible($1::uuid) as eligible',
      [order.orderId])).eligible,false);
    console.log('QA_FINANCE_REFUND_AFTER_PAID=HOLD_AND_DISPATCH_DENIED');

    assert.equal(fetchCalls>0,true);
    console.log('QA_FINANCE_PROVIDER_HTTP=ZERO_EXTERNAL_CALLS_ALL_GET_STUBBED');
    console.log('QA_FINANCE_PRODUCTION_ROUTES=NOT_WIRED');
  } finally {
    await Promise.all([admin,app,receiver,creator,financeA,financeB]
      .map(p=>p.end()));
  }
});
