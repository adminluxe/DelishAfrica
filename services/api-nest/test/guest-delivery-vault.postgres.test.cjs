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
const {GuestCheckoutQuoteContext,sealGuestDelivery,openGuestDelivery}=
 require('../src/guest-checkout/guest-delivery-vault.ts');
const db=new Pool({host:'127.0.0.1',port:55439,user:'afripayadmin',database:'postgres',max:6});
const signingKey=randomBytes(32),privacyKey=randomBytes(32);
const policy={async quote(){
 return {ok:true,version:1,partnerSlug:'thieyp',partnerName:'Thieyp',currency:'eur',
 total:2190,subtotal:2190,deliveryFee:0,minimumOrderAmount:0,
 quoteFingerprint:'cb'.repeat(32),items:[{sku:'rice',id:'rice',name:'Rice',
 quantity:1,unitAmount:2190,lineAmount:2190,category:'Food',scheduledDay:null}],
 availabilityDate:'2026-10-09',availabilityDay:'vendredi',quotedAt:new Date().toISOString()};
}};
const delivery={
 firstName:'Test',lastName:'Guest',phone:'+32400000000',email:'test@example.invalid',
 address:'12 Example Road',city:'Brussels',instructions:'Ring bell',
 allergenFlags:['nuts'],foodSafetyNote:'Avoid nuts',giftDelivery:false
};
before(async()=>{
 const info=await db.query('SELECT inet_server_port() AS port');
 assert.equal(info.rows[0].port,55439);
 await db.query(readFileSync(path.join(__dirname,'../../../migrations/20261009_guest_delivery_context.sql'),'utf8'));
 await db.query('TRUNCATE da_guest_checkout_sessions CASCADE');
});
after(async()=>db.end());
test('AES256 GCM hides fields; wrong order, tampered tag and key fail',()=>{
 const pack=sealGuestDelivery(privacyKey,'DA-G-test1',delivery);
 assert.equal(pack.iv.length,12); assert.equal(pack.tag.length,16);
 assert.equal(pack.ciphertext.includes(Buffer.from('Example Road')),false);
 assert.equal(openGuestDelivery(privacyKey,'DA-G-test1',pack).address,delivery.address);
 assert.throws(()=>openGuestDelivery(privacyKey,'DA-G-another',pack));
 assert.throws(()=>openGuestDelivery(randomBytes(32),'DA-G-test1',pack));
 assert.throws(()=>openGuestDelivery(privacyKey,'DA-G-test1',{...pack,tag:randomBytes(16)}));
});
test('prepares quote and contact atomically in real PG; server amount wins',async()=>{
 const g=await new GuestCheckoutLedger(db,signingKey).issue();
 const ctx=new GuestCheckoutQuoteContext(db,signingKey,privacyKey,policy);
 const prepared=await ctx.prepare(g.token,{amount:1,items:[{id:'rice',quantity:1}]},delivery);
 assert.equal(prepared.total,2190);
 const r=await db.query('SELECT state,quoted_amount_cents FROM da_guest_checkout_sessions WHERE order_id=$1',[g.orderId]);
 assert.equal(r.rows[0].state,'quoted'); assert.equal(Number(r.rows[0].quoted_amount_cents),2190);
 const stored=await db.query('SELECT * FROM da_guest_order_context WHERE order_id=$1',[g.orderId]);
 assert.equal(stored.rowCount,1);
 assert.equal(stored.rows[0].delivery_ciphertext.includes(Buffer.from('Example Road')),false);
 const opened=openGuestDelivery(privacyKey,g.orderId,{
  iv:stored.rows[0].delivery_iv,tag:stored.rows[0].delivery_tag,
  ciphertext:stored.rows[0].delivery_ciphertext,fingerprint:stored.rows[0].delivery_fingerprint
 });
 assert.equal(opened.city,'Brussels');
 const retried=await ctx.prepare(g.token,{items:[{id:'rice',quantity:1}]},delivery);
 assert.equal(retried.quoteFingerprint,prepared.quoteFingerprint);
 await assert.rejects(ctx.prepare(g.token,{}, {...delivery,phone:'+32411111111'}),/immutable_after_quote/);
});
test('a DB error after context INSERT rolls back and retry succeeds',async()=>{
 const g=await new GuestCheckoutLedger(db,signingKey).issue();
 let failed=false;
 const faulty={async connect(){
  const c=await db.connect();
  return {release:()=>c.release(),async query(sql,args){
   if(!failed && sql.includes("SET state='quoted'")){failed=true;throw Error('simulated_write_loss')}
   return c.query(sql,args);
  }};
 }};
 const ctx=new GuestCheckoutQuoteContext(faulty,signingKey,privacyKey,policy);
 await assert.rejects(ctx.prepare(g.token,{},delivery),/simulated_write_loss/);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM da_guest_order_context WHERE order_id=$1',[g.orderId])).rows[0].n,0);
 assert.equal((await db.query('SELECT state FROM da_guest_checkout_sessions WHERE order_id=$1',[g.orderId])).rows[0].state,'issued');
 const recover=new GuestCheckoutQuoteContext(db,signingKey,privacyKey,policy);
 assert.equal((await recover.prepare(g.token,{},delivery)).state,'quoted');
});
test('false guest capability cannot load or mutate another order',async()=>{
 const good=await new GuestCheckoutLedger(db,signingKey).issue();
 const wrong=await new GuestCheckoutLedger(db,randomBytes(32)).issue();
 const ctx=new GuestCheckoutQuoteContext(db,signingKey,privacyKey,policy);
 await assert.rejects(ctx.prepare(wrong.token,{},delivery));
 assert.equal((await db.query('SELECT state FROM da_guest_checkout_sessions WHERE order_id=$1',[good.orderId])).rows[0].state,'issued');
});
