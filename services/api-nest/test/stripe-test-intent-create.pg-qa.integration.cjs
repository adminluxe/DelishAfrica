'use strict';
/**
 * Idempotent Stripe TEST PaymentIntent creation from PostgreSQL reservation:
 * real isolated PG17 / fake Stripe HTTP ONLY; no provider network.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const {QaClientCommercePgAdapter}=
  require('/qa-built/client-commerce.pg-qa.adapter.js');
const {QaStripeTestIntentCreator}=
  require('/qa-built/stripe-test-intent-create.pg-qa.adapter.js');
if(process.env.QA_SYNTHETIC_ONLY!=='YES'||
   process.env.GITHUB_ACTIONS!=='true'||!process.env.QA_COMMERCE_HMAC_KEY){
  throw Error('QA_STRIPE_INTENT_DISCONNECTED_ONLY');
}
function pool(user){return new Pool({
  host:'127.0.0.1',port:5432,database:'postgres',user,max:6,
  query_timeout:12000,statement_timeout:12000,
});}
const app=pool('da_qa_client_commerce_app');
const creator=pool('da_qa_stripe_intent_creator');
const admin=pool('postgres');
const bindingUser=Object.freeze({
  issuer:'https://qa.example.invalid/realms/da-client',
  subject:'b719b1a2-7d8a-4a50-a034-d4163aa16655',
  role:'client',authSource:'external',ownershipEligible:true,
});
const quote=Object.freeze({
  source:'server-canonical-catalog',
  quoteFingerprint:'c'.repeat(64),cartFingerprint:'d'.repeat(64),
  merchantSlug:'qa-market',totalMinor:2290,currency:'EUR',
});
const mutation='qa-create-intent-mutation-20261012';
const accountId='acct_QACREATETEST123';
const paymentIntentId='pi_QACREATETEST12345';
const secretKey=['sk','test','QA_NONREAL_INTENT_TEST_20261012'].join('_');
const publishableKey=['pk','test','QA_NONREAL_PUBLISHABLE_20261012'].join('_');
const clientSecret=paymentIntentId+'_secret_QAFICTIONALONLY0001';
const fakeProviderStore=new Map();
const providerCalls=[];
let corruptResponse=null;
let accountOverride=null;
function json(obj){return Response.json(obj);}
async function fakeFetch(url,init){
  providerCalls.push({url,method:init.method,
    providerKey:init.headers['Idempotency-Key']||null});
  assert.ok(url.startsWith('https://api.stripe.com/v1/'));
  if(url==='https://api.stripe.com/v1/account'&&init.method==='GET'){
    return json({id:accountOverride||accountId,object:'account'});
  }
  if(url==='https://api.stripe.com/v1/payment_intents'&&init.method==='POST'){
    const params=new URLSearchParams(init.body);
    assert.equal(params.get('amount'),'2290');
    assert.equal(params.get('currency'),'eur');
    assert.equal(params.get('confirm'),'false');
    assert.equal(params.get('capture_method'),'automatic');
    assert.equal(params.get('automatic_payment_methods[enabled]'),'true');
    assert.equal(params.get('transfer_data[destination]'),null);
    const key=init.headers['Idempotency-Key'];
    assert.match(key,/^da-qa-test-v1-[0-9a-f]{64}$/);
    const idempotent=fakeProviderStore.get(key);
    if(idempotent){
      assert.equal(idempotent.parameters,params.toString());
      return json(corruptResponse||idempotent.response);
    }
    const metadata={};
    for(const [k,v] of params.entries()){
      if(k.startsWith('metadata[')&&k.endsWith(']'))
        metadata[k.slice(9,-1)]=v;
    }
    const response={
      id:paymentIntentId,object:'payment_intent',livemode:false,
      amount:2290,currency:'eur',status:'requires_payment_method',
      client_secret:clientSecret,metadata,
      on_behalf_of:null,transfer_data:null,
    };
    fakeProviderStore.set(key,{parameters:params.toString(),response});
    return json(corruptResponse||response);
  }
  if(url==='https://api.stripe.com/v1/payment_intents/'+paymentIntentId&&
     init.method==='GET'){
    const first=[...fakeProviderStore.values()][0];
    assert.ok(first);
    return json(corruptResponse||first.response);
  }
  throw Error('QA_PROVIDER_UNEXPECTED_NETWORK_BLOCKED');
}
const baseConfig={
  secretKey,publishableKey,expectedAccountId:accountId,syntheticOnly:true,
  fetcher:fakeFetch,
};
const commerce=new QaClientCommercePgAdapter(app,process.env.QA_COMMERCE_HMAC_KEY);
const create=(creatorPool=creator,extra={})=>new QaStripeTestIntentCreator(
  commerce,creatorPool,{...baseConfig,...extra});
const qs=()=>providerCalls.filter(x=>x.method==='POST').map(x=>x.providerKey);
const countOwnReceipts=async()=> (await admin.query(
  'SELECT count(*)::int as n FROM public.da_stripe_test_financial_receipts_qa '+
    'WHERE stripe_payment_intent_id=$1',[paymentIntentId])).rows[0].n;
test('Stripe TEST intent creation: PostgreSQL-first and invariant Idempotency-Key across crash and retries',
async()=>{
  try{
    // A bearer/client cannot read the privileged payment-create bind port.
    await assert.rejects(
      ()=>app.query('SELECT * FROM public.da_qa_provider_read_reserved_test_intent('+
        '$1::uuid,$2::text,$3::uuid)',[
          '00000000-0000-4000-8000-000000000000',bindingUser.issuer,bindingUser.subject,
        ]),
      /permission denied/);
    await assert.rejects(
      ()=>app.query('SELECT * FROM public.da_qa_provider_bind_test_intent('+
        '$1::uuid,$2::text,$3::bigint,$4::char(3))',[
          '00000000-0000-4000-8000-000000000000',paymentIntentId,2290,'EUR',
        ]),
      /permission denied/);
    console.log('QA_STRIPE_INTENT_APP_NO_CREATOR_PRIVILEGE=PASS');

    // Wrong Stripe account fails BEFORE any provider creation.
    accountOverride='acct_WRONGQAACCOUNT01';
    await assert.rejects(
      ()=>create().createOrResume(bindingUser,quote,mutation),
      /qa_checkout_wrong_stripe_test_account/);
    assert.equal(qs().length,0);
    accountOverride=null;
    console.log('QA_STRIPE_INTENT_ACCOUNT_PIN=FAIL_CLOSED');

    // Provider created PI but database binder unexpectedly unavailable.
    let failBinderOnce=true;
    const failingCreatorPool={
      query:async(sql,params)=>{
        if(sql.includes('da_qa_provider_bind_test_intent')&&failBinderOnce){
          failBinderOnce=false;
          throw Error('QA_DB_LOST_AFTER_STRIPE_SUCCESS');
        }
        return creator.query(sql,params);
      },
    };
    await assert.rejects(
      ()=>create(failingCreatorPool).createOrResume(bindingUser,quote,mutation),
      /QA_DB_LOST_AFTER_STRIPE_SUCCESS/);
    assert.equal(qs().length,1);
    assert.equal(fakeProviderStore.size,1);
    assert.equal(await countOwnReceipts(),0);
    const authorityRows=await admin.query(
      'SELECT state,stripe_payment_intent_id FROM public.da_client_commerce_payment_authority_qa '+
      'WHERE client_subject=$1',[bindingUser.subject]);
    assert.equal(authorityRows.rows[0].state,'reserved');
    assert.equal(authorityRows.rows[0].stripe_payment_intent_id,null);
    console.log('QA_STRIPE_INTENT_SQL_CRASH=NO_DUPLICATE_AUTHORITY_OR_PAID');

    // Resume same order+PI via exact same Stripe idempotency key.
    const resumed=await create().createOrResume(bindingUser,quote,mutation);
    assert.equal(resumed.paymentIntentId,paymentIntentId);
    assert.equal(resumed.clientSecret,clientSecret);
    assert.equal(resumed.status,'requires_payment_method');
    assert.equal(qs().length,2);
    assert.equal(qs()[0],qs()[1]);
    assert.equal(fakeProviderStore.size,1);
    assert.equal(await countOwnReceipts(),0);
    const replay=await create().createOrResume(bindingUser,quote,mutation);
    assert.equal(replay.paymentIntentId,paymentIntentId);
    assert.equal(qs().length,2);
    assert.equal(replay.replayed,true);
    assert.equal(resumed.replayed,false);
    assert.equal((await admin.query(
      'SELECT count(*)::int n FROM public.da_client_commerce_payment_authority_qa '+
      'WHERE client_subject=$1',[bindingUser.subject])).rows[0].n,1);
    console.log('QA_STRIPE_INTENT_CRASH_REPLAY=SAME_PROVIDER_KEY_AND_ONE_PI');

    // User cannot alter immutable quote using same mutation token.
    await assert.rejects(
      ()=>create().createOrResume(bindingUser,
        {...quote,totalMinor:99999},mutation),
      /qa_idempotency_payload_mismatch/);
    assert.equal(qs().length,2);
    const cross=(await creator.query(
      'SELECT * FROM public.da_qa_provider_read_reserved_test_intent('+
        '$1::uuid,$2::text,$3::uuid)',
      [resumed.authorityId,bindingUser.issuer,
        '86f82bbc-b3f6-479b-934f-fbb34f8f40a3'])).rows;
    assert.equal(cross.length,0);
    assert.equal(qs().length,2);
    console.log('QA_STRIPE_INTENT_QUOTE_REPLAY_AND_CROSS_CLIENT=NO_SECOND_PI');

    // No HTTP happens for an unknown/expired reservation without DB PI link.
    const oldMutation='qa-create-intent-timeout-20261012';
    const oldOrder=await commerce.reserveOrder(bindingUser,quote,oldMutation);
    await commerce.reserveTestPayment(bindingUser,oldOrder.orderId);
    const oldCreator=create(creator,{nowMs:()=>Date.now()+19*3600000});
    const originalPosts=qs().length;
    await assert.rejects(
      ()=>oldCreator.createOrResume(bindingUser,quote,oldMutation),
      /qa_checkout_ambiguous_old_reservation_manual_review/);
    assert.equal(qs().length,originalPosts);
    console.log('QA_STRIPE_INTENT_STALE_RESERVATION=STOP_MANUAL_REVIEW');

    // Force genuine provider response mismatch at new order before DB binder.
    const wrongMutation='qa-create-intent-badprovider-20261012';
    corruptResponse={...fakeProviderStore.values().next().value.response,
      amount:98765};
    await assert.rejects(
      ()=>create().createOrResume(bindingUser,quote,wrongMutation),
      /qa_checkout_provider_intent_binding_mismatch/);
    corruptResponse=null;
    assert.equal(await countOwnReceipts(),0);
    console.log('QA_STRIPE_INTENT_PROVIDER_MISMATCH=NO_PAID_OR_BIND');

    // Never enable official Stripe automatically, even with a TEST-shaped key.
    assert.throws(
      ()=>new QaStripeTestIntentCreator(commerce,creator,{
        ...baseConfig,syntheticOnly:false,
      }),/qa_checkout_explicit_stripe_test_gate_required/);
    console.log('QA_STRIPE_INTENT_OFFICIAL_TEST=DISABLED_BY_DEFAULT');
    console.log('QA_STRIPE_INTENT_PROVIDER_NETWORK=ZERO_STUB_ONLY');
    console.log('QA_STRIPE_INTENT_PRODUCTION_ROUTES=NOT_WIRED');
  }finally{
    await Promise.all([app,creator,admin].map(p=>p.end()));
  }
});
