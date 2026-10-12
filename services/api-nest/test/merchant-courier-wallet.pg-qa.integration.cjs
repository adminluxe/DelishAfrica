'use strict';
/**
 * QA 009 only: isolated PG17 wallet allocation and live projections.
 * Transactional REAL PostgreSQL + synthetic capture, no Stripe connection.
 * No payout, transfer or production AppModule.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {Pool}=require('pg');
const {QaClientCommercePgAdapter}=
  require('/qa-built/client-commerce.pg-qa.adapter.js');
const {QaCanonicalOrderSnapshotPgAdapter}=
  require('/qa-built/client-order-snapshot.pg-qa.adapter.js');
const {QaMerchantCourierFulfillmentPgAdapter}=
  require('/qa-built/merchant-courier-fulfillment.pg-qa.adapter.js');
const {QaMerchantCourierWalletPgAdapter}=
  require('/qa-built/merchant-courier-wallet.pg-qa.adapter.js');

if(process.env.GITHUB_ACTIONS!=='true'||
   process.env.QA_SYNTHETIC_ONLY!=='YES'||
   process.env.QA_COMMERCE_DB_HOST!=='127.0.0.1'||
   process.env.QA_COMMERCE_DB_NAME!=='postgres'||
   !/^[0-9a-f]{64}$/.test(process.env.QA_COMMERCE_HMAC_KEY||'')){
  throw Error('QA_009_DISCONNECTED_WALLET_POSTGRES_ONLY');
}
const settings={host:'127.0.0.1',port:5432,database:'postgres',
  connectionTimeoutMillis:10000,statement_timeout:12000,
  query_timeout:12000};
const pool=user=>new Pool({...settings,user,max:9});
const app=pool('da_qa_client_commerce_app');
const merchantPg=pool('da_qa_merchant_commerce_app');
const courierPg=pool('da_qa_courier_commerce_app');
const dispatchPg=pool('da_qa_dispatch_commerce_app');
const financePg=pool('da_qa_stripe_finance_reconciler');
const financeOtherPg=pool('da_qa_stripe_finance_reconciler');
const audit=pool('postgres');
const buyer={issuer:'https://qa.example.invalid/realms/da-client',
  subject:'a63f867f-9f42-4573-9268-dc65a164d2c1',
  role:'client',authSource:'external',ownershipEligible:true};
const merchant={
  issuer:'https://qa.example.invalid/realms/da-merchant',
  subject:'b63f867f-9f42-4573-9268-dc65a164d2c2',
  role:'merchant',name:'QA Restaurant',authSource:'external',
  ownershipEligible:true,expiresAt:new Date(Date.now()+3600000).toISOString()};
const member={
  issuer:merchant.issuer,subject:merchant.subject,
  membershipId:'qa-wallet-member-009',partnerId:'qa-restaurant',
  slug:'qa-restaurant',membershipStatus:'active',
  partnerLifecycleStatus:'published',membershipRole:'manager',
  contractStatus:'active',kybStatus:'verified',
  accessEligible:true,startsAt:null,expiresAt:null,revokedAt:null};
const driver={
  issuer:'https://qa.example.invalid/realms/da-courier',
  subject:'c63f867f-9f42-4573-9268-dc65a164d2c3',
  role:'courier',name:'QA Driver',authSource:'external',
  ownershipEligible:true,expiresAt:new Date(Date.now()+3600000).toISOString()};
const roster={issuer:driver.issuer,subject:driver.subject,
  source:'committed-server-roster',active:true};
const canonical={
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
const reserve=new QaCanonicalOrderSnapshotPgAdapter(app);
const pay=new QaClientCommercePgAdapter(
  app,process.env.QA_COMMERCE_HMAC_KEY);
const commercial=new QaMerchantCourierFulfillmentPgAdapter(
  merchantPg,courierPg,dispatchPg);
const wallet=new QaMerchantCourierWalletPgAdapter(
  merchantPg,courierPg,financePg);
const walletOther=new QaMerchantCourierWalletPgAdapter(
  merchantPg,courierPg,financeOtherPg);
async function prepare(mutation,receiptId=null){
  const order=await reserve.reserveOrderAndSnapshot(
    buyer,canonical,mutation);
  if(!receiptId)return {orderId:order.orderId};
  const payment=await pay.reserveTestPayment(buyer,order.orderId);
  const pi='pi_QA009WALLET'+receiptId;
  const charge='ch_QA009WALLET'+receiptId;
  const hash=createHash('sha256').update(
    'delishafrica-wallet-qa-only:'+receiptId).digest('hex');
  await audit.query(
    'SELECT * FROM public.da_qa_provider_bind_test_intent('+
      '$1::uuid,$2::text,$3::bigint,$4::char(3))',
    [payment.authorityId,pi,2690,'EUR']);
  await audit.query(
    'SELECT * FROM public.da_qa_finance_commit_captured_test('+
      '$1::uuid,$2::text,$3::text,$4::text,'+
      '$5::bigint,$6::char(3),$7::char(64),$8::text)',
    [payment.authorityId,pi,charge,'acct_QA009FIXTURE',2690,
      'EUR',hash,null]);
  return {orderId:order.orderId,authorityId:payment.authorityId};
}
const expectMoney=(report,part,expected)=>{
  assert.equal(report.summary[part+'Minor'],expected,
    part+' mismatch (TEST only)');
  assert.equal(report.summary.currency,'EUR');
  assert.equal(report.summary.withdrawableMinor,0);
  assert.equal(report.summary.payoutEnabled,false);
};

test('QA 009: real PG17 8-way captured allocation, Merchant/Courier money progresses and freezes',async()=>{
  try{
    const unpaid=await prepare('qa-wallet009-unpaid-0001');
    await assert.rejects(
      ()=>wallet.accrueVerifiedCapture(unpaid.orderId),
      /qa_wallet_capture_not_verified/);
    assert.equal((await wallet.merchantWallet(merchant,member))
      .summary.orderCount,0);
    assert.equal((await wallet.courierWallet(driver,roster))
      .summary.orderCount,0);
    console.log('QA_009_UNPAID_ORDER=ZERO_MERCHANT_AND_COURIER_WALLET');

    const captured=await prepare(
      'qa-wallet009-captured-0001','CAPTURE0001');
    const races=await Promise.all(Array.from({length:8},(_,i)=>
      (i%2?wallet:walletOther)
        .accrueVerifiedCapture(captured.orderId)));
    assert.equal(races.filter(x=>!x.replayed).length,1);
    assert.equal(races.filter(x=>x.replayed).length,7);
    const journal=await audit.query(
      'SELECT count(*)::integer AS n,coalesce(sum(signed_minor),0)::bigint AS balance '+
      'FROM public.da_qa_wallet_posting WHERE order_id=$1',
      [captured.orderId]);
    assert.equal(journal.rows[0].n,4);
    assert.equal(Number(journal.rows[0].balance),0);
    const allocated=await audit.query(
      'SELECT * FROM public.da_qa_wallet_allocation WHERE order_id=$1',
      [captured.orderId]);
    assert.equal(allocated.rows.length,1);
    assert.equal(allocated.rows[0].policy_id,'QA_FIXTURE_EUR_V1');
    assert.equal(Number(allocated.rows[0].captured_minor),2690);
    assert.equal(Number(allocated.rows[0].merchant_fee_minor),460);
    assert.equal(Number(allocated.rows[0].merchant_earned_minor),1840);
    assert.equal(Number(allocated.rows[0].courier_reserved_minor),390);
    assert.equal(Number(allocated.rows[0].platform_retained_minor),460);
    console.log('QA_009_EIGHT_CONCURRENT_ACCRUALS=ONE_BALANCED_IMMUTABLE_JOURNAL');

    const mPending=await wallet.merchantWallet(merchant,member,30);
    expectMoney(mPending,'accrued',1840);
    expectMoney(mPending,'pending',1840);
    expectMoney(mPending,'available',0);
    expectMoney(mPending,'held',0);
    assert.equal(mPending.activity.length,1);
    assert.equal(mPending.activity[0].earnedMinor,1840);
    assert.equal(mPending.activity[0].grossMinor,2300);
    assert.equal(mPending.activity[0].feeMinor,460);
    assert.equal(mPending.activity[0].financialState,'captured');
    assert.equal((await wallet.courierWallet(driver,roster)).summary.orderCount,0);
    console.log('QA_009_MERCHANT_CAPTURED_EARNINGS=PENDING_COURIER_NOT_ASSIGNED');

    await commercial.merchantTransition(
      merchant,member,captured.orderId,'accepted');
    await commercial.merchantTransition(
      merchant,member,captured.orderId,'ready');
    const mAvailable=await wallet.merchantWallet(merchant,member);
    expectMoney(mAvailable,'available',1840);
    expectMoney(mAvailable,'pending',0);
    await commercial.dispatcherOffer(roster,captured.orderId);
    const cPending=await wallet.courierWallet(driver,roster);
    expectMoney(cPending,'accrued',390);
    expectMoney(cPending,'pending',390);
    expectMoney(cPending,'available',0);
    assert.equal(cPending.activity[0].stage,'offered');
    console.log('QA_009_MERCHANT_READY=AVAILABLE_COURIER_ASSIGNED=PENDING');

    await commercial.courierTransition(
      driver,roster,captured.orderId,'accepted');
    await commercial.courierTransition(
      driver,roster,captured.orderId,'picked_up');
    await commercial.courierTransition(
      driver,roster,captured.orderId,'delivered');
    const cAvailable=await wallet.courierWallet(driver,roster);
    expectMoney(cAvailable,'available',390);
    expectMoney(cAvailable,'pending',0);
    assert.equal(cAvailable.activity[0].stage,'delivered');
    assert.equal(cAvailable.summary.withdrawableMinor,0);
    console.log('QA_009_COURIER_DELIVERED=EARNED_AVAILABLE_NOT_WITHDRAWABLE');

    await audit.query(
      'SELECT * FROM public.da_qa_finance_record_hold('+
        '$1::uuid,$2::text,$3::text)',
      [captured.authorityId,'re_QA009AFTERDELIVER0001','refund']);
    const heldM=await wallet.merchantWallet(merchant,member);
    const heldC=await wallet.courierWallet(driver,roster);
    expectMoney(heldM,'held',1840);
    expectMoney(heldM,'available',0);
    expectMoney(heldC,'held',390);
    expectMoney(heldC,'available',0);
    assert.equal(heldM.activity[0].financialState,'financial_hold');
    assert.equal(heldC.activity[0].financialState,'financial_hold');
    assert.equal(heldM.summary.accruedMinor,1840);
    assert.equal(heldC.summary.accruedMinor,390);
    console.log('QA_009_REFUND_AFTER_DELIVERY=BOTH_EARNINGS_HELD_ZERO_PAYOUT');

    await assert.rejects(
      ()=>wallet.merchantWallet(merchant,{...member,kybStatus:'expired'}),
      /qa_fulfillment_merchant_membership_denied/);
    await assert.rejects(
      ()=>wallet.merchantWallet({...merchant,authSource:'dev-login'},member),
      /qa_fulfillment_verified_external_identity_required/);
    await assert.rejects(
      ()=>wallet.courierWallet(driver,{...roster,
        subject:'d63f867f-9f42-4573-9268-dc65a164d2c4'}),
      /qa_fulfillment_courier_roster_denied/);
    const stranger={...driver,subject:'d63f867f-9f42-4573-9268-dc65a164d2c4'};
    const notAssigned=await wallet.courierWallet(stranger,
      {...roster,subject:stranger.subject});
    expectMoney(notAssigned,'accrued',0);
    console.log('QA_009_FOREIGN_COURIER_AND_UNVERIFIED_MERCHANT=DENIED');

    for(const [role,query] of [
      [merchantPg,'SELECT * FROM public.da_qa_wallet_posting'],
      [courierPg,'SELECT * FROM public.da_qa_wallet_allocation'],
      [app,'SELECT * FROM public.da_qa_wallet_policy'],
    ]){
      await assert.rejects(()=>role.query(query),/permission denied/);
    }
    await assert.rejects(
      ()=>courierPg.query(
        'SELECT * FROM public.da_qa_wallet_accrue_verified_capture($1::uuid)',
        [captured.orderId]),/permission denied/);
    await assert.rejects(
      ()=>merchantPg.query(
        'SELECT * FROM public.da_qa_wallet_courier_summary($1::text,$2::uuid)',
        [driver.issuer,driver.subject]),/permission denied/);
    await assert.rejects(
      ()=>audit.query(
        'UPDATE public.da_qa_wallet_posting SET signed_minor=1 WHERE order_id=$1',
        [captured.orderId]),/qa_wallet_immutable_audit/);
    await assert.rejects(
      ()=>audit.query(
        'UPDATE public.da_qa_wallet_policy SET merchant_fee_bps=1'),
      /qa_wallet_immutable_audit/);
    console.log('QA_009_APP_ROLES_NO_RAW_LEDGER_WRITE_NO_POLICY_EDIT_NO_PAYOUT');

    // No stored balance is ever released to a PSP; this is a wallet-shaped
    // read-only entitlement view, not bank or Stripe account funds.
    assert.equal(heldM.summary.payoutEnabled,false);
    assert.equal(heldC.summary.payoutEnabled,false);
    console.log('QA_009_STRIPE_CALLS=ZERO_REAL_PAYOUTS=ZERO');
  }finally{
    await Promise.all([
      app.end(),merchantPg.end(),courierPg.end(),dispatchPg.end(),
      financePg.end(),financeOtherPg.end(),audit.end(),
    ]);
  }
});
