'use strict';
// P5-G: REAL Stripe TEST provider + REAL isolated PostgreSQL guest checkout.
// One-shot ONLY. No cards, no payment confirmation, no live keys, no public API.
// Journal is fsynced before external CREATE; uncertain outcomes require review.
const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const {randomBytes,createHmac}=require('node:crypto');
const ts=require('typescript');
require.extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(
  fs.readFileSync(p,'utf8'),{fileName:p,compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021,
  }}).outputText,p);
const {Pool}=require('/opt/delishafrica/monorepo/services/api-nest/.runtime-vendor/pg-runtime/node_modules/pg');
const {GuestCheckoutLedger}=require('../src/guest-checkout/guest-checkout-ledger.ts');
const {GuestPrivateFulfillmentVault}=require('../src/guest-checkout/guest-private-fulfillment-vault.ts');
const {GuestStripeIntentReservation}=require('../src/guest-checkout/guest-stripe-intent-reservation.ts');
const {GuestStripeHttpTestTransport}=require('../src/guest-checkout/guest-stripe-http-test-transport.ts');
const {GuestPaymentReconciliationMonitor}=require('../src/guest-checkout/guest-payment-reconciliation-monitor.ts');
const {GuestStripeFinancialFinalizer,GuestStripeHttpReader}=
  require('../src/guest-checkout/guest-stripe-financial-finalizer.ts');
const {GuestMerchantCoverageStrict,coverageApprovalDigest}=
  require('../src/guest-checkout/guest-merchant-coverage-strict.ts');
const {PostgresGuestCoverageOpsApprovals}=
  require('../src/guest-checkout/guest-coverage-ops-approval-pg.ts');

if(process.env.NODE_ENV!=='test' ||
   process.env.DA_GUEST_STRIPE_TEST_ONLY!=='1' ||
   process.env.DA_P5G_PROVIDER_REAL_EXPLICIT!=='YES'){
  throw Error('p5g_explicit_test_authorization_required');
}
const secret=process.env.DA_P5G_STRIPE_SECRET;
if(typeof secret!=='string' ||
   !/^sk_test_[A-Za-z0-9]+$/.test(secret)){
  throw Error('p5g_test_secret_required');
}
const repo=path.resolve(__dirname,'../../..');
const pgPort=55443;
const db=new Pool({
  host:'127.0.0.1',port:pgPort,user:'afripayadmin',
  database:'postgres',max:7,connectionTimeoutMillis:5000,
});
const key=randomBytes(32),dataKey=randomBytes(32);
const ledger=new GuestCheckoutLedger(db,key);
const vault=new GuestPrivateFulfillmentVault(
  db,key,new Map([['dek_p5g_lab',dataKey]]),'dek_p5g_lab',
);
const provider=new GuestStripeHttpTestTransport(secret,11000);
const journalFolder='/home/afripayadmin/guest-checkout-evidence-20261010/p5g-provider-intent-journal';
const quote={
  ok:true,version:1,partnerSlug:'thieyp',partnerName:'Thieyp P5G Lab',
  currency:'eur',availabilityDate:'2026-10-10',availabilityDay:'samedi',
  items:[{id:'sku_lab1',sku:'sku_lab1',
    name:'LAB ONLY (no real merchant order)',category:'Test',
    quantity:1,unitAmount:2190,lineAmount:2190,scheduledDay:null}],
  subtotal:2190,deliveryFee:0,total:2190,minimumOrderAmount:0,
  quoteFingerprint:'ab'.repeat(32),quotedAt:'2026-10-10T01:00:00.000Z',
};
const coverageContract={
  version:1,revision:1,enabled:true,approvedByMerchant:true,
  zones:[{enabled:true,code:'be-brussels-pilot',countryCode:'BE',
    postalCodes:['1050'],center:{latitude:50.83,longitude:4.37},
    maxDistanceMeters:1500}],
};
const merchant={id:'lab_thieyp',slug:'thieyp',
  name:'Thieyp P5G Lab',status:'active',
  delivery:{enabled:true,guestCheckoutCoverage:coverageContract}};
const coverage=new GuestMerchantCoverageStrict({
  async findPublishedBySlug(slug,fallback){
    assert.equal(slug,'thieyp');
    assert.deepEqual(fallback,[]);
    return merchant;
  },
},new PostgresGuestCoverageOpsApprovals(db));

function durableWrite(filepath,data,first=false){
  const serialized=JSON.stringify(data)+'\n';
  const dest=first?filepath:filepath+'.next-'+process.pid;
  const fd=fs.openSync(dest,'wx',0o600);
  try{
    fs.writeFileSync(fd,serialized,'utf8');
    fs.fsyncSync(fd);
  }finally{fs.closeSync(fd);}
  if(!first)fs.renameSync(dest,filepath);
  const dir=fs.openSync(path.dirname(filepath),'r');
  try{fs.fsyncSync(dir);}finally{fs.closeSync(dir);}
}
function journalStart(guest){
  fs.mkdirSync(journalFolder,{recursive:true,mode:0o700});
  assert.equal(fs.statSync(journalFolder).mode&0o777,0o700);
  assert.equal(fs.readdirSync(journalFolder).length,0,
    'p5g_existing_journal_requires_operator_review');
  const file=path.join(journalFolder,'p5g-real-stripe-intent.json');
  const data={mode:'TEST_ONLY',status:'before_remote_create',
    amountCents:2190,currency:'eur',
    orderId:guest.orderId,idempotencyKey:'da-gc-pi-v1:'+guest.orderId,
    quoteFingerprint:quote.quoteFingerprint,
    startedAt:new Date().toISOString(),intentId:null};
  durableWrite(file,data,true);
  return {file,data};
}
function record(journal,status,changes={}){
  journal.data={...journal.data,...changes,status,updatedAt:new Date().toISOString()};
  durableWrite(journal.file,journal.data);
}
async function prepareDb(){
  const pg=await db.query(
    'SELECT inet_server_port() AS port,current_database() AS database');
  assert.equal(pg.rows[0].port,pgPort);
  assert.equal(pg.rows[0].database,'postgres');
  const tables=await db.query(
    "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'");
  assert.equal(tables.rows[0].n,0,'refuse_nonempty_lab');
  for(const name of [
    '20261009_guest_checkout_ledger.sql',
    '20261009_guest_verified_payment.sql',
    '20261009_guest_fulfillment_vault.sql',
    '20261009_guest_coverage_ops_approvals.sql',
    '20261009_guest_intent_creation_reservations.sql',
    '20261009_guest_intent_recovery.sql',
    '20261009_guest_payment_reconciliation_alerts.sql',
  ]){
    await db.query(fs.readFileSync(path.join(repo,'migrations',name),'utf8'));
  }
  const digest=coverageApprovalDigest('thieyp',coverageContract);
  assert.match(digest,/^[a-f0-9]{64}$/);
  await db.query(
    'INSERT INTO da_guest_coverage_ops_approvals '+
    '(partner_slug,coverage_sha256,approved_by_ops_subject,expires_at) '+
    "VALUES($1,$2,$3,now()+interval '2 hours')",
    ['thieyp',digest,'ops_p5g_lab_authorized']);
}


test('P5-G Guest Stripe TEST capture, signed synthetic webhook and P3 outbox',
  {timeout:90000},async()=>{
    let journal=null,intentId=null,remoteSucceeded=false,financeCommitted=false;
    try{
      await prepareDb();
      const guest=await ledger.issue();
      await ledger.attachVerifiedQuote(guest.token,{
        amountCents:2190,currency:'eur',fingerprint:quote.quoteFingerprint});
      await vault.seal(guest.token,quote,{
        name:'Laboratory User',phone:'+32470000000',
        address:'12 Test Street',city:'Ixelles',consent:true,
      },{
        verifiedByServer:true,eligible:true,serviceAreaCode:'be-brussels-pilot',
        locationProof:{placeId:'googleplace_test001',countryCode:'BE',
          postalCode:'1050',latitude:50.83,longitude:4.37,
          source:'google_places_new'},
      });
      const approved=await coverage.verifyCoverage({
        partnerSlug:'thieyp',countryCode:'BE',postalCode:'1050',
        latitude:50.83,longitude:4.37,placeId:'googleplace_test001'});
      assert.equal(approved.allowed,true);

      journal=journalStart(guest);
      const service=new GuestStripeIntentReservation(
        db,provider,key,vault,coverage);
      const created=await service.start(guest.token);
      intentId=created.intentId;
      record(journal,'created',{intentId});
      assert.equal(created.state,'created');
      assert.equal(created.amount,2190);
      assert.ok(created.clientSecret.startsWith(intentId+'_secret_'));
      assert.equal((await service.start(guest.token)).intentId,intentId);

      const reader=new GuestStripeHttpReader(secret,11000);
      const syntheticWebhookKey='whsec_synthetic_p5g_signatures_only_20261010';
      const finalizer=new GuestStripeFinancialFinalizer(
        db,reader,syntheticWebhookKey,false);
      const eventId='evt_p5g_synthetic_'+randomBytes(8).toString('hex');
      const raw=Buffer.from(JSON.stringify({
        id:eventId,type:'payment_intent.succeeded',
        data:{object:{id:intentId}},
      }),'utf8');
      const seconds=Math.floor(Date.now()/1000);
      const badSignature='t='+seconds+',v1='+'0'.repeat(64);
      await assert.rejects(
        finalizer.consumeSignedWebhook(raw,badSignature),
        /guest_stripe_invalid_signature/);
      const initialFinance=await db.query(
        'SELECT count(*)::int AS n FROM da_guest_verified_payments');
      assert.equal(initialFinance.rows[0].n,0);

      // This is NOT a real customer payment/card: pm_card_visa is Stripe's
      // official synthetic TEST PaymentMethod. Never pass an actual PAN.
      record(journal,'test_confirmation_requested');
      const form=new URLSearchParams({
        payment_method:'pm_card_visa',
      });
      const response=await fetch(
        'https://api.stripe.com/v1/payment_intents/'+intentId+'/confirm',{
          method:'POST',
          headers:{
            Authorization:'Bearer '+secret,
            'Content-Type':'application/x-www-form-urlencoded',
            'Idempotency-Key':'da-p5g-confirm-v1:'+intentId,
          },
          body:form.toString(),
          signal:AbortSignal.timeout(12000),
        });
      if(!response.ok){
        throw Error('p5g_stripe_test_confirm_non_success_http_status');
      }
      const confirmed=await response.json();
      assert.equal(confirmed.id,intentId);
      assert.equal(confirmed.livemode,false);
      assert.equal(confirmed.amount,2190);
      assert.equal(confirmed.currency,'eur');
      assert.equal(confirmed.status,'succeeded');
      assert.equal(confirmed.amount_received,2190);
      remoteSucceeded=true;
      record(journal,'test_charge_succeeded');

      const independentlyRead=await reader.fetchIntent(intentId);
      assert.equal(independentlyRead.id,intentId);
      assert.equal(independentlyRead.livemode,false);
      assert.equal(independentlyRead.status,'succeeded');
      assert.equal(independentlyRead.amount_received,2190);
      assert.equal(independentlyRead.latest_charge?.paid,true);
      assert.equal(independentlyRead.latest_charge?.captured,true);
      assert.equal(independentlyRead.latest_charge?.refunded,false);
      assert.equal(independentlyRead.latest_charge?.amount_captured,2190);

      // Simulated delivery with locally signed HMAC over the ACTUAL remote
      // Stripe TEST intent. This is NOT an event delivered by Stripe itself.
      const digest=createHmac('sha256',syntheticWebhookKey)
        .update(String(seconds)+'.').update(raw).digest('hex');
      const header='t='+seconds+',v1='+digest;
      const first=await finalizer.consumeSignedWebhook(raw,header);
      assert.equal(first.ok,true);
      assert.equal(first.duplicate,false);
      assert.equal(first.financialState,'confirmed_fulfillment_pending');
      assert.equal(first.fulfillmentReleased,false);
      assert.equal(first.paymentIntentId,intentId);

      const second=await finalizer.consumeSignedWebhook(raw,header);
      assert.equal(second.ok,true);
      assert.equal(second.duplicate,true);
      assert.equal(second.fulfillmentReleased,false);

      const finance=await db.query(
        'SELECT s.state AS order_state, v.payment_intent_id,'+
        'v.captured_amount_cents,v.currency,v.payment_state,'+
        'o.delivery_status,o.last_stripe_event_id '+
        'FROM da_guest_checkout_sessions s '+
        'JOIN da_guest_verified_payments v USING(order_id) '+
        'JOIN da_guest_financial_outbox o USING(order_id) '+
        'WHERE s.order_id=$1',[guest.orderId]);
      assert.equal(finance.rowCount,1);
      assert.equal(finance.rows[0].order_state,'committed');
      assert.equal(finance.rows[0].payment_intent_id,intentId);
      assert.equal(Number(finance.rows[0].captured_amount_cents),2190);
      assert.equal(finance.rows[0].payment_state,'confirmed_fulfillment_pending');
      assert.equal(finance.rows[0].delivery_status,'pending_fulfillment_data');
      assert.equal(finance.rows[0].last_stripe_event_id,eventId);
      const receipts=await db.query(
        'SELECT count(*)::int AS n FROM da_guest_verified_payments');
      const outbox=await db.query(
        'SELECT count(*)::int AS n FROM da_guest_financial_outbox');
      assert.equal(receipts.rows[0].n,1);
      assert.equal(outbox.rows[0].n,1);
      financeCommitted=true;
      record(journal,'test_capture_finance_and_outbox_confirmed',
        {financialOutbox:'pending_fulfillment_data'});
      console.log('P5G_STRIPE_TEST_CAPTURE_REAL=PASS');
      console.log('P5G_STRIPE_TEST_PAYMENT_METHOD=pm_card_visa');
      console.log('P5G_HMAC_WEBHOOK_LAB_SIGNATURE=PASS');
      console.log('P5G_WEBHOOK_DELIVERY_FROM_STRIPE=NOT_TESTED');
      console.log('P5G_P3_FINANCIAL_TRANSACTION=PASS');
      console.log('P5G_DUPLICATE_WEBHOOK_FINANCIAL_IDEMPOTENCY=PASS');
      console.log('P5G_FINANCIAL_OUTBOX_COUNT=1');
      console.log('P5G_MERCHANT_COURIER_DISPATCH=NONE');
      console.log('P5G_REAL_MONEY_RECEIVED=0');
      console.log('P5G_SECRETS_PRINTED=NO');
    }finally{
      // A successful TEST capture cannot be cancelled as if unpaid.
      // Never claim a refund or absence of capture without actual evidence.
      if(journal && intentId && !remoteSucceeded){
        try{
          const remote=await provider.getIntent(intentId);
          if(remote.status==='succeeded'){
            remoteSucceeded=true;
            record(journal,'test_capture_needs_financial_review');
          }else if(remote.status==='requires_payment_method'){
            const cancelled=await provider.cancelIntent(intentId);
            if(cancelled.status==='canceled' &&
               (await provider.getIntent(intentId)).status==='canceled'){
              record(journal,'cancelled_without_capture');
            }
          }
        }catch{}
      }
      if(journal && remoteSucceeded && !financeCommitted){
        record(journal,'test_capture_needs_financial_review');
        console.log('P5G_REMOTE_TEST_CAPTURE=MANUAL_FINANCIAL_REVIEW');
      }
      await db.end();
    }
  });
