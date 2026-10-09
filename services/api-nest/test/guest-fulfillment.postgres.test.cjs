'use strict';
const assert=require('node:assert/strict');
const {test,before,after}=require('node:test');
const {readFileSync}=require('node:fs');
const {randomBytes,createHmac}=require('node:crypto');
const path=require('node:path');
const ts=require('typescript');
require.extensions['.ts']=(module,file)=>{
 const output=ts.transpileModule(readFileSync(file,'utf8'),{
  fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}
 }).outputText;
 module._compile(output,file);
};
const {Pool}=require('/opt/delishafrica/monorepo/services/api-nest/.runtime-vendor/pg-runtime/node_modules/pg');
const {GuestCheckoutLedger}=require('../src/guest-checkout/guest-checkout-ledger.ts');
const {GuestPrivateFulfillmentVault}=require('../src/guest-checkout/guest-private-fulfillment-vault.ts');
const {GuestPaidFulfillmentPreparer}=require('../src/guest-checkout/guest-paid-fulfillment-preparer.ts');
const {GuestStripeFinancialFinalizer}=require('../src/guest-checkout/guest-stripe-financial-finalizer.ts');
const root=path.resolve(__dirname,'../../..');
const pool=new Pool({host:'127.0.0.1',port:55440,user:'afripayadmin',database:'postgres',max:10});
const capKey=randomBytes(32),encKey=randomBytes(32);
const keyRing=new Map([['dek_lab2026',encKey]]);
const vault=new GuestPrivateFulfillmentVault(pool,capKey,keyRing,'dek_lab2026');
const ledger=new GuestCheckoutLedger(pool,capKey);
const fp='abcdef0123456789'.repeat(4);
const quote={
 ok:true,version:1,partnerSlug:'thieyp',partnerName:'Thieyp - laboratoire',
 currency:'eur',availabilityDate:'2026-10-09',availabilityDay:'vendredi',
 items:[{id:'sku_001',sku:'sku_001',name:'Plat de laboratoire',category:'Plat',
 quantity:2,unitAmount:950,lineAmount:1900,scheduledDay:null}],
 subtotal:1900,deliveryFee:290,total:2190,minimumOrderAmount:0,
 quoteFingerprint:fp,quotedAt:'2026-10-09T14:00:00.000Z',
};
const contact={
 name:'Test Client',phone:'+32470000000',email:'tester@example.invalid',
 address:'23 Rue du Laboratoire',city:'Bruxelles',
 instructions:'Interphone laboratoire',allergenFlags:['arachides'],
 dietaryTags:['sans gluten'],foodSafetyNote:'Sensibilite laboratoire',consent:true,
};
const delivery={verifiedByServer:true,eligible:true,serviceAreaCode:'brussels-center'};
const stripeSecret='guest-signed-event-lab-only';
const stripeSnapshots=new Map();
let seq=0;
const stripeReader={async fetchIntent(id){
 const value=stripeSnapshots.get(id);
 if(!value)throw Error('mock_payment_absent');
 return structuredClone(value);
}};
const finalizer=()=>new GuestStripeFinancialFinalizer(pool,stripeReader,stripeSecret,false);
const preparer=(db=pool)=>new GuestPaidFulfillmentPreparer(db,vault);

before(async()=>{
 const probe=await pool.query('SELECT inet_server_port() AS p');
 assert.equal(probe.rows[0].p,55440);
 for(const name of ['20261009_guest_checkout_ledger.sql',
                     '20261009_guest_verified_payment.sql',
                     '20261009_guest_fulfillment_vault.sql']){
  await pool.query(readFileSync(path.join(root,'migrations',name),'utf8'));
 }
 // Isolated PostgreSQL lab; never use a production database.
 await pool.query('TRUNCATE da_guest_checkout_sessions CASCADE');
});
after(async()=>{await pool.end()});

async function sessionWithQuote(){
 const guest=await ledger.issue();
 await ledger.attachVerifiedQuote(guest.token,{
  amountCents:quote.total,currency:'eur',fingerprint:quote.quoteFingerprint,
 });
 return guest;
}
async function preparePendingPayment(guest){
 const id='pi_paymentlabp4'+(++seq);
 await ledger.bindTrustedPaymentIntent(guest.token,id);
 const claims=JSON.parse(Buffer.from(guest.token.split('.')[1],'base64url').toString('utf8'));
 stripeSnapshots.set(id,{
  id,status:'succeeded',livemode:false,amount:2190,amount_received:2190,currency:'eur',
  metadata:{
   orderId:guest.orderId,clientMutationId:guest.mutationId,
   quoteFingerprint:fp,clientSubject:claims.subject,
   clientIssuer:'urn:delishafrica:guest-checkout:v1',
   source:'delishafrica-guest-checkout',
  },
  latest_charge:{
   id:'ch_p4lab'+seq,status:'succeeded',paid:true,captured:true,
   refunded:false,disputed:false,amount:2190,amount_captured:2190,
   amount_refunded:0,currency:'eur',
  },
 });
 return id;
}
function signedStripeEvent(id){
 const raw=Buffer.from(JSON.stringify({
  id:'evt_p4lab'+(++seq),type:'payment_intent.succeeded',
  data:{object:{id}},
 }));
 const t=Math.floor(Date.now()/1000);
 const signature=createHmac('sha256',stripeSecret).update(t+'.').update(raw).digest('hex');
 return {raw,sig:'t='+t+',v1='+signature};
}
test('encrypts real address and food details without plaintext database columns',async()=>{
 const guest=await sessionWithQuote();
 const stored=await vault.seal(guest.token,quote,contact,delivery);
 assert.equal(stored.replay,false);
 const retry=await vault.seal(guest.token,quote,contact,delivery);
 assert.equal(retry.replay,true);
 const rows=await pool.query('SELECT * FROM da_guest_fulfillment_vault WHERE order_id=$1',[guest.orderId]);
 assert.equal(rows.rowCount,1);
 const raw=JSON.stringify(rows.rows[0]);
 for(const sensitive of [contact.name,contact.address,contact.phone,contact.foodSafetyNote]){
  assert.equal(raw.includes(sensitive),false);
 }
 assert.equal(rows.rows[0].iv.length,12);
 assert.equal(rows.rows[0].auth_tag.length,16);
 assert.equal(rows.rows[0].payload_mac.length,32);
 await assert.rejects(vault.seal(guest.token,quote,{...contact,address:'Autre adresse 456'},delivery),
  /snapshot_conflict/);
});
test('refuses missing consent, false delivery validation and altered canonical totals',async()=>{
 const guest=await sessionWithQuote();
 await assert.rejects(vault.seal(guest.token,quote,{...contact,consent:false},delivery),
  /consent_required/);
 await assert.rejects(vault.seal(guest.token,quote,contact,{...delivery,eligible:false}),
  /delivery_not_verified/);
 await assert.rejects(vault.seal(guest.token,{...quote,total:1},contact,delivery),
  /quote_total_invalid/);
 const rows=await pool.query('SELECT count(*)::int AS n FROM da_guest_fulfillment_vault WHERE order_id=$1',[guest.orderId]);
 assert.equal(rows.rows[0].n,0);
});
test('no fulfillment is materialized without financially confirmed capture',async()=>{
 const guest=await sessionWithQuote();
 await vault.seal(guest.token,quote,contact,delivery);
 const intent=await preparePendingPayment(guest);
 await assert.rejects(preparer().preparePaidOrder(guest.orderId));
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM da_guest_fulfillment_prepared WHERE order_id=$1',[guest.orderId])).rows[0].n,0);
 // P3 financial finalization alone is permitted, but no merchant publication.
 const e=signedStripeEvent(intent);
 const r=await finalizer().consumeSignedWebhook(e.raw,e.sig);
 assert.equal(r.fulfillmentReleased,false);
 const prepared=await preparer().preparePaidOrder(guest.orderId);
 assert.equal(prepared.prepared,true);
 assert.equal(prepared.replay,false);
 assert.equal(prepared.broadcastToMerchant,false);
 assert.equal(prepared.courierDispatched,false);
 assert.equal((await pool.query('SELECT delivery_status FROM da_guest_financial_outbox WHERE order_id=$1',[guest.orderId])).rows[0].delivery_status,'ready');
});
test('eight simultaneous internal preparations produce only one private order',async()=>{
 const guest=await sessionWithQuote();
 await vault.seal(guest.token,quote,contact,delivery);
 const intent=await preparePendingPayment(guest);
 const e=signedStripeEvent(intent);
 await finalizer().consumeSignedWebhook(e.raw,e.sig);
 const results=await Promise.all(Array.from({length:8},()=>preparer().preparePaidOrder(guest.orderId)));
 assert.equal(results.filter(r=>r.replay===false).length,1);
 assert.equal(results.filter(r=>r.replay===true).length,7);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM da_guest_fulfillment_prepared WHERE order_id=$1',[guest.orderId])).rows[0].n,1);
});
test('tampered ciphertext fails closed and preserves pending financial outbox',async()=>{
 const guest=await sessionWithQuote();
 await vault.seal(guest.token,quote,contact,delivery);
 const intent=await preparePendingPayment(guest);
 const e=signedStripeEvent(intent);
 await finalizer().consumeSignedWebhook(e.raw,e.sig);
 await pool.query('UPDATE da_guest_fulfillment_vault SET ciphertext=set_byte(ciphertext,0,(get_byte(ciphertext,0)+1)%256) WHERE order_id=$1',[guest.orderId]);
 await assert.rejects(preparer().preparePaidOrder(guest.orderId),
  /decryption_failed|integrity_failed/);
 assert.equal((await pool.query('SELECT delivery_status FROM da_guest_financial_outbox WHERE order_id=$1',[guest.orderId])).rows[0].delivery_status,'pending_fulfillment_data');
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM da_guest_fulfillment_prepared WHERE order_id=$1',[guest.orderId])).rows[0].n,0);
});
test('error during outbox release rolls back the prepared order; retry succeeds',async()=>{
 const guest=await sessionWithQuote();
 await vault.seal(guest.token,quote,contact,delivery);
 const intent=await preparePendingPayment(guest);
 const e=signedStripeEvent(intent);
 await finalizer().consumeSignedWebhook(e.raw,e.sig);
 let failure=true;
 const faulty={async connect(){
  const client=await pool.connect();
  return {release:()=>client.release(),async query(sql,args){
   if(failure && sql.includes('UPDATE da_guest_financial_outbox')){
    failure=false;throw Error('outbox_lab_fault');
   }
   return client.query(sql,args);
  }};
 }};
 await assert.rejects(preparer(faulty).preparePaidOrder(guest.orderId),/outbox_lab_fault/);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM da_guest_fulfillment_prepared WHERE order_id=$1',[guest.orderId])).rows[0].n,0);
 assert.equal((await preparer().preparePaidOrder(guest.orderId)).replay,false);
});
test('expired mobile capability does not prevent internally preparing a captured payment',async()=>{
 const guest=await sessionWithQuote();
 await vault.seal(guest.token,quote,contact,delivery);
 const intent=await preparePendingPayment(guest);
 const e=signedStripeEvent(intent);
 await finalizer().consumeSignedWebhook(e.raw,e.sig);
 await pool.query("UPDATE da_guest_checkout_sessions SET created_at=now()-interval '5 hours', expires_at=now()-interval '1 hour' WHERE order_id=$1",[guest.orderId]);
 const prepared=await preparer().preparePaidOrder(guest.orderId);
 assert.equal(prepared.prepared,true);
});
test('different capability cannot seal snapshot belonging to another guest',async()=>{
 const guestA=await sessionWithQuote(), guestB=await sessionWithQuote();
 await vault.seal(guestA.token,quote,contact,delivery);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM da_guest_fulfillment_vault WHERE order_id=$1',[guestB.orderId])).rows[0].n,0);
 await assert.rejects(vault.seal(guestA.token,{...quote,quoteFingerprint:'bb'.repeat(32)},contact,delivery));
 const rows=await pool.query('SELECT count(*)::int AS n FROM da_guest_fulfillment_vault WHERE order_id=$1',[guestA.orderId]);
 assert.equal(rows.rows[0].n,1);
});
test('database refuses payment initiation when private fulfillment has not been sealed',async()=>{
 const guest=await sessionWithQuote();
 await assert.rejects(
  ledger.bindTrustedPaymentIntent(guest.token,'pi_payment_without_seal_1234'),
  /guest_payment_fulfillment_not_sealed/,
 );
 const row=await pool.query('SELECT state FROM da_guest_checkout_sessions WHERE order_id=$1',[guest.orderId]);
 assert.equal(row.rows[0].state,'quoted');
});
