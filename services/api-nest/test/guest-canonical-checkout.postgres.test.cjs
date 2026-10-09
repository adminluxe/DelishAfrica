'use strict';
const assert=require('node:assert/strict');
const {test,before,after}=require('node:test');
const {randomBytes}=require('node:crypto');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(readFileSync(file,'utf8'),{
 fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}
}).outputText,file);
const {Pool}=require('/opt/delishafrica/monorepo/services/api-nest/.runtime-vendor/pg-runtime/node_modules/pg');
const {GuestCheckoutLedger}=require('../src/guest-checkout/guest-checkout-ledger.ts');
const {GuestPrivateFulfillmentVault}=require('../src/guest-checkout/guest-private-fulfillment-vault.ts');
const {GuestCanonicalCheckoutStager}=require('../src/guest-checkout/guest-canonical-checkout-stager.ts');
const db=new Pool({host:'127.0.0.1',port:55441,database:'postgres',user:'afripayadmin'});
const capKey=randomBytes(32),encKey=randomBytes(32);
const ledger=new GuestCheckoutLedger(db,capKey);
const vault=new GuestPrivateFulfillmentVault(db,capKey,new Map([['dek_p5lab',encKey]]),'dek_p5lab');
const quote={
 ok:true,version:1,partnerSlug:'thieyp',partnerName:'Thieyp laboratoire',
 currency:'eur',availabilityDate:'2026-10-09',availabilityDay:'vendredi',
 items:[{id:'rice001',sku:'rice001',name:'Riz Test',category:'Menu',
 quantity:1,unitAmount:2190,lineAmount:2190,scheduledDay:null}],
 subtotal:2190,deliveryFee:0,total:2190,minimumOrderAmount:0,
 quoteFingerprint:'cd'.repeat(32),quotedAt:'2026-10-09T15:00:00.000Z'
};
const place={
 ok:true,status:'confirmed',
 address:{placeId:'googleplace_test001',formattedAddress:'12 Rue des Tests, 1050 Ixelles, Belgique',
 latitude:50.83,longitude:4.37,precision:'street_number',deliverable:true,
 evidence:'google_places_new'},
 territory:{countryCode:'BE',postalCode:'1050',city:'Ixelles'}
};
const userInput={
 cart:{partnerSlug:'thieyp',items:[{id:'rice001',quantity:1}],amount:1},
 deliveryPlaceId:'googleplace_test001',
 contact:{name:'Test Voyageur',phone:'+32470000000',email:'test@example.invalid',
 address:'Fake street 99, Paris',city:'Paris',consent:true,
 instructions:'Labo porte A',allergenFlags:['arachides']},
};
function mocked(adjust={}){
 const calls={catalog:0,google:0,coverage:0};
 const services={
  policy:{async quote(body){calls.catalog++;assert.deepEqual(Object.keys(body).sort(),['items','partnerSlug']);return {...quote,...(adjust.quote||{})}}},
  places:{async resolve(input,key){calls.google++;assert.equal(input.placeId,'googleplace_test001');return structuredClone(adjust.place||place)}},
  coverage:{async verifyCoverage(input){
   calls.coverage++; assert.equal(input.partnerSlug,'thieyp');
   return adjust.coverage||{allowed:true,serviceAreaCode:'be-brussels-launch'};
  }},
 };
 return {stager:new GuestCanonicalCheckoutStager(ledger,vault,services.policy,services.places,services.coverage),calls};
}
before(async()=>{
 const probe=await db.query('SELECT inet_server_port() AS port');
 assert.equal(probe.rows[0].port,55441);
 await db.query('TRUNCATE da_guest_checkout_sessions CASCADE');
});
after(async()=>db.end());
test('canonical server price wins; verified Google address replaces spoofed mobile input',async()=>{
 const guest=await ledger.issue(),{stager,calls}=mocked();
 const result=await stager.prepare(guest.token,userInput,'p5_lab');
 assert.equal(result.ok,true);
 assert.equal(result.amountCents,2190);
 assert.equal(result.paymentAvailable,false);
 assert.equal(result.serviceAreaCode,'be-brussels-launch');
 assert.deepEqual(calls,{catalog:1,google:1,coverage:1});
 const saved=await db.query('SELECT * FROM da_guest_fulfillment_vault WHERE order_id=$1',[guest.orderId]);
 assert.equal(saved.rowCount,1);
 const contents=JSON.stringify(saved.rows[0]);
 assert.equal(contents.includes('Paris'),false);
 assert.equal(contents.includes('Test Voyageur'),false);
 const doc=vault.openForInternalPaidOrder(saved.rows[0],guest.orderId,quote.quoteFingerprint);
 assert.equal(doc.locationProof.placeId,'googleplace_test001');
 assert.equal(doc.locationProof.source,'google_places_new');
 assert.equal(doc.contact.city,'Ixelles');
 assert.equal(doc.contact.address,'12 Rue des Tests, 1050 Ixelles, Belgique');
 assert.equal(doc.amountCents,2190);
 const state=await db.query('SELECT state,quoted_amount_cents FROM da_guest_checkout_sessions WHERE order_id=$1',[guest.orderId]);
 assert.equal(state.rows[0].state,'quoted');
 assert.equal(Number(state.rows[0].quoted_amount_cents),2190);
});
test('bad capability fails before catalog or Google query',async()=>{
 const guest=await ledger.issue(),{stager,calls}=mocked();
 await assert.rejects(stager.prepare(guest.token+'forged',userInput,'lab'),/unauthorized|invalid/);
 assert.deepEqual(calls,{catalog:0,google:0,coverage:0});
});
test('Google review, wrong postcode and false place evidence all deny checkout',async()=>{
 for(const fake of [
  {...place,status:'review'},
  {...place,territory:{...place.territory,postalCode:'9999'}},
  {...place,address:{...place.address,evidence:'client_forged'}},
  {...place,address:{...place.address,precision:'approximate'}},
 ]) {
  const guest=await ledger.issue(),{stager}=mocked({place:fake});
  await assert.rejects(stager.prepare(guest.token,userInput,'lab'),/unconfirmed_or_uncovered/);
  const record=await db.query('SELECT state FROM da_guest_checkout_sessions WHERE order_id=$1',[guest.orderId]);
  assert.equal(record.rows[0].state,'issued');
 }
});
test('merchant service-area denial wins even when Google confirms postal address',async()=>{
 const guest=await ledger.issue(),{stager}=mocked({coverage:{allowed:false,serviceAreaCode:'be-brussels-launch'}});
 await assert.rejects(stager.prepare(guest.token,userInput,'lab'),/service_area_denied/);
 assert.equal((await db.query('SELECT state FROM da_guest_checkout_sessions WHERE order_id=$1',[guest.orderId])).rows[0].state,'issued');
});
test('idempotent retry never duplicates private delivery records',async()=>{
 const guest=await ledger.issue(),{stager}=mocked();
 const first=await stager.prepare(guest.token,userInput,'lab');
 const retry=await stager.prepare(guest.token,userInput,'lab');
 assert.equal(first.alreadyPrepared,false);
 assert.equal(retry.alreadyPrepared,true);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM da_guest_fulfillment_vault WHERE order_id=$1',[guest.orderId])).rows[0].n,1);
 await assert.rejects(stager.prepare(guest.token,{...userInput,contact:{...userInput.contact,phone:'+32471112233'}},'lab'),/snapshot_conflict/);
});
test('cart duplicates or invalid quantities are refused before external calls',async()=>{
 for(const cart of [
  {partnerSlug:'thieyp',items:[{id:'rice001',quantity:0}]},
  {partnerSlug:'thieyp',items:[{id:'rice001',quantity:1},{id:'rice001',quantity:1}]},
 ]) {
  const guest=await ledger.issue(),{stager,calls}=mocked();
  await assert.rejects(stager.prepare(guest.token,{...userInput,cart},'lab'),/cart_invalid/);
  assert.deepEqual(calls,{catalog:0,google:0,coverage:0});
 }
});
test('catalog price/fingerprint changes cannot overwrite an already frozen order',async()=>{
 const guest=await ledger.issue();
 await mocked().stager.prepare(guest.token,userInput,'lab');
 const altered={quote:{total:2490,deliveryFee:300,quoteFingerprint:'ee'.repeat(32)}};
 const {stager}=mocked(altered);
 await assert.rejects(stager.prepare(guest.token,userInput,'lab'),/quote_conflict/);
 assert.equal((await db.query('SELECT quoted_amount_cents FROM da_guest_checkout_sessions WHERE order_id=$1',[guest.orderId])).rows[0].quoted_amount_cents,'2190');
});
test('incomplete consent leaves quote resumable but payment blocked by SQL trigger',async()=>{
 const guest=await ledger.issue(),{stager}=mocked();
 const invalid={...userInput,contact:{...userInput.contact,consent:false}};
 await assert.rejects(stager.prepare(guest.token,invalid,'lab'),/consent_required/);
 assert.equal((await db.query('SELECT state FROM da_guest_checkout_sessions WHERE order_id=$1',[guest.orderId])).rows[0].state,'quoted');
 await assert.rejects(ledger.bindTrustedPaymentIntent(guest.token,'pi_p5lab_noseal_123456'),/guest_payment_fulfillment_not_sealed/);
 const recovered=await stager.prepare(guest.token,userInput,'lab');
 assert.equal(recovered.alreadyPrepared,false);
});
