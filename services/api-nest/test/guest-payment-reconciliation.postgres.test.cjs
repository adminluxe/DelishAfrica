'use strict';
const assert=require('node:assert/strict');
const {test,before,beforeEach,after}=require('node:test');
const {readFileSync}=require('node:fs');
const {randomBytes}=require('node:crypto');
const path=require('node:path');
const ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{
 fileName:f,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}
}).outputText,f);
const {Pool}=require('/opt/delishafrica/monorepo/services/api-nest/.runtime-vendor/pg-runtime/node_modules/pg');
const {GuestCheckoutLedger}=require('../src/guest-checkout/guest-checkout-ledger.ts');
const {GuestPrivateFulfillmentVault}=require('../src/guest-checkout/guest-private-fulfillment-vault.ts');
const {GuestStripeFinancialFinalizer}=require('../src/guest-checkout/guest-stripe-financial-finalizer.ts');
const {GuestPaymentReconciliationMonitor}=require('../src/guest-checkout/guest-payment-reconciliation-monitor.ts');

const db=new Pool({host:'127.0.0.1',port:55441,user:'afripayadmin',database:'postgres',max:10});
const root=path.resolve(__dirname,'../../..');
const capKey=randomBytes(32),encKey=randomBytes(32);
const ledger=new GuestCheckoutLedger(db,capKey);
const vault=new GuestPrivateFulfillmentVault(db,capKey,new Map([['dek_p5e_test',encKey]]),'dek_p5e_test');
const quote={
 ok:true,version:1,partnerSlug:'thieyp',partnerName:'Thieyp Lab',currency:'eur',
 availabilityDate:'2026-10-09',availabilityDay:'vendredi',
 items:[{id:'sku_lab1',sku:'sku_lab1',name:'Food Lab',category:'Menu',
 quantity:1,unitAmount:2190,lineAmount:2190,scheduledDay:null}],
 subtotal:2190,deliveryFee:0,total:2190,minimumOrderAmount:0,
 quoteFingerprint:'ab'.repeat(32),quotedAt:'2026-10-09T15:00:00.000Z',
};
const contact={name:'Lab Client',phone:'+32470000000',
 address:'12 Rue du Laboratoire',city:'Ixelles',consent:true};
const delivery={verifiedByServer:true,eligible:true,serviceAreaCode:'be-lab-ixelles',
 locationProof:{placeId:'googleplace_test001',countryCode:'BE',postalCode:'1050',
 latitude:50.83,longitude:4.37,source:'google_places_new'}};
const previousEnv={
 NODE_ENV:process.env.NODE_ENV,
 DA_GUEST_STRIPE_TEST_ONLY:process.env.DA_GUEST_STRIPE_TEST_ONLY,
};
let counter=0;
class Provider {
 constructor() {
  this.mode='test';this.records=new Map();this.calls=[];
  this.fail=false;this.delay=0;this.onGet=null;
 }
 async getIntent(id) {
  this.calls.push(id);
  if(this.delay)await new Promise(r=>setTimeout(r,this.delay));
  if(this.onGet)await this.onGet(id);
  if(this.fail)throw Error('stripe_http_error_including_no_customer_data');
  if(!this.records.has(id))throw Error('stripe_not_found');
  return structuredClone(this.records.get(id));
 }
}
const provider=new Provider();
function claimsOf(guest) {
 return JSON.parse(Buffer.from(guest.token.split('.')[1],'base64url').toString('utf8'));
}
function stripeRecord(guest,id,status='requires_payment_method') {
 const claims=claimsOf(guest);
 return {
  id,clientSecret:id+'_secret_test_only',amount:2190,currency:'eur',
  status,livemode:false,
  metadata:{
   source:'delishafrica-guest-checkout',orderId:guest.orderId,
   clientIssuer:'urn:delishafrica:guest-checkout:v1',
   clientSubject:claims.subject,clientMutationId:guest.mutationId,
   quoteFingerprint:quote.quoteFingerprint,
  },
 };
}
async function prepare(kind,{id=true,status='requires_payment_method'}={}) {
 const g=await ledger.issue();
 await ledger.attachVerifiedQuote(g.token,{
  amountCents:2190,currency:'eur',fingerprint:quote.quoteFingerprint,
 });
 await vault.seal(g.token,quote,contact,delivery);
 const paymentId=id?'pi_p5e_lab_'+String(++counter).padStart(5,'0'):null;
 if(kind==='bound') await ledger.bindTrustedPaymentIntent(g.token,paymentId);
 if(paymentId)provider.records.set(paymentId,stripeRecord(g,paymentId,status));
 const state=kind==='bound'?'bound':kind==='review'?'review_required':'creating';
 const lease=state==='creating'?'a'.repeat(32):null;
 await db.query(
  `INSERT INTO da_guest_payment_intent_creation
    (order_id,idempotency_key,request_hash,state,lease_owner,lease_until,
     stripe_intent_id,reconciliation_reason,updated_at)
   VALUES($1,$2,$3,$4,$5,
     CASE WHEN $5::text IS NULL THEN NULL ELSE now()-interval '11 minutes' END,
     $6,$7,now()-interval '11 minutes')`,
  [g.orderId,'da-gc-pi-v1:'+g.orderId,'ab'.repeat(32),state,lease,
   paymentId,state==='review_required'?'cancel_failed':null],
 );
 return {guest:g,id:paymentId};
}
const monitor=(finance)=>new GuestPaymentReconciliationMonitor(db,provider,finance);
const alert=async(orderId)=>{
 const r=await db.query(
  'SELECT * FROM da_guest_payment_reconciliation_alerts WHERE order_id=$1',
  [orderId],
 );
 return r.rows[0];
};
before(async()=>{
 process.env.NODE_ENV='test';
 process.env.DA_GUEST_STRIPE_TEST_ONLY='1';
 assert.equal((await db.query('SELECT inet_server_port() AS p')).rows[0].p,55441);
 for (const f of [
  '20261009_guest_checkout_ledger.sql','20261009_guest_verified_payment.sql',
  '20261009_guest_fulfillment_vault.sql','20261009_guest_coverage_ops_approvals.sql',
  '20261009_guest_intent_creation_reservations.sql',
  '20261009_guest_intent_recovery.sql',
  '20261009_guest_payment_reconciliation_alerts.sql',
 ]) await db.query(readFileSync(path.join(root,'migrations',f),'utf8'));
});
beforeEach(async()=>{
 provider.records.clear();provider.calls=[];provider.fail=false;
 provider.delay=0;provider.onGet=null;
 await db.query('TRUNCATE da_guest_checkout_sessions CASCADE');
});
after(async()=>{
 await db.end();
 for(const [k,v] of Object.entries(previousEnv)) {
  if(v===undefined)delete process.env[k];else process.env[k]=v;
 }
});
test('P5E no candidates means zero remote Stripe reads or mutations',async()=>{
 const result=await monitor().scanOnce();
 assert.equal(result.inspected,0);
 assert.equal(provider.calls.length,0);
});

test('P5E missing provider identity opens one durable Ops alert without guessing an Intent',async()=>{
 const {guest}=await prepare('review',{id:false});
 const result=await monitor().scanOnce();
 assert.equal(result.operatorActionRequired,1);
 assert.equal(provider.calls.length,0);
 assert.equal((await alert(guest.orderId)).reason_code,'provider_identity_unknown');
 assert.equal((await alert(guest.orderId)).priority,'critical');
});

test('P5E provider outage schedules bounded retry, no new payment or personal data stored',async()=>{
 const {guest}=await prepare('review');
 provider.fail=true;
 const first=await monitor().scanOnce();
 assert.equal(first.retryScheduled,1);
 const a=await alert(guest.orderId);
 assert.equal(a.reason_code,'provider_read_unavailable');
 assert.equal(a.check_count,1);
 assert.equal(JSON.stringify(a).includes(contact.name),false);
 assert.equal(JSON.stringify(a).includes(contact.phone),false);
 assert.equal(JSON.stringify(a).includes('_secret_'),false);
 assert.equal((await monitor().scanOnce()).inspected,0);
 assert.equal(provider.calls.length,1);
});

test('P5E repeated provider outages escalate to operator review, without disclosing error body',async()=>{
 const {guest}=await prepare('review');
 provider.fail=true;
 for(let i=0;i<4;i++) {
  if(i)await db.query(
   "UPDATE da_guest_payment_reconciliation_alerts SET next_check_at=now()-interval '1 second' WHERE order_id=$1",
   [guest.orderId],
  );
  await monitor().scanOnce();
 }
 const a=await alert(guest.orderId);
 assert.equal(a.decision,'operator_action_required');
 assert.equal(a.reason_code,'provider_unavailable_escalated');
 assert.equal(a.priority,'critical');
 assert.equal(a.check_count,4);
});

test('P5E authority spoofed by Stripe metadata is never treated as paid',async()=>{
 const {guest,id}=await prepare('review');
 provider.records.get(id).metadata.orderId='DA-G-forged';
 const result=await monitor().scanOnce();
 assert.equal(result.operatorActionRequired,1);
 assert.equal((await alert(guest.orderId)).reason_code,'provider_authority_mismatch');
 assert.equal((await db.query('SELECT state FROM da_guest_checkout_sessions WHERE order_id=$1',[guest.orderId])).rows[0].state,'quoted');
});

test('P5E correct cancelled provider state resolves only an unbound private review',async()=>{
 const {guest}=await prepare('review',{status:'canceled'});
 const result=await monitor().scanOnce();
 assert.equal(result.verifiedCancelled,1);
 const a=await alert(guest.orderId);
 assert.equal(a.reason_code,'provider_cancel_confirmed');
 assert.equal(a.decision,'verified_cancelled');
 assert.equal((await monitor().scanOnce()).inspected,0);
});

test('P5E bound checkout still awaiting payment gets a retry, no financial release',async()=>{
 const {guest}=await prepare('bound',{status:'processing'});
 const result=await monitor().scanOnce();
 assert.equal(result.retryScheduled,1);
 assert.equal((await alert(guest.orderId)).reason_code,'awaiting_trusted_financial_finality');
 assert.equal((await db.query('SELECT count(*)::int AS n FROM da_guest_verified_payments WHERE order_id=$1',[guest.orderId])).rows[0].n,0);
});

test('P5E captured remote payment without finalizer is high-priority Ops alert',async()=>{
 const {guest}=await prepare('bound',{status:'succeeded'});
 const result=await monitor().scanOnce();
 assert.equal(result.operatorActionRequired,1);
 const a=await alert(guest.orderId);
 assert.equal(a.reason_code,'captured_requires_p3_finalizer');
 assert.equal(a.priority,'critical');
 assert.equal((await db.query('SELECT state FROM da_guest_checkout_sessions WHERE order_id=$1',[guest.orderId])).rows[0].state,'payment_pending');
});

test('P5E captured unbound payment is never auto-finalized or marked payable',async()=>{
 const {guest}=await prepare('review',{status:'succeeded'});
 let calls=0;
 const finalizer={async reconcileTrustedStripeIntent(){calls++;throw Error('not_expected')}};
 const result=await monitor(finalizer).scanOnce();
 assert.equal(result.operatorActionRequired,1);
 assert.equal(calls,0);
 assert.equal((await alert(guest.orderId)).reason_code,'captured_without_trusted_binding');
});

test('P5E real P3 finalizer re-verifies charge and atomically commits ONLY finance+outbox',async()=>{
 const {guest,id}=await prepare('bound',{status:'succeeded'});
 const claims=claimsOf(guest);
 let financialReads=0;
 const evidence={
  async fetchIntent(intentId){
   financialReads++;
   assert.equal(intentId,id);
   return {
    id,status:'succeeded',livemode:false,amount:2190,amount_received:2190,
    currency:'eur',metadata:stripeRecord(guest,id,'succeeded').metadata,
    latest_charge:{
     id:'ch_p5e_lab_'+String(++counter).padStart(5,'0'),
     paid:true,captured:true,refunded:false,disputed:false,status:'succeeded',
     amount:2190,amount_captured:2190,amount_refunded:0,currency:'eur',
    },
   };
  },
 };
 assert.ok(claims.subject);
 const financial=new GuestStripeFinancialFinalizer(db,evidence,'only-test-secret-not-public',false);
 const result=await monitor(financial).scanOnce();
 assert.equal(result.financiallyCommitted,1);
 assert.equal(financialReads,1);
 const record=await db.query(
  'SELECT s.state AS ledger_state,a.decision,o.delivery_status FROM da_guest_checkout_sessions s JOIN da_guest_payment_reconciliation_alerts a USING(order_id) JOIN da_guest_financial_outbox o USING(order_id) WHERE s.order_id=$1',
  [guest.orderId],
 );
 assert.equal(record.rows[0].ledger_state,'committed');
 assert.equal(record.rows[0].decision,'financially_committed');
 assert.equal(record.rows[0].delivery_status,'pending_fulfillment_data');
 assert.equal((await monitor(financial).scanOnce()).inspected,0);
 assert.equal(financialReads,1);
});

test('P5E financial finalizer failure remains critical, without order dispatch',async()=>{
 const {guest}=await prepare('bound',{status:'succeeded'});
 let called=0;
 const bad={
  async reconcileTrustedStripeIntent(){called++;throw Error('simulated_invalid_capture')}
 };
 assert.equal((await monitor(bad).scanOnce()).operatorActionRequired,1);
 assert.equal(called,1);
 assert.equal((await alert(guest.orderId)).reason_code,'p3_financial_reconcile_failed');
 assert.equal((await db.query('SELECT count(*)::int AS n FROM da_guest_financial_outbox WHERE order_id=$1',[guest.orderId])).rows[0].n,0);
});

test('P5E two workers cannot claim and query same row simultaneously',async()=>{
 const {guest}=await prepare('review');
 provider.delay=40;
 const [a,b]=await Promise.all([monitor().scanOnce(),monitor().scanOnce()]);
 assert.equal(a.inspected+b.inspected,1);
 assert.equal(provider.calls.length,1);
 assert.equal((await alert(guest.orderId)).check_count,1);
});

test('P5E expired crashed claim can be reclaimed and processed once',async()=>{
 const {guest}=await prepare('review');
 await db.query(
  `INSERT INTO da_guest_payment_reconciliation_alerts
   (order_id,decision,reason_code,priority,claim_owner,claim_until,next_check_at)
   VALUES($1,'investigating','awaiting_evidence','high',$2,
          now()-interval '2 minutes',now()-interval '1 minute')`,
  [guest.orderId,'d'.repeat(32)],
 );
 const result=await monitor().scanOnce();
 assert.equal(result.inspected,1);
 const a=await alert(guest.orderId);
 assert.equal(a.claim_owner,null);
 assert.equal(a.check_count,1);
});

test('P5E provider read changing checkout snapshot never publishes stale cancellation evidence',async()=>{
 const {guest}=await prepare('review',{status:'canceled'});
 provider.onGet=async()=>{
  await db.query(
   "UPDATE da_guest_payment_intent_creation SET state='cancelled',reconciliation_reason='provider_cancel_confirmed' WHERE order_id=$1",
   [guest.orderId],
  );
  provider.onGet=null;
 };
 const result=await monitor().scanOnce();
 assert.equal(result.staleOrSuperseded,1);
 assert.equal((await alert(guest.orderId)).reason_code,'stale_source_snapshot');
 assert.equal((await alert(guest.orderId)).decision,'retry_scheduled');
});

test('P5E test flag or production context denies any scan before querying the provider',async()=>{
 const {guest}=await prepare('review');
 const beforeCalls=provider.calls.length;
 process.env.NODE_ENV='production';
 try {await assert.rejects(monitor().scanOnce(),/monitor_disabled/);}
 finally{process.env.NODE_ENV='test'}
 process.env.DA_GUEST_STRIPE_TEST_ONLY='0';
 try {await assert.rejects(monitor().scanOnce(),/monitor_disabled/);}
 finally{process.env.DA_GUEST_STRIPE_TEST_ONLY='1'}
 assert.equal(provider.calls.length,beforeCalls);
 assert.equal((await alert(guest.orderId)),undefined);
});

test('P5E input batch caps protect against accidental massive scanner runs',async()=>{
 await assert.rejects(monitor().scanOnce(0),/batch_invalid/);
 await assert.rejects(monitor().scanOnce(21),/batch_invalid/);
 assert.equal(provider.calls.length,0);
});
test('P5E resumes Ops alert after finalizer commit without duplicate financial capture',async()=>{
 const {guest,id}=await prepare('bound',{status:'succeeded'});
 let reads=0;
 const financial=new GuestStripeFinancialFinalizer(db,{
  async fetchIntent(intentId) {
   reads++;
   assert.equal(intentId,id);
   return {...stripeRecord(guest,id,'succeeded'),amount_received:2190,
    latest_charge:{id:'ch_p5e_resume_'+String(++counter).padStart(5,'0'),
    status:'succeeded',paid:true,captured:true,refunded:false,disputed:false,
    amount:2190,amount_captured:2190,amount_refunded:0,currency:'eur'}};
  }
 },'only-test-secret-not-public',false);
 await financial.reconcileTrustedStripeIntent(id);
 await db.query(
  "INSERT INTO da_guest_payment_reconciliation_alerts (order_id,decision,reason_code,priority,claim_owner,claim_until,next_check_at) VALUES($1,'investigating','awaiting_evidence','normal',$2,now()-interval '2 minutes',now()-interval '1 minute')",
  [guest.orderId,'b'.repeat(32)],
 );
 assert.equal((await monitor(financial).scanOnce()).financiallyCommitted,1);
 assert.equal(reads,1);
 assert.equal((await alert(guest.orderId)).decision,'financially_committed');
});
test('P5E forged committed ledger without P3 financial record stays under Ops review',async()=>{
 const {guest}=await prepare('bound',{status:'succeeded'});
 await db.query(
  "UPDATE da_guest_checkout_sessions SET state='committed',paid_at=now(),committed_at=now() WHERE order_id=$1",
  [guest.orderId],
 );
 await db.query(
  "INSERT INTO da_guest_payment_reconciliation_alerts (order_id,decision,reason_code,priority,claim_owner,claim_until,next_check_at) VALUES($1,'investigating','awaiting_evidence','normal',$2,now()-interval '2 minutes',now()-interval '1 minute')",
  [guest.orderId,'b'.repeat(32)],
 );
 assert.equal((await monitor().scanOnce()).operatorActionRequired,1);
 assert.equal((await alert(guest.orderId)).reason_code,'committed_financial_chain_incomplete');
});


test('P5E committed payment without outbox is not declared fully reconciled',async()=>{
 const {guest,id}=await prepare('bound',{status:'succeeded'});
 await db.query(
  `INSERT INTO da_guest_verified_payments
   (order_id,payment_intent_id,captured_amount_cents,currency,
    quote_fingerprint,stripe_charge_id)
   VALUES($1,$2,2190,'eur',$3,$4)`,
  [guest.orderId,id,quote.quoteFingerprint,
   'ch_p5e_corrupted_'+String(++counter).padStart(5,'0')],
 );
 await db.query(
  "UPDATE da_guest_checkout_sessions SET state='committed',paid_at=now(),committed_at=now() WHERE order_id=$1",
  [guest.orderId],
 );
 await db.query(
  "INSERT INTO da_guest_payment_reconciliation_alerts (order_id,decision,reason_code,priority,claim_owner,claim_until,next_check_at) VALUES($1,'investigating','awaiting_evidence','normal',$2,now()-interval '2 minutes',now()-interval '1 minute')",
  [guest.orderId,'b'.repeat(32)],
 );
 assert.equal((await monitor().scanOnce()).operatorActionRequired,1);
 assert.equal((await alert(guest.orderId)).reason_code,'committed_financial_chain_incomplete');
});
