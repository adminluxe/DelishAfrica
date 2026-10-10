'use strict';
// P5-F: REAL Stripe TEST provider + REAL isolated PostgreSQL guest checkout.
// One-shot ONLY. No cards, no payment confirmation, no live keys, no public API.
// Journal is fsynced before external CREATE; uncertain outcomes require review.
const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
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
const {GuestMerchantCoverageStrict,coverageApprovalDigest}=
  require('../src/guest-checkout/guest-merchant-coverage-strict.ts');
const {PostgresGuestCoverageOpsApprovals}=
  require('../src/guest-checkout/guest-coverage-ops-approval-pg.ts');

if(process.env.NODE_ENV!=='test' ||
   process.env.DA_GUEST_STRIPE_TEST_ONLY!=='1' ||
   process.env.DA_P5F_PROVIDER_REAL_EXPLICIT!=='YES'){
  throw Error('p5f_explicit_test_authorization_required');
}
const secret=process.env.DA_P5F_STRIPE_SECRET;
if(typeof secret!=='string' ||
   !/^sk_test_[A-Za-z0-9]+$/.test(secret)){
  throw Error('p5f_test_secret_required');
}
const repo=path.resolve(__dirname,'../../..');
const pgPort=55442;
const db=new Pool({
  host:'127.0.0.1',port:pgPort,user:'afripayadmin',
  database:'postgres',max:7,connectionTimeoutMillis:5000,
});
const key=randomBytes(32),dataKey=randomBytes(32);
const ledger=new GuestCheckoutLedger(db,key);
const vault=new GuestPrivateFulfillmentVault(
  db,key,new Map([['dek_p5f_lab',dataKey]]),'dek_p5f_lab',
);
const provider=new GuestStripeHttpTestTransport(secret,11000);
const journalFolder='/home/afripayadmin/guest-checkout-evidence-20261010/p5f-provider-intent-journal';
const quote={
  ok:true,version:1,partnerSlug:'thieyp',partnerName:'Thieyp P5F Lab',
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
  name:'Thieyp P5F Lab',status:'active',
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
    'p5f_existing_journal_requires_operator_review');
  const file=path.join(journalFolder,'p5f-real-stripe-intent.json');
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
    ['thieyp',digest,'ops_p5f_lab_authorized']);
}

test('P5-F actual guest reservation + Stripe TEST + recovery + cancel + Ops alert',
  {timeout:90000},async()=>{
    let journal=null,intentId=null,cancelVerified=false;
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
        locationProof:{placeId:'googleplace_test001',
          countryCode:'BE',postalCode:'1050',latitude:50.83,
          longitude:4.37,source:'google_places_new'},
      });
      const authorized=await coverage.verifyCoverage({
        partnerSlug:'thieyp',countryCode:'BE',postalCode:'1050',
        latitude:50.83,longitude:4.37,placeId:'googleplace_test001'});
      assert.equal(authorized.allowed,true);
      journal=journalStart(guest);
      const service=new GuestStripeIntentReservation(
        db,provider,key,vault,coverage);
      const created=await service.start(guest.token);
      intentId=created.intentId;
      record(journal,'created',{intentId});
      assert.equal(created.state,'created');
      assert.equal(created.amount,2190);
      assert.ok(created.clientSecret.startsWith(intentId+'_secret_'));
      const pg=await db.query(
        'SELECT s.state AS session_state,r.state AS reservation_state,'+
        's.payment_intent_id,r.stripe_intent_id '+
        'FROM da_guest_checkout_sessions s '+
        'JOIN da_guest_payment_intent_creation r USING(order_id) '+
        'WHERE s.order_id=$1',[guest.orderId]);
      assert.equal(pg.rows[0].session_state,'payment_pending');
      assert.equal(pg.rows[0].reservation_state,'bound');
      assert.equal(pg.rows[0].payment_intent_id,intentId);
      assert.equal(pg.rows[0].stripe_intent_id,intentId);

      const restored=await service.start(guest.token);
      assert.equal(restored.state,'restored');
      assert.equal(restored.intentId,intentId);
      const fetched=await provider.getIntent(intentId);
      assert.equal(fetched.status,'requires_payment_method');
      assert.equal(fetched.amount,2190);
      assert.equal(fetched.livemode,false);
      assert.equal(fetched.metadata.orderId,guest.orderId);
      record(journal,'cancel_requested');
      const cancelled=await provider.cancelIntent(intentId);
      assert.equal(cancelled.status,'canceled');
      const checked=await provider.getIntent(intentId);
      assert.equal(checked.status,'canceled');
      cancelVerified=true;
      record(journal,'cancelled',{providerFinalStatus:'canceled'});

      await assert.rejects(service.start(guest.token),
        /already_progressed_reconcile/);
      await db.query(
        "UPDATE da_guest_payment_intent_creation SET updated_at="+
        "now()-interval '12 minutes' WHERE order_id=$1",[guest.orderId]);
      const monitor=new GuestPaymentReconciliationMonitor(db,provider);
      const report=await monitor.scanOnce();
      assert.equal(report.operatorActionRequired,1);
      const ops=await db.query(
        'SELECT decision,reason_code,provider_status '+
        'FROM da_guest_payment_reconciliation_alerts WHERE order_id=$1',
        [guest.orderId]);
      assert.equal(ops.rows[0].decision,'operator_action_required');
      assert.equal(ops.rows[0].reason_code,'cancellation_binding_conflict');
      assert.equal(ops.rows[0].provider_status,'canceled');
      for(const table of ['da_guest_verified_payments','da_guest_financial_outbox']){
        const count=await db.query(
          'SELECT count(*)::int AS n FROM '+table+' WHERE order_id=$1',
          [guest.orderId]);
        assert.equal(count.rows[0].n,0);
      }
      console.log('P5F_GUEST_STRIPE_TEST_PROVIDER=PASS');
      console.log('P5F_SESSION_QUOTE_VAULT_OPS=PASS');
      console.log('P5F_STRIPE_CREATE_AND_IDEMPOTENT_RESTORE=PASS');
      console.log('P5F_STRIPE_CANCEL_AND_GET=PASS');
      console.log('P5F_OPS_RECONCILIATION_ALERT=PASS');
      console.log('P5F_FINANCE_OUTBOX_EMPTY=PASS');
      console.log('P5F_FUNDS_CAPTURED=0');
      console.log('P5F_SECRET_VALUES_PRINTED=NO');
    }finally{
      if(journal && intentId && !cancelVerified){
        try{
          const remote=await provider.getIntent(intentId);
          if(remote.status==='canceled'){
            cancelVerified=true;
            record(journal,'cancelled',{providerFinalStatus:'canceled'});
          }else if(remote.status==='requires_payment_method'){
            const canceled=await provider.cancelIntent(intentId);
            if(canceled.status==='canceled' &&
               (await provider.getIntent(intentId)).status==='canceled'){
              cancelVerified=true;
              record(journal,'cancelled',{providerFinalStatus:'canceled'});
            }
          }
        }catch{} // Fail-closed: leave journal for operator review.
      }
      if(journal && !cancelVerified){
        record(journal,'manual_reconciliation_required');
        console.log('P5F_PROVIDER_INTENT=MANUAL_RECONCILIATION_REQUIRED');
      }
      await db.end();
    }
  });
