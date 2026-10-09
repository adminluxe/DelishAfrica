'use strict';
const assert=require('node:assert/strict');
const {test,before,after}=require('node:test');
const {readFileSync}=require('node:fs');
const {randomBytes,createHmac}=require('node:crypto');
const path=require('node:path');
const ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{
 fileName:f,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}
}).outputText,f);
const {Pool}=require('/opt/delishafrica/monorepo/services/api-nest/.runtime-vendor/pg-runtime/node_modules/pg');
const {GuestCheckoutLedger}=require('../src/guest-checkout/guest-checkout-ledger.ts');
const {GuestPrivateFulfillmentVault}=require('../src/guest-checkout/guest-private-fulfillment-vault.ts');
const {GuestStripeFinancialFinalizer}=require('../src/guest-checkout/guest-stripe-financial-finalizer.ts');
const root=path.resolve(__dirname,'../../..');
const db=new Pool({host:'127.0.0.1',port:55440,user:'afripayadmin',database:'postgres',max:6});
const secret='development-webhook-secret-not-for-live';
const key=randomBytes(32),encKey=randomBytes(32),fp='ab'.repeat(32);
const vault=new GuestPrivateFulfillmentVault(db,key,new Map([['dek_labp3',encKey]]),'dek_labp3');
const sealedQuote={
 ok:true,version:1,partnerSlug:'thieyp',partnerName:'Thieyp Lab',
 currency:'eur',availabilityDate:'2026-10-09',availabilityDay:'vendredi',
 items:[{id:'sku_001',sku:'sku_001',name:'Plat Lab',category:'Plat',
 quantity:2,unitAmount:950,lineAmount:1900,scheduledDay:null}],
 subtotal:1900,deliveryFee:290,total:2190,minimumOrderAmount:0,
 quoteFingerprint:fp,quotedAt:'2026-10-09T14:00:00.000Z'
};
const contact={name:'Lab Customer',phone:'+32470000000',
 address:'23 Rue des Tests',city:'Bruxelles',consent:true};
const area={verifiedByServer:true,eligible:true,serviceAreaCode:'brussels-center'};
const snapshots=new Map();let seq=0;
const reader={async fetchIntent(id){const p=snapshots.get(id);if(!p)throw Error('mock_missing');return structuredClone(p)}};
const finalizer=(pool=db)=>new GuestStripeFinancialFinalizer(pool,reader,secret,false);
const event=(id,type='payment_intent.succeeded')=>{
 const raw=Buffer.from(JSON.stringify({id:'evt_guest_lab_'+(++seq),type,data:{object:{id}}}));
 const t=Math.floor(Date.now()/1000);
 const mac=createHmac('sha256',secret).update(t+'.').update(raw).digest('hex');
 return {raw,sig:'t='+t+',v1='+mac};
};
async function pending(){
 const ledger=new GuestCheckoutLedger(db,key),g=await ledger.issue();
 await ledger.attachVerifiedQuote(g.token,{amountCents:2190,currency:'eur',fingerprint:fp});
 await vault.seal(g.token,sealedQuote,contact,area);
 const id='pi_guest_lab_'+(++seq);
 await ledger.bindTrustedPaymentIntent(g.token,id);
 const claims=JSON.parse(Buffer.from(g.token.split('.')[1],'base64url').toString());
 snapshots.set(id,{id,status:'succeeded',livemode:false,amount:2190,amount_received:2190,currency:'eur',
 metadata:{orderId:g.orderId,clientMutationId:g.mutationId,quoteFingerprint:fp,
 clientSubject:claims.subject,clientIssuer:'urn:delishafrica:guest-checkout:v1',
 source:'delishafrica-guest-checkout'},
 latest_charge:{id:'ch_guest_lab_'+seq,status:'succeeded',paid:true,captured:true,
 refunded:false,disputed:false,amount:2190,amount_captured:2190,amount_refunded:0,currency:'eur'}});
 return {g,id};
}
before(async()=>{
 const r=await db.query('SELECT inet_server_port() AS port');
 assert.equal(r.rows[0].port,55440);
 for(const file of ['20261009_guest_checkout_ledger.sql','20261009_guest_verified_payment.sql','20261009_guest_fulfillment_vault.sql'])
  await db.query(readFileSync(path.join(root,'migrations',file),'utf8'));
 await db.query('TRUNCATE da_guest_financial_outbox,da_guest_verified_payments,da_guest_checkout_sessions CASCADE');
});
after(async()=>{await db.end()});
test('signed webhook commits exactly one financial record, never dispatch',async()=>{
 const {g,id}=await pending(),e=event(id),f=finalizer();
 const first=await f.consumeSignedWebhook(e.raw,e.sig);
 assert.equal(first.duplicate,false);
 assert.equal(first.fulfillmentReleased,false);
 assert.equal(first.financialState,'confirmed_fulfillment_pending');
 assert.equal((await f.consumeSignedWebhook(e.raw,e.sig)).duplicate,true);
 const records=await db.query('SELECT s.state,o.delivery_status,count(*) OVER () AS n FROM da_guest_checkout_sessions s JOIN da_guest_financial_outbox o USING(order_id) WHERE s.order_id=$1',[g.orderId]);
 assert.equal(records.rowCount,1);
 assert.equal(records.rows[0].state,'committed');
 assert.equal(records.rows[0].delivery_status,'pending_fulfillment_data');
});
test('eight concurrent webhook retries serialize without duplicate charge commit',async()=>{
 const {g,id}=await pending(),e=event(id),f=finalizer();
 const result=await Promise.all(Array.from({length:8},()=>f.consumeSignedWebhook(e.raw,e.sig)));
 assert.equal(result.filter(x=>x.duplicate===false).length,1);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM da_guest_verified_payments WHERE order_id=$1',[g.orderId])).rows[0].n,1);
});
test('invalid signature, spoofed metadata and refunds fail without DB mutation',async()=>{
 const {g,id}=await pending(),e=event(id),f=finalizer();
 await assert.rejects(f.consumeSignedWebhook(e.raw,'t=1,v1='+('0'.repeat(64))));
 const snap=snapshots.get(id),original=snap.metadata.orderId;
 snap.metadata.orderId='DA-G-attacker';
 await assert.rejects(f.consumeSignedWebhook(e.raw,e.sig),/authority_or_finality_mismatch/);
 snap.metadata.orderId=original;
 snap.latest_charge.refunded=true;
 await assert.rejects(f.consumeSignedWebhook(e.raw,e.sig),/authority_or_finality_mismatch/);
 snap.latest_charge.refunded=false;
 snap.latest_charge.amount_captured=2000;
 await assert.rejects(f.consumeSignedWebhook(e.raw,e.sig),/authority_or_finality_mismatch/);
 assert.equal((await db.query('SELECT state FROM da_guest_checkout_sessions WHERE order_id=$1',[g.orderId])).rows[0].state,'payment_pending');
});
test('transaction rolls back if outbox write fails and webhook retry recovers',async()=>{
 const {g,id}=await pending(),e=event(id);
 let fail=true;
 const faulty={async connect(){
  const c=await db.connect();
  return {release:()=>c.release(),async query(sql,args){
   if(fail && sql.includes('INSERT INTO da_guest_financial_outbox')){fail=false;throw Error('lab_disk_fault')}
   return c.query(sql,args);
  }};
 }};
 await assert.rejects(finalizer(faulty).consumeSignedWebhook(e.raw,e.sig),/lab_disk_fault/);
 assert.equal((await db.query('SELECT state FROM da_guest_checkout_sessions WHERE order_id=$1',[g.orderId])).rows[0].state,'payment_pending');
 assert.equal((await db.query('SELECT count(*)::int AS n FROM da_guest_verified_payments WHERE order_id=$1',[g.orderId])).rows[0].n,0);
 assert.equal((await finalizer().consumeSignedWebhook(e.raw,e.sig)).duplicate,false);
});
test('server reconciles captured payment even after mobile session expiration',async()=>{
 const {g,id}=await pending();
 await db.query("UPDATE da_guest_checkout_sessions SET created_at=now()-interval '5 hours', expires_at=now()-interval '1 hour' WHERE order_id=$1",[g.orderId]);
 const resolved=await finalizer().reconcileTrustedStripeIntent(id);
 assert.equal(resolved.ok,true);
 assert.equal(resolved.fulfillmentReleased,false);
});
test('reject unknown intent and ignore a signed irrelevant event',async()=>{
 await assert.rejects(finalizer().reconcileTrustedStripeIntent('not_stripe_id'));
 const other=event('pi_unrelated','customer.created');
 assert.equal((await finalizer().consumeSignedWebhook(other.raw,other.sig)).ignored,true);
});
