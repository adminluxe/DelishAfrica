'use strict';
/**
 * DelishAfrica QA 007 — REAL Node PG adapter integration against PostgreSQL17.
 * Merchant, Dispatcher and Courier each connect with an actual distinct
 * unprivileged DB role. No public route, no provider connection, no VPS.
 * Auth and merchant/roster evidence here are synthetic fixtures; verified
 * OIDC and merchant memberships still require production-grade integration.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const {QaClientCommercePgAdapter}=
  require('/qa-built/client-commerce.pg-qa.adapter.js');
const {QaCanonicalOrderSnapshotPgAdapter}=
  require('/qa-built/client-order-snapshot.pg-qa.adapter.js');
const {QaMerchantCourierFulfillmentPgAdapter}=
  require('/qa-built/merchant-courier-fulfillment.pg-qa.adapter.js');

if(process.env.GITHUB_ACTIONS!=='true'||
   process.env.QA_SYNTHETIC_ONLY!=='YES'||
   process.env.QA_COMMERCE_DB_HOST!=='127.0.0.1'||
   process.env.QA_COMMERCE_DB_NAME!=='postgres'||
   !/^[a-f0-9]{64}$/.test(process.env.QA_COMMERCE_HMAC_KEY||'')){
  throw Error('QA_007_DISCONNECTED_NODE_PG_ONLY');
}
const settings={
  host:'127.0.0.1',database:'postgres',port:5432,
  connectionTimeoutMillis:10000,statement_timeout:12000,
  query_timeout:12000,
};
function pool(role){return new Pool({...settings,user:role,max:7});}
const finance=pool('postgres');
const customerPool=pool('da_qa_client_commerce_app');
const merchantPool=pool('da_qa_merchant_commerce_app');
const courierPool=pool('da_qa_courier_commerce_app');
const dispatchPool=pool('da_qa_dispatch_commerce_app');
const client={issuer:'https://qa.example.invalid/realms/da-client',
  subject:'a63f867f-9f42-4573-9268-dc65a164d2c1',role:'client',
  authSource:'external',ownershipEligible:true};
const merchantPrincipal={
  issuer:'https://qa.example.invalid/realms/da-merchant',
  subject:'b63f867f-9f42-4573-9268-dc65a164d2c2',role:'merchant',
  authSource:'external',ownershipEligible:true,name:'Synthetic restaurant',
  expiresAt:new Date(Date.now()+3600000).toISOString(),
};
const courierPrincipal={
  issuer:'https://qa.example.invalid/realms/da-courier',
  subject:'c63f867f-9f42-4573-9268-dc65a164d2c3',role:'courier',
  authSource:'external',ownershipEligible:true,name:'Synthetic driver',
  expiresAt:new Date(Date.now()+3600000).toISOString(),
};
const member={
  membershipId:'qa-verified-contract-007',issuer:merchantPrincipal.issuer,
  subject:merchantPrincipal.subject,partnerId:'qa-test-restaurant',
  slug:'qa-restaurant',membershipStatus:'active',
  partnerLifecycleStatus:'published',membershipRole:'manager',
  contractStatus:'active',kybStatus:'verified',
  startsAt:null,expiresAt:null,revokedAt:null,
  createdAt:'2026-10-13',updatedAt:'2026-10-13',
  accessEligible:true,
};
const roster={issuer:courierPrincipal.issuer,
  subject:courierPrincipal.subject,active:true,
  source:'committed-server-roster'};
const quote={
  source:'server-canonical-catalog',merchantSlug:'qa-restaurant',
  quoteFingerprint:'a'.repeat(64),cartFingerprint:'b'.repeat(64),
  totalMinor:2690,currency:'EUR',
  fulfillment:{subtotalMinor:2300,deliveryFeeMinor:390,lines:[
    {sku:'rice',name:'Jollof rice',category:'Menu',
     quantity:1,unitAmountMinor:1500,lineAmountMinor:1500},
    {sku:'juice',name:'Bissap',category:'Drink',
     quantity:2,unitAmountMinor:400,lineAmountMinor:800},
  ]},
};
const orderAdapter=new QaCanonicalOrderSnapshotPgAdapter(customerPool);
const payAdapter=new QaClientCommercePgAdapter(
  customerPool,process.env.QA_COMMERCE_HMAC_KEY,
);
const commerce=new QaMerchantCourierFulfillmentPgAdapter(
  merchantPool,courierPool,dispatchPool,
);
async function createPaid(mutation,pi,charge,hmac){
  const order=await orderAdapter.reserveOrderAndSnapshot(client,quote,mutation);
  const reserved=await payAdapter.reserveTestPayment(client,order.orderId);
  await finance.query(
    'SELECT * FROM public.da_qa_provider_bind_test_intent('+
      '$1::uuid,$2::text,$3::bigint,$4::char(3))',
    [reserved.authorityId,pi,2690,'EUR']);
  await finance.query(
    'SELECT * FROM public.da_qa_finance_commit_captured_test('+
      '$1::uuid,$2::text,$3::text,$4::text,$5::bigint,'+
      '$6::char(3),$7::char(64),$8::text)',
    [reserved.authorityId,pi,charge,'acct_QA007NODE',2690,'EUR',
      hmac,null]);
  return {orderId:order.orderId,authorityId:reserved.authorityId};
}
const afterHold=async(authority,refund)=>
  finance.query(
    'SELECT * FROM public.da_qa_finance_record_hold('+
      '$1::uuid,$2::text,$3::text)',
    [authority,refund,'refund']);

test('real PG: committed Merchant membership + Courier roster port, exact paid order',async()=>{
  try{
    // Create a durable unpaid order, without calling any provider.
    const pending=await orderAdapter.reserveOrderAndSnapshot(
      client,quote,'qa-node007-unpaid-client-001');
    const invisible=await commerce.merchantInbox(
      merchantPrincipal,member,30);
    assert.ok(!invisible.some(x=>x.orderId===pending.orderId));
    await assert.rejects(
      ()=>commerce.merchantTransition(merchantPrincipal,member,
        pending.orderId,'accepted'),
      /qa_merchant_transition_denied_or_financial_hold/);
    console.log('QA_007_NODE_PG_UNPAID_ORDER=NOT_VISIBLE_NOT_ACCEPTABLE');

    const paid=await createPaid(
      'qa-node007-fully-paid-client-001','pi_QA007NODEPAID0001',
      'ch_QA007NODECHARGE0001','c'.repeat(64));
    const list=await commerce.merchantInbox(merchantPrincipal,member,30);
    const merchantOrder=list.find(x=>x.orderId===paid.orderId);
    assert.ok(merchantOrder);
    assert.equal(merchantOrder.amount,2690);
    assert.equal(merchantOrder.currency,'eur');
    assert.equal(merchantOrder.items.length,2);
    assert.equal(merchantOrder.items[0].sku,'rice');
    assert.equal(merchantOrder.financialState,'paid');
    assert.equal(merchantOrder.dispatchEligible,true);
    assert.ok(!JSON.stringify(merchantOrder).includes(client.subject));
    const suspended={...member,kybStatus:'expired'};
    await assert.rejects(
      ()=>commerce.merchantInbox(merchantPrincipal,suspended,30),
      /qa_fulfillment_merchant_membership_denied/);
    await assert.rejects(
      ()=>commerce.merchantTransition(merchantPrincipal,
        {...member,slug:'other-restaurant'},paid.orderId,'accepted'),
      /qa_merchant_transition_denied_or_financial_hold/);
    console.log('QA_007_NODE_PG_MERCHANT_VERIFIED_MEMBERSHIP_PAID_SNAPSHOT=PASS');

    assert.equal(await commerce.merchantTransition(
      merchantPrincipal,member,paid.orderId,'accepted'),'accepted');
    assert.equal(await commerce.merchantTransition(
      merchantPrincipal,member,paid.orderId,'accepted'),'accepted');
    assert.equal(await commerce.merchantTransition(
      merchantPrincipal,member,paid.orderId,'ready'),'ready');
    await assert.rejects(
      ()=>commerce.merchantTransition(
        merchantPrincipal,member,paid.orderId,'accepted'),
      /qa_merchant_transition_denied_or_financial_hold/);
    assert.equal(await commerce.dispatcherOffer(roster,paid.orderId),'offered');
    await assert.rejects(
      ()=>commerce.dispatcherOffer({...roster,
        subject:'d63f867f-9f42-4573-9268-dc65a164d2c4'},paid.orderId),
      /qa_dispatch_not_ready_or_financial_hold/);
    const otherPrincipal={...courierPrincipal,
      subject:'d63f867f-9f42-4573-9268-dc65a164d2c4'};
    const otherRoster={...roster,subject:otherPrincipal.subject};
    const foreignOffers=await commerce.courierOffers(
      otherPrincipal,otherRoster,20);
    assert.equal(foreignOffers.length,0);
    await assert.rejects(
      ()=>commerce.courierTransition(otherPrincipal,otherRoster,
        paid.orderId,'accepted'),
      /qa_courier_transition_denied_or_financial_hold/);
    console.log('QA_007_NODE_PG_FOREIGN_COURIER_NO_OFFER_OR_ACCEPTANCE=PASS');

    const offers=await commerce.courierOffers(courierPrincipal,roster,20);
    assert.ok(offers.some(x=>x.orderId===paid.orderId&&x.actionEligible));
    await assert.rejects(
      ()=>commerce.courierTransition(courierPrincipal,roster,
        paid.orderId,'delivered'),
      /qa_courier_transition_denied_or_financial_hold/);
    assert.equal(await commerce.courierTransition(
      courierPrincipal,roster,paid.orderId,'accepted'),'accepted');
    assert.equal(await commerce.courierTransition(
      courierPrincipal,roster,paid.orderId,'picked_up'),'picked_up');
    assert.equal(await commerce.courierTransition(
      courierPrincipal,roster,paid.orderId,'delivered'),'delivered');
    assert.equal(await commerce.courierTransition(
      courierPrincipal,roster,paid.orderId,'delivered'),'delivered');
    console.log('QA_007_NODE_PG_ACCEPT_PICKUP_DELIVER_SEQUENCE=PASS');

    // Second paid order is frozen by an append-only refund AFTER Courier
    // accepts and BEFORE pickup. No live dispatcher may bypass the hold.
    const held=await createPaid(
      'qa-node007-held-after-accept-001','pi_QA007NODEHELD0002',
      'ch_QA007NODECHARGE0002','d'.repeat(64));
    await commerce.merchantTransition(
      merchantPrincipal,member,held.orderId,'accepted');
    await commerce.merchantTransition(
      merchantPrincipal,member,held.orderId,'ready');
    await commerce.dispatcherOffer(roster,held.orderId);
    await commerce.courierTransition(
      courierPrincipal,roster,held.orderId,'accepted');
    await afterHold(held.authorityId,'re_QA007NODEREFUND0002');
    const heldOffers=await commerce.courierOffers(courierPrincipal,roster,20);
    const blocked=heldOffers.find(x=>x.orderId===held.orderId);
    assert.ok(blocked);
    assert.equal(blocked.financialState,'financial_hold');
    assert.equal(blocked.actionEligible,false);
    await assert.rejects(
      ()=>commerce.courierTransition(courierPrincipal,roster,
        held.orderId,'picked_up'),
      /qa_courier_transition_denied_or_financial_hold/);
    await assert.rejects(
      ()=>commerce.merchantTransition(
        merchantPrincipal,member,held.orderId,'ready'),
      /qa_merchant_transition_denied_or_financial_hold/);
    console.log('QA_007_NODE_PG_REFUND_BEFORE_PICKUP=BLOCKS_BOTH_APPS');

    await assert.rejects(
      ()=>merchantPool.query(
        'SELECT * FROM public.da_client_commerce_order_snapshot_qa'),
      /permission denied/);
    await assert.rejects(
      ()=>courierPool.query('SELECT * FROM public.da_qa_courier_offer'),
      /permission denied/);
    await assert.rejects(
      ()=>courierPool.query(
        'SELECT public.da_qa_dispatch_assign_offer('+
          '$1::uuid,$2::text,$3::uuid)',
        [paid.orderId,courierPrincipal.issuer,courierPrincipal.subject]),
      /permission denied/);
    console.log('QA_007_NODE_PG_THREE_SEPARATE_ROLE_ACLS=PASS');
  }finally{
    await Promise.all([
      customerPool.end(),merchantPool.end(),courierPool.end(),
      dispatchPool.end(),finance.end(),
    ]);
  }
});
