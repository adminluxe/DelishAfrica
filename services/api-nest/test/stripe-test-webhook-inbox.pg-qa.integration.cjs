'use strict';
/**
 * Real PostgreSQL 17 append-only Stripe TEST webhook inbox and HMAC gate.
 * All identities, HMAC secrets, PaymentIntents and webhooks are synthetic.
 * No Stripe HTTP, no external ports or network. Not production wired.
 */
const assert = require('node:assert/strict');
const {test} = require('node:test');
const crypto = require('node:crypto');
const {Pool} = require('pg');
const {QaClientCommercePgAdapter} =
  require('/qa-built/client-commerce.pg-qa.adapter.js');
const {QaStripeTestWebhookInboxAdapter} =
  require('/qa-built/stripe-test-webhook-inbox.pg-qa.adapter.js');

if(process.env.GITHUB_ACTIONS !== 'true' ||
   process.env.QA_SYNTHETIC_ONLY !== 'YES' ||
   process.env.QA_COMMERCE_DB_HOST !== '127.0.0.1' ||
   process.env.QA_COMMERCE_DB_NAME !== 'postgres' ||
   !/^[a-f0-9]{64}$/.test(process.env.QA_COMMERCE_HMAC_KEY || '') ||
   !/^whsec_[a-f0-9]{64}$/.test(process.env.QA_WEBHOOK_TEST_SECRET || '')){
  throw Error('QA_STRIPE_INBOX_ISOLATION_FLAGS_REQUIRED');
}

const config=user=>({
  host:'127.0.0.1',port:5432,database:'postgres',user,
  max:12,connectionTimeoutMillis:10000,
  statement_timeout:12000,query_timeout:12000,
});
const sqlAdmin=new Pool(config('postgres'));
const commerce=new Pool(config('da_qa_client_commerce_app'));
const receiverA=new Pool(config('da_qa_webhook_inbox_receiver'));
const receiverB=new Pool(config('da_qa_webhook_inbox_receiver'));
const psp=new Pool(config('da_qa_psp_verified_receiver'));
const hmacKey=process.env.QA_COMMERCE_HMAC_KEY;
const secret=process.env.QA_WEBHOOK_TEST_SECRET;
const commerceAdapter=new QaClientCommercePgAdapter(commerce,hmacKey);
const inboxA=new QaStripeTestWebhookInboxAdapter(receiverA,secret);
const inboxB=new QaStripeTestWebhookInboxAdapter(receiverB,secret);
const issuer='https://qa.example.invalid/realms/da-client';
const alice={issuer,subject:'a63f867f-9f42-4573-9268-dc65a164d2c1',
  role:'client',authSource:'external',ownershipEligible:true};
const bob={issuer,subject:'b63f867f-9f42-4573-9268-dc65a164d2c2',
  role:'client',authSource:'external',ownershipEligible:true};
const quote={source:'server-canonical-catalog',
  quoteFingerprint:'a'.repeat(64),cartFingerprint:'b'.repeat(64),
  merchantSlug:'qa-merchant',totalMinor:1200,currency:'EUR'};
const orderAIntent='pi_test_qa_inbox_client_a1';
const orderBIntent='pi_test_qa_inbox_client_b2';

const makeEvent=(id,intentId=orderAIntent)=>({
  id,object:'event',type:'payment_intent.succeeded',livemode:false,
  data:{object:{id:intentId,object:'payment_intent',
    livemode:false,status:'succeeded',amount:1200,currency:'eur'}},
});
const signed=(value,t=Math.floor(Date.now()/1000),overrideSecret=secret)=>{
  const raw=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value));
  const mac=crypto.createHmac('sha256',overrideSecret)
    .update(String(t)).update('.').update(raw).digest('hex');
  return {raw,sig:'t='+t+',v1='+mac};
};
const readCount=async(query,values=[])=>Number(
  (await sqlAdmin.query(query,values)).rows[0].count
);
const reject=async(fn,contains)=>{
  await assert.rejects(fn,e=>{
    assert(String(e.message).includes(contains),
      'Expected '+contains+', got '+String(e.message));
    return true;
  });
};

test('signed TEST inbox only: concurrency, ownership, replay, DB ACL, no payment success',async()=>{
  const oldFetch=global.fetch;
  let externalCalls=0;
  global.fetch=async()=>{externalCalls++;throw Error('NO_PROVIDER_NETWORK_IN_QA')};
  try{
    const orderA=await commerceAdapter.reserveOrder(
      alice,quote,'qa-webhook-mutation-client-001');
    const orderB=await commerceAdapter.reserveOrder(
      bob,quote,'qa-webhook-mutation-client-002');
    const paymentA=await commerceAdapter.reserveTestPayment(alice,orderA.orderId);
    const paymentB=await commerceAdapter.reserveTestPayment(bob,orderB.orderId);

    // This privileged CI fixture transition models the result of a *future*
    // successful Stripe TEST PaymentIntent creation. NO Stripe was contacted.
    for(const [id,intent] of [
      [paymentA.orderId,orderAIntent],[paymentB.orderId,orderBIntent]
    ]){
      await sqlAdmin.query(
        "UPDATE public.da_client_commerce_payment_authority_qa "+
        "SET state='intent_created',stripe_payment_intent_id=$2 "+
        "WHERE order_id=$1::uuid",[id,intent]);
    }
    const first=signed(makeEvent('evt_qa_inbox_signed_001'));
    const receipts=await Promise.all(Array.from({length:8},(_,i)=>
      (i%2?inboxB:inboxA).receiveSignedTestWebhook(first.raw,first.sig)
    ));
    assert.equal(new Set(receipts.map(x=>x.authorityId)).size,1);
    assert.equal(receipts.filter(x=>x.duplicate===false).length,1);
    assert.equal(receipts.filter(x=>x.duplicate===true).length,7);
    assert.equal(receipts[0].authorityId,paymentA.authorityId);
    assert.equal(await readCount(
      'SELECT count(*) FROM public.da_stripe_test_webhook_inbox_qa'),1);
    console.log('QA_STRIPE_INBOX_8_WAY_2_POOLS=ONE_DURABLE_RECEIPT');

    const again=await inboxB.receiveSignedTestWebhook(first.raw,first.sig);
    assert.equal(again.duplicate,true);
    console.log('QA_STRIPE_INBOX_REDELIVERY=IDEMPOTENT');

    const mutated=signed({
      ...makeEvent('evt_qa_inbox_signed_001'),
      created:Math.floor(Date.now()/1000),
    });
    await reject(()=>inboxA.receiveSignedTestWebhook(mutated.raw,mutated.sig),
      'qa_stripe_event_id_payload_collision_rejected');
    const foreign=signed(makeEvent('evt_qa_inbox_signed_001',orderBIntent));
    await reject(()=>inboxA.receiveSignedTestWebhook(foreign.raw,foreign.sig),
      'qa_stripe_event_id_payload_collision_rejected');
    assert.equal(await readCount(
      'SELECT count(*) FROM public.da_stripe_test_webhook_inbox_qa'),1);
    console.log('QA_STRIPE_INBOX_EVENT_ID_HASH_AND_AUTHORITY_COLLISIONS=REJECTED');

    await reject(()=>inboxA.receiveSignedTestWebhook(
      first.raw,signed(first.raw,Math.floor(Date.now()/1000),
        'whsec_'+'f'.repeat(64)).sig),
      'qa_stripe_webhook_signature_mismatch');
    await reject(()=>inboxA.receiveSignedTestWebhook(first.raw,
      't='+(Math.floor(Date.now()/1000)-3900)+',v1='+'0'.repeat(64)),
      'qa_stripe_webhook_signature_expired');
    await reject(()=>inboxA.receiveSignedTestWebhook(first.raw,
      signed(first.raw,Math.floor(Date.now()/1000)+1200).sig),
      'qa_stripe_webhook_signature_expired');
    await reject(()=>inboxA.receiveSignedTestWebhook(first.raw,
      't=1234567890,t=1234567891,v1='+'a'.repeat(64)),
      'qa_stripe_timestamp_invalid');
    console.log('QA_STRIPE_INBOX_HMAC_WRONG_EXPIRED_FUTURE_DUP_TIMESTAMP=REJECTED');

    const unsupported=signed({
      ...makeEvent('evt_qa_inbox_unsupported_001'),
      type:'charge.refunded',
    });
    await reject(()=>inboxA.receiveSignedTestWebhook(
      unsupported.raw,unsupported.sig),
      'qa_stripe_test_event_or_intent_invalid');
    const live=signed({
      ...makeEvent('evt_qa_inbox_live_001'),livemode:true
    });
    await reject(()=>inboxA.receiveSignedTestWebhook(
      live.raw,live.sig),'qa_stripe_test_event_or_intent_invalid');
    const liveObject=signed({
      ...makeEvent('evt_qa_inbox_live_obj_001'),
      data:{object:{id:orderAIntent,object:'payment_intent',livemode:true}},
    });
    await reject(()=>inboxA.receiveSignedTestWebhook(
      liveObject.raw,liveObject.sig),'qa_stripe_test_event_or_intent_invalid');
    const badJson=signed(Buffer.from('{"broken":'));
    await reject(()=>inboxA.receiveSignedTestWebhook(
      badJson.raw,badJson.sig),'qa_stripe_webhook_invalid_json');
    const unknown=signed(makeEvent(
      'evt_qa_inbox_unknown_pi_001','pi_qa_foreign_unreserved_123456'));
    await reject(()=>inboxA.receiveSignedTestWebhook(
      unknown.raw,unknown.sig),'qa_stripe_payment_intent_not_reserved_or_active');
    await reject(()=>inboxA.receiveSignedTestWebhook(
      Buffer.alloc(257*1024),first.sig),'qa_stripe_webhook_raw_body_required');
    console.log('QA_STRIPE_INBOX_UNTRUSTED_SHAPE_MODE_PI_JSON_SIZE=REJECTED');

    // Even a correctly signed success event does not authorize mutating
    // order/payment state. The PSP role remains deliberately unprivileged.
    const state=(await sqlAdmin.query(
      'SELECT state,provider_verified,provider_success_event_hmac '+
      'FROM public.da_client_commerce_payment_authority_qa WHERE order_id=$1',
      [orderA.orderId])).rows[0];
    assert.equal(state.state,'intent_created');
    assert.equal(state.provider_verified,false);
    assert.equal(state.provider_success_event_hmac,null);
    const orderState=(await sqlAdmin.query(
      'SELECT state FROM public.da_client_commerce_orders_qa WHERE order_id=$1',
      [orderA.orderId])).rows[0].state;
    assert.equal(orderState,'pending_payment');
    console.log('QA_STRIPE_INBOX_SIGNED_EVENT_NEVER_MARKS_PAID=PASS');

    for (const [name,pool] of [
      ['client_app',commerce],['unverified_psp',psp],['webhook_receiver',receiverA]
    ]){
      await reject(()=>pool.query(
        "UPDATE public.da_client_commerce_payment_authority_qa "+
        "SET state='succeeded',provider_verified=true WHERE order_id=$1",
        [orderA.orderId]),'permission denied');
      await reject(()=>pool.query(
        "UPDATE public.da_client_commerce_orders_qa SET state='paid' "+
        "WHERE order_id=$1",[orderA.orderId]),'permission denied');
    }
    await reject(()=>receiverA.query(
      'SELECT * FROM public.da_stripe_test_webhook_inbox_qa'),
      'permission denied');
    await reject(()=>commerce.query(
      'SELECT * FROM public.da_qa_record_signed_test_webhook('+
      '$1::text,$2::text,$3::text,$4::char(64),$5::boolean)',
      ['evt_qa_no_privilege_001','payment_intent.succeeded',
        orderAIntent,'e'.repeat(64),false]),'permission denied');
    console.log('QA_STRIPE_INBOX_APP_PSP_RECEIVER=NO_DIRECT_FINANCIAL_DML');
    assert.equal(await readCount(
      'SELECT count(*) FROM public.da_stripe_test_webhook_inbox_qa'),1);
    assert.equal(externalCalls,0);
    console.log('QA_STRIPE_INBOX_NETWORK_STRIPE_CALLS=ZERO');
    console.log('QA_STRIPE_INBOX_PRODUCTION_ROUTES=NOT_WIRED');
  }finally{
    global.fetch=oldFetch;
    await Promise.allSettled([
      sqlAdmin.end(),commerce.end(),receiverA.end(),receiverB.end(),psp.end()
    ]);
  }
});
