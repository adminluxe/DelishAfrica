'use strict';
/**
 * DelishAfrica P0 | isolated finance finality trace, PostgreSQL 17 only.
 * Existing adapters, real least-privilege PostgreSQL operations, fake Stripe.
 * No live network, no AppModule, no external payment, no payout, no delivery.
 */
const assert = require('node:assert/strict');
const {test} = require('node:test');
const crypto = require('node:crypto');
const {Pool} = require('pg');
const {QaCanonicalOrderSnapshotPgAdapter} =
  require('/qa-built/client-order-snapshot.pg-qa.adapter.js');
const {QaClientCommercePgAdapter} =
  require('/qa-built/client-commerce.pg-qa.adapter.js');
const {QaStripeTestIntentCreator} =
  require('/qa-built/stripe-test-intent-create.pg-qa.adapter.js');
const {QaStripeTestWebhookInboxAdapter} =
  require('/qa-built/stripe-test-webhook-inbox.pg-qa.adapter.js');
const {QaStripeTestFinancialReconciler} =
  require('/qa-built/stripe-test-financial-reconcile.pg-qa.adapter.js');
const {QaClientOwnedOrderReceiptReader} =
  require('/qa-built/client-order-receipt.pg-qa.adapter.js');
const {QaMerchantCourierFulfillmentPgAdapter} =
  require('/qa-built/merchant-courier-fulfillment.pg-qa.adapter.js');

if (process.env.GITHUB_ACTIONS!=='true' ||
    process.env.QA_SYNTHETIC_ONLY!=='YES' ||
    process.env.DA_QA_ISOLATED_CLIENT_COMMERCE_ENABLED!=='YES' ||
    process.env.NODE_ENV==='production' ||
    process.env.QA_COMMERCE_DB_HOST!=='127.0.0.1' ||
    process.env.QA_COMMERCE_DB_NAME!=='postgres' ||
    !/^[0-9a-f]{64}$/.test(process.env.QA_COMMERCE_HMAC_KEY||'') ||
    !/^whsec_[0-9a-f]{64}$/.test(process.env.QA_WEBHOOK_TEST_SECRET||'') ||
    !/^[0-9a-f]{64}$/.test(process.env.QA_FINANCE_HMAC_KEY||'')) {
  throw Error('P0_FINALITY_QA_NETWORK_NONE_ONLY');
}

const makePool=user=>new Pool({
  host:'127.0.0.1',port:5432,database:'postgres',user,
  max:10,connectionTimeoutMillis:8000,statement_timeout:15000,
  query_timeout:15000,
});
const admin=makePool('postgres');
const clientPool=makePool('da_qa_client_commerce_app');
const creatorPool=makePool('da_qa_stripe_intent_creator');
const inboxPoolA=makePool('da_qa_webhook_inbox_receiver');
const inboxPoolB=makePool('da_qa_webhook_inbox_receiver');
const financePoolA=makePool('da_qa_stripe_finance_reconciler');
const financePoolB=makePool('da_qa_stripe_finance_reconciler');
const merchantPool=makePool('da_qa_merchant_commerce_app');
const courierPool=makePool('da_qa_courier_commerce_app');
const dispatchPool=makePool('da_qa_dispatch_commerce_app');
const outboxReaderPool=makePool('da_qa_finance_outbox_reader_018');

const principal={
  issuer:'https://qa.example.invalid/realms/da-client',
  subject:'a63f867f-9f42-4573-9268-dc65a164d2c1',
  role:'client',authSource:'external',ownershipEligible:true,
};
const merchant={
  issuer:'https://qa.example.invalid/realms/da-merchant',
  subject:'b63f867f-9f42-4573-9268-dc65a164d2c2',
  role:'merchant',authSource:'external',ownershipEligible:true,
};
const membership={
  issuer:merchant.issuer,subject:merchant.subject,
  slug:'qa-restaurant',membershipId:'qa-finance-outbox-merchant',
  partnerId:'qa-restaurant',membershipStatus:'active',
  partnerLifecycleStatus:'published',membershipRole:'manager',
  contractStatus:'active',kybStatus:'verified',accessEligible:true,
  startsAt:null,expiresAt:null,revokedAt:null,
};
const courier={
  issuer:'https://qa.example.invalid/realms/da-courier',
  subject:'c63f867f-9f42-4573-9268-dc65a164d2c3',
  role:'courier',authSource:'external',ownershipEligible:true,
};
const roster={
  issuer:courier.issuer,subject:courier.subject,
  source:'committed-server-roster',active:true,
};
const mutationId='qa-p0-finality-outbox-20261014-001';
const quote={
  source:'server-canonical-catalog',
  quoteFingerprint:crypto.createHash('sha256').update('p0-finality-catalog').digest('hex'),
  cartFingerprint:crypto.createHash('sha256').update('p0-finality-basket').digest('hex'),
  merchantSlug:'qa-restaurant',totalMinor:2690,currency:'EUR',
  fulfillment:{
    subtotalMinor:2300,deliveryFeeMinor:390,
    lines:[
      {sku:'rice',name:'Jollof rice',category:'Menu',
        quantity:1,unitAmountMinor:1500,lineAmountMinor:1500},
      {sku:'juice',name:'Bissap',category:'Drink',
        quantity:2,unitAmountMinor:400,lineAmountMinor:800},
    ],
  },
};
const account='acct_QAP0FINALITY20261014';
const fakeKey=['sk','test','P0_FINALITY_NETWORK_NONE_ONLY_20261014'].join('_');
const fakePub=['pk','test','P0_FINALITY_NETWORK_NONE_ONLY_20261014'].join('_');
const piId='pi_QAP0FINALITY20261014';
const chargeId='ch_QAP0CAPTURE20261014';
const webhookId='evt_QAP0WEBHOOK20261014';
const stripeObjects=new Map();
let paymentPosts=0,providerReads=0;
let fakePi=null;

const fakeStripe=async (url,request) => {
  const dest=String(url);
  assert.ok(dest.startsWith('https://api.stripe.com/v1/'),
    'a QA fake only accepts fixed Stripe URL prefixes');
  if (dest==='https://api.stripe.com/v1/account' && request.method==='GET') {
    providerReads++;
    return Response.json({id:account,object:'account'});
  }
  if (dest==='https://api.stripe.com/v1/payment_intents' && request.method==='POST') {
    paymentPosts++;
    const key=request.headers['Idempotency-Key'];
    assert.match(key,/^da-qa-test-v1-[0-9a-f]{64}$/);
    const params=new URLSearchParams(request.body);
    assert.equal(params.get('amount'),'2690');
    assert.equal(params.get('currency'),'eur');
    assert.equal(params.get('confirm'),'false');
    assert.equal(params.get('transfer_data[destination]'),null);
    const metadata={};
    for(const [k,v] of params) {
      if(k.startsWith('metadata[') && k.endsWith(']'))metadata[k.slice(9,-1)]=v;
    }
    const lookup=await admin.query(
      'SELECT count(*)::int AS n FROM public.da_client_commerce_orders_qa o '+
      'JOIN public.da_client_commerce_order_snapshot_qa s ON s.order_id=o.order_id '+
      'JOIN public.da_client_commerce_payment_authority_qa a ON a.order_id=o.order_id '+
      'WHERE o.order_id=$1::uuid AND o.state=$2 AND a.state=$3',
      [metadata.orderId,'pending_payment','reserved']);
    assert.equal(lookup.rows[0].n,1,'PG order, immutable basket and reserved authority BEFORE provider');
    const previous=stripeObjects.get(key);
    const obj=previous||{
      object:'payment_intent',id:piId,livemode:false,
      amount:2690,currency:'eur',status:'requires_payment_method',
      client_secret:piId+'_secret_QASYNTHETIC',metadata,
      on_behalf_of:null,transfer_data:null,
    };
    stripeObjects.set(key,obj);
    fakePi=obj;
    return Response.json(obj);
  }
  if(dest==='https://api.stripe.com/v1/payment_intents/'+piId &&
     request.method==='GET'){
    providerReads++;
    assert.ok(fakePi);
    return Response.json(fakePi);
  }
  if(dest==='https://api.stripe.com/v1/payment_intents/'+piId+
     '?expand[]=latest_charge' && request.method==='GET'){
    providerReads++;
    assert.ok(fakePi);
    return Response.json(fakePi);
  }
  throw Error('QA_PROVIDER_CALL_NOT_ALLOWED');
};

const getCount=async(table,where,columnValue)=>{
  const names={
    capture:'da_stripe_test_financial_receipts_qa',
    hold:'da_stripe_test_financial_holds_qa',
    outbox:'da_qa_financial_outbox_018',
    inbox:'da_stripe_test_webhook_inbox_qa',
  };
  const name=names[table];
  assert.ok(name);
  const q=await admin.query(
    'SELECT count(*)::int AS n FROM public.'+name+
    ' WHERE authority_id=$1::uuid',[columnValue]);
  return q.rows[0].n;
};
const readOutbox=async()=>(
  await outboxReaderPool.query(
    'SELECT * FROM public.da_qa_financial_outbox_read_018($1::integer)',[100])
).rows;
const readReceipt=async(orderId)=>new QaClientOwnedOrderReceiptReader(
  clientPool).readOwned(principal,orderId,mutationId);

test('single PG17 trace: durable order -> signed inbox -> provider capture -> outbox -> refund hold -> dispatch denied',async()=>{
  try {
    const snapshot=new QaCanonicalOrderSnapshotPgAdapter(clientPool);
    const payment=new QaClientCommercePgAdapter(clientPool,
      process.env.QA_COMMERCE_HMAC_KEY);
    const creator=new QaStripeTestIntentCreator(payment,creatorPool,{
      secretKey:fakeKey,publishableKey:fakePub,
      expectedAccountId:account,syntheticOnly:true,fetcher:fakeStripe,
    });
    const inboxA=new QaStripeTestWebhookInboxAdapter(
      inboxPoolA,process.env.QA_WEBHOOK_TEST_SECRET);
    const inboxB=new QaStripeTestWebhookInboxAdapter(
      inboxPoolB,process.env.QA_WEBHOOK_TEST_SECRET);
    const verifierConfig={
      stripeTestSecret:fakeKey,expectedAccountId:account,
      financeHmacSecret:process.env.QA_FINANCE_HMAC_KEY,
      syntheticOnly:true,fetcher:fakeStripe,
    };
    const reconA=new QaStripeTestFinancialReconciler(financePoolA,verifierConfig);
    const reconB=new QaStripeTestFinancialReconciler(financePoolB,verifierConfig);
    const commerce=new QaMerchantCourierFulfillmentPgAdapter(
      merchantPool,courierPool,dispatchPool);

    assert.equal((await readOutbox()).length,0);
    await assert.rejects(
      ()=>clientPool.query('SELECT * FROM public.da_qa_financial_outbox_read_018(100)'),
      /permission denied/);
    await assert.rejects(
      ()=>outboxReaderPool.query('SELECT * FROM public.da_qa_financial_outbox_018'),
      /permission denied/);
    await assert.rejects(
      ()=>outboxReaderPool.query('SELECT * FROM public.da_qa_financial_outbox_read_018(101)'),
      /qa_outbox_limit_invalid/);

    const order=await snapshot.reserveOrderAndSnapshot(principal,quote,mutationId);
    assert.equal((await readReceipt(order.orderId)).dispatchEligible,false);
    assert.equal(paymentPosts,0);
    await assert.rejects(
      ()=>commerce.merchantTransition(merchant,membership,order.orderId,'accepted'),
      /qa_merchant_transition_denied_or_financial_hold/);
    const intent=await creator.createOrResume(principal,quote,mutationId);
    assert.equal(intent.paymentIntentId,piId);
    assert.equal(intent.mode,'test');
    assert.equal(paymentPosts,1);
    assert.equal(stripeObjects.size,1);
    assert.equal(await getCount('outbox',null,intent.authorityId),0);
    const before=await readReceipt(order.orderId);
    assert.equal(before.financialStatus,'awaiting_payment');
    assert.equal(before.dispatchEligible,false);
    console.log('P0_FINALITY_DB_FIRST_ORDER_BEFORE_FAKE_STRIPE=PASS');

    const payload={
      id:webhookId,object:'event',type:'payment_intent.succeeded',livemode:false,
      data:{object:{id:piId,object:'payment_intent',livemode:false}},
    };
    const raw=Buffer.from(JSON.stringify(payload));
    const t=Math.floor(Date.now()/1000);
    const sign=s=> 't='+t+',v1='+crypto.createHmac('sha256',s)
      .update(String(t)).update('.').update(raw).digest('hex');
    const signature=sign(process.env.QA_WEBHOOK_TEST_SECRET);
    await assert.rejects(
      ()=>inboxA.receiveSignedTestWebhook(raw,
        sign('whsec_'+'0'.repeat(64))),
      /qa_stripe_webhook_signature_mismatch/);
    assert.equal(await getCount('inbox',null,intent.authorityId),0);
    const events=await Promise.all(Array.from({length:8},(_,i)=>
      (i%2===0?inboxA:inboxB).receiveSignedTestWebhook(raw,signature)));
    assert.equal(events.length,8);
    assert.equal(events.filter(x=>!x.duplicate).length,1);
    assert.equal(events.filter(x=>x.duplicate).length,7);
    assert.ok(events.every(x=>x.authorityId===intent.authorityId));
    assert.equal(await getCount('inbox',null,intent.authorityId),1);
    // Same event ID with a newly signed *different* body must never replay.
    const changed=Buffer.from(JSON.stringify({
      ...payload,type:'payment_intent.payment_failed',
    }));
    const changedSig='t='+t+',v1='+crypto.createHmac('sha256',
      process.env.QA_WEBHOOK_TEST_SECRET)
      .update(String(t)).update('.').update(changed).digest('hex');
    await assert.rejects(
      ()=>inboxA.receiveSignedTestWebhook(changed,changedSig),
      /qa_stripe_event_id_payload_collision_rejected/);
    assert.equal(await getCount('inbox',null,intent.authorityId),1);
    assert.equal(await getCount('outbox',null,intent.authorityId),0);
    assert.equal((await readReceipt(order.orderId)).financialStatus,'awaiting_payment');
    assert.equal((await reconA.reconcileAuthority(intent.authorityId,webhookId)).outcome,
      'awaiting_provider');
    assert.equal(await getCount('outbox',null,intent.authorityId),0);
    console.log('P0_FINALITY_SIGNED_INBOX_8_WAY_ONE_EVENT_NEVER_PAID=PASS');

    fakePi={
      ...fakePi,status:'succeeded',amount_received:2690,
      latest_charge:{
        id:chargeId,object:'charge',livemode:false,
        payment_intent:piId,amount:2690,amount_captured:2690,
        amount_refunded:0,currency:'eur',paid:true,captured:true,
        refunded:false,disputed:false,status:'succeeded',
      },
    };
    const safe=structuredClone(fakePi);
    fakePi.latest_charge.payment_intent='pi_QA_FOREIGN_CHARGE_0001';
    await assert.rejects(
      ()=>reconA.reconcileAuthority(intent.authorityId,webhookId),
      /qa_finance_charge_not_fully_captured_or_foreign/);
    fakePi=safe;
    assert.equal(await getCount('outbox',null,intent.authorityId),0);
    const results=await Promise.all(Array.from({length:8},(_,i)=>
      (i%2===0?reconA:reconB).reconcileAuthority(intent.authorityId,webhookId)));
    assert.equal(results.filter(r=>r.outcome==='captured').length,8);
    assert.equal(results.filter(r=>r.duplicate===false).length,1);
    assert.equal(results.filter(r=>r.duplicate===true).length,7);
    assert.equal(await getCount('capture',null,intent.authorityId),1);
    assert.equal(await getCount('outbox',null,intent.authorityId),1);
    const committed=await readOutbox();
    const captureEvent=committed.find(x=>x.authority_id===intent.authorityId);
    assert.ok(captureEvent);
    assert.equal(captureEvent.event_kind,'payment_captured');
    assert.equal(captureEvent.source_id,chargeId);
    const paid=await readReceipt(order.orderId);
    assert.equal(paid.financialStatus,'paid');
    assert.equal(paid.dispatchEligible,true);
    assert.equal(paymentPosts,1);
    console.log('P0_FINALITY_VERIFIED_CAPTURE_8_WAY_ONE_RECEIPT_ONE_OUTBOX=PASS');

    assert.equal(await commerce.merchantTransition(
      merchant,membership,order.orderId,'accepted'),'accepted');
    assert.equal(await commerce.merchantTransition(
      merchant,membership,order.orderId,'ready'),'ready');
    assert.equal(await commerce.dispatcherOffer(roster,order.orderId),'offered');
    assert.equal(await commerce.courierTransition(
      courier,roster,order.orderId,'accepted'),'accepted');
    const visible=await commerce.merchantInbox(merchant,membership);
    const relevant=visible.find(x=>x.orderId===order.orderId);
    assert.equal(relevant.financialState,'paid');
    assert.equal(relevant.dispatchEligible,true);
    const offers=await commerce.courierOffers(courier,roster);
    assert.equal(offers.find(x=>x.orderId===order.orderId).actionEligible,true);
    console.log('P0_FINALITY_MERCHANT_COURIER_ELIGIBLE_ONLY_AFTER_CAPTURE=PASS');

    // Prove transaction rollback atomically removes the finance HOLD
    // and its generated outbox event (no partial journal on worker crash).
    const transient=await financePoolA.connect();
    let open=false;
    try{
      await transient.query('BEGIN');
      open=true;
      await transient.query(
        'SELECT * FROM public.da_qa_finance_record_hold('+
          '$1::uuid,$2::text,$3::text)',
        [intent.authorityId,'re_QAP0ROLLBACK20261014','refund']);
      // The financial reconciler deliberately has NO direct SELECT on the
      // outbox table; verify invisibility using an independent audit session.
      assert.equal(await getCount('hold',null,intent.authorityId),0);
      assert.equal(await getCount('outbox',null,intent.authorityId),1);
      await transient.query('ROLLBACK');
      open=false;
    }finally{
      if(open)await transient.query('ROLLBACK').catch(()=>{});
      transient.release();
    }
    assert.equal(await getCount('hold',null,intent.authorityId),0);
    assert.equal(await getCount('outbox',null,intent.authorityId),1);
    assert.equal((await readReceipt(order.orderId)).dispatchEligible,true);
    console.log('P0_FINALITY_ROLLBACK_REMOVES_UNCOMMITTED_HOLD_AND_OUTBOX=PASS');

    // Refund arrives AFTER successful capture; fake Stripe confirms it
    // independently (no HTTP POST refund/capture: GET-only reconciler).
    fakePi={...fakePi,latest_charge:{
      ...fakePi.latest_charge,refunded:true,amount_refunded:100,
    }};
    const held=await reconA.reconcileAuthority(intent.authorityId,webhookId);
    assert.equal(held.outcome,'financial_hold');
    const replayHold=await reconB.reconcileAuthority(intent.authorityId,webhookId);
    assert.equal(replayHold.outcome,'financial_hold');
    assert.equal(await getCount('hold',null,intent.authorityId),1);
    assert.equal(await getCount('outbox',null,intent.authorityId),2);
    const messages=(await readOutbox())
      .filter(x=>x.authority_id===intent.authorityId);
    assert.deepEqual(new Set(messages.map(x=>x.event_kind)),
      new Set(['payment_captured','financial_hold']));
    assert.equal(new Set(messages.map(x=>x.event_id)).size,2);
    const late=await readReceipt(order.orderId);
    assert.equal(late.financialStatus,'financial_hold');
    assert.equal(late.dispatchEligible,false);
    const otherView=await commerce.merchantInbox(merchant,membership);
    assert.equal(otherView.find(x=>x.orderId===order.orderId).financialState,
      'financial_hold');
    const blockedOffers=await commerce.courierOffers(courier,roster);
    assert.equal(blockedOffers.find(x=>x.orderId===order.orderId).actionEligible,
      false);
    await assert.rejects(
      ()=>commerce.courierTransition(courier,roster,order.orderId,'picked_up'),
      /qa_courier_transition_denied_or_financial_hold/);
    await assert.rejects(
      ()=>commerce.merchantTransition(merchant,membership,order.orderId,'ready'),
      /qa_merchant_transition_denied_or_financial_hold/);
    assert.equal(await getCount('outbox',null,intent.authorityId),2);
    assert.equal((await readOutbox()).filter(x=>
      x.authority_id===intent.authorityId).length,2);
    assert.equal(paymentPosts,1);
    assert.ok(providerReads>=2);
    console.log('P0_FINALITY_REFUND_ONE_HOLD_OUTBOX_COURIER_PICKUP_DENIED=PASS');

    // Outbox events cannot be deleted/changed, even by SQL owner.
    await assert.rejects(
      ()=>admin.query('DELETE FROM public.da_qa_financial_outbox_018 WHERE order_id=$1',
        [order.orderId]),/qa_financial_outbox_immutable/);
    await assert.rejects(
      ()=>admin.query(
        "UPDATE public.da_qa_financial_outbox_018 SET event_kind='payment_captured' WHERE order_id=$1",
        [order.orderId]),/qa_financial_outbox_immutable/);
    assert.equal(await getCount('outbox',null,intent.authorityId),2);
    console.log('P0_FINALITY_OUTBOX_ATOMIC_APPEND_ONLY_NO_WORKER=PASS');
    console.log('P0_FINANCIAL_FINALITY_SINGLE_TRACE_QA=PASS_NO_LIVE');
  }finally{
    await Promise.allSettled([
      admin.end(),clientPool.end(),creatorPool.end(),inboxPoolA.end(),
      inboxPoolB.end(),financePoolA.end(),financePoolB.end(),
      merchantPool.end(),courierPool.end(),dispatchPool.end(),
      outboxReaderPool.end(),
    ]);
  }
});
