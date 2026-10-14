'use strict';
/**
 * QA 008: Postgres17 lock ordering for refunded payment vs Courier pickup.
 * Fully synthetic invoices. Only Docker --network none CI namespace.
 */
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {test}=require('node:test');
const {setTimeout:delay}=require('node:timers/promises');
const {Pool}=require('pg');
const {QaClientCommercePgAdapter}=
  require('/qa-built/client-commerce.pg-qa.adapter.js');
const {QaCanonicalOrderSnapshotPgAdapter}=
  require('/qa-built/client-order-snapshot.pg-qa.adapter.js');
const {QaMerchantCourierFulfillmentPgAdapter}=
  require('/qa-built/merchant-courier-fulfillment.pg-qa.adapter.js');

if(process.env.GITHUB_ACTIONS!=='true' ||
   process.env.QA_SYNTHETIC_ONLY!=='YES' ||
   process.env.QA_COMMERCE_DB_HOST!=='127.0.0.1' ||
   process.env.QA_COMMERCE_DB_NAME!=='postgres' ||
   !/^[a-f0-9]{64}$/.test(process.env.QA_COMMERCE_HMAC_KEY||'')){
  throw Error('QA_008_DISCONNECTED_PG17_REQUIRED');
}
const settings={host:'127.0.0.1',port:5432,database:'postgres',
  connectionTimeoutMillis:10000,query_timeout:12000,
  statement_timeout:12000};
const pool=user=>new Pool({...settings,user,max:6});
const buyerPool=pool('da_qa_client_commerce_app');
const merchantPool=pool('da_qa_merchant_commerce_app');
const courierPool=pool('da_qa_courier_commerce_app');
const dispatchPool=pool('da_qa_dispatch_commerce_app');
const financePool=pool('da_qa_stripe_finance_reconciler');
const auditPool=pool('postgres');
const buyer={
  issuer:'https://qa.example.invalid/realms/da-client',
  subject:'a63f867f-9f42-4573-9268-dc65a164d2c1',
  role:'client',authSource:'external',ownershipEligible:true,
};
const merchant={
  issuer:'https://qa.example.invalid/realms/da-merchant',
  subject:'b63f867f-9f42-4573-9268-dc65a164d2c2',
  role:'merchant',authSource:'external',ownershipEligible:true,
};
const member={
  issuer:merchant.issuer,subject:merchant.subject,
  slug:'qa-restaurant',membershipId:'qa-008-member',
  partnerId:'qa-restaurant',membershipStatus:'active',
  partnerLifecycleStatus:'published',membershipRole:'manager',
  contractStatus:'active',kybStatus:'verified',accessEligible:true,
  startsAt:null,expiresAt:null,revokedAt:null,
};
const driver={
  issuer:'https://qa.example.invalid/realms/da-courier',
  subject:'c63f867f-9f42-4573-9268-dc65a164d2c3',
  role:'courier',authSource:'external',ownershipEligible:true,
};
const roster={issuer:driver.issuer,subject:driver.subject,
  source:'committed-server-roster',active:true};
const quote={
  source:'server-canonical-catalog',merchantSlug:'qa-restaurant',
  quoteFingerprint:'a'.repeat(64),cartFingerprint:'b'.repeat(64),
  totalMinor:2690,currency:'EUR',
  fulfillment:{subtotalMinor:2300,deliveryFeeMinor:390,lines:[
    {sku:'rice',name:'Jollof rice',category:'Menu',quantity:1,
      unitAmountMinor:1500,lineAmountMinor:1500},
    {sku:'juice',name:'Bissap',category:'Drink',quantity:2,
      unitAmountMinor:400,lineAmountMinor:800},
  ]},
};
const reserve=new QaCanonicalOrderSnapshotPgAdapter(buyerPool);
const payment=new QaClientCommercePgAdapter(
  buyerPool,process.env.QA_COMMERCE_HMAC_KEY);
const commerce=new QaMerchantCourierFulfillmentPgAdapter(
  merchantPool,courierPool,dispatchPool);
const holdSql='SELECT * FROM public.da_qa_finance_record_hold('+
  '$1::uuid,$2::text,$3::text)';
const courierSql='SELECT public.da_qa_courier_transition('+
  '$1::uuid,$2::text,$3::uuid,$4::text) AS state';

async function capturedAndAssigned(mutation,pi,charge,hash){
  const order=await reserve.reserveOrderAndSnapshot(buyer,quote,mutation);
  const auth=await payment.reserveTestPayment(buyer,order.orderId);
  await auditPool.query(
    'SELECT * FROM public.da_qa_provider_bind_test_intent('+
      '$1::uuid,$2::text,$3::bigint,$4::char(3))',
    [auth.authorityId,pi,2690,'EUR']);
  await auditPool.query(
    'SELECT * FROM public.da_qa_finance_commit_captured_test('+
      '$1::uuid,$2::text,$3::text,$4::text,$5::bigint,'+
      '$6::char(3),$7::char(64),$8::text)',
    [auth.authorityId,pi,charge,'acct_QA008RACE',2690,'EUR',hash,null]);
  await commerce.merchantTransition(merchant,member,order.orderId,'accepted');
  await commerce.merchantTransition(merchant,member,order.orderId,'ready');
  await commerce.dispatcherOffer(roster,order.orderId);
  await commerce.courierTransition(driver,roster,order.orderId,'accepted');
  return {orderId:order.orderId,authorityId:auth.authorityId};
}
async function waitForBlocked(functionName){
  for(let i=0;i<70;i++){
    const result=await auditPool.query(
      "SELECT count(*)::integer AS n FROM pg_catalog.pg_stat_activity "+
      "WHERE datname='postgres' AND wait_event_type='Lock' "+
      "AND query LIKE $1",['%'+functionName+'%']);
    if(result.rows[0].n>0)return;
    await delay(60);
  }
  throw Error('QA_008_EXPECTED_BLOCKING_NOT_OBSERVED_'+functionName);
}

test('QA 008: finance refunds serialize with Courier transitions',async()=>{
  let refundTx=null,pickupTx=null,waitingCourier=null,waitingRefund=null;
  try{
    // First linearization: refund transaction locks the order before pickup.
    const first=await capturedAndAssigned(
      'qa-008-refund-first-0001','pi_QA008REFUNDFIRST0001',
      'ch_QA008CHARGEFIRST0001',
      createHash('sha256').update('qa-008-refund-first-receipt').digest('hex'));
    refundTx=await financePool.connect();
    await refundTx.query('BEGIN');
    await refundTx.query(holdSql,[
      first.authorityId,'re_QA008REFUNDFIRST0001','refund']);
    let courierSettled=false;
    waitingCourier=commerce.courierTransition(
      driver,roster,first.orderId,'picked_up')
      .finally(()=>{courierSettled=true;});
    waitingCourier.catch(()=>{});
    await waitForBlocked('da_qa_courier_transition');
    assert.equal(courierSettled,false);
    await refundTx.query('COMMIT');
    refundTx.release();refundTx=null;
    await assert.rejects(waitingCourier,
      /qa_courier_transition_denied_or_financial_hold/);
    waitingCourier=null;
    const status1=await auditPool.query(
      'SELECT state FROM public.da_qa_courier_offer WHERE order_id=$1',
      [first.orderId]);
    assert.equal(status1.rows[0].state,'accepted');
    console.log('QA_008_REFUND_FIRST_COURIER_WAITED_THEN_PICKUP_DENIED');
    // Second linearization: pickup locks the order before refund.
    const second=await capturedAndAssigned(
      'qa-008-pickup-first-0002','pi_QA008PICKUPFIRST0002',
      'ch_QA008CHARGESECOND0002',
      createHash('sha256').update('qa-008-pickup-first-receipt').digest('hex'));
    pickupTx=await courierPool.connect();
    await pickupTx.query('BEGIN');
    const pickup=await pickupTx.query(courierSql,[
      second.orderId,driver.issuer,driver.subject,'picked_up']);
    assert.equal(pickup.rows[0].state,'picked_up');
    let refundSettled=false;
    waitingRefund=financePool.query(holdSql,[
      second.authorityId,'re_QA008REFUNDSECOND0002','refund'])
      .finally(()=>{refundSettled=true;});
    waitingRefund.catch(()=>{});
    await waitForBlocked('da_qa_finance_record_hold');
    assert.equal(refundSettled,false);
    await pickupTx.query('COMMIT');
    pickupTx.release();pickupTx=null;
    const inserted=await waitingRefund;
    waitingRefund=null;
    assert.equal(inserted.rows[0].duplicate,false);
    const status2=await auditPool.query(
      'SELECT state FROM public.da_qa_courier_offer WHERE order_id=$1',
      [second.orderId]);
    assert.equal(status2.rows[0].state,'picked_up');
    await assert.rejects(
      ()=>commerce.courierTransition(
        driver,roster,second.orderId,'delivered'),
      /qa_courier_transition_denied_or_financial_hold/);
    await assert.rejects(
      ()=>commerce.merchantTransition(
        merchant,member,second.orderId,'ready'),
      /qa_merchant_transition_denied_or_financial_hold/);
    console.log('QA_008_PICKUP_FIRST_REFUND_WAITED_THEN_DELIVERY_DENIED');
    // Replaying the exact same adjustment cannot reactivate dispatch.
    const replay=await financePool.query(holdSql,[
      second.authorityId,'re_QA008REFUNDSECOND0002','refund']);
    assert.equal(replay.rows[0].duplicate,true);
    console.log('QA_008_FINANCE_HOLD_REPLAY_STABLE');
  }finally{
    if(refundTx){
      try{await refundTx.query('ROLLBACK');}catch{}
      refundTx.release();
    }
    if(pickupTx){
      try{await pickupTx.query('ROLLBACK');}catch{}
      pickupTx.release();
    }
    if(waitingCourier)await Promise.allSettled([waitingCourier]);
    if(waitingRefund)await Promise.allSettled([waitingRefund]);
    await Promise.all([
      buyerPool.end(),merchantPool.end(),courierPool.end(),
      dispatchPool.end(),financePool.end(),auditPool.end(),
    ]);
  }
});
