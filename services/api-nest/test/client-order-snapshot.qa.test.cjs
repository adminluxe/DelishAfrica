'use strict';
// Disconnected in-memory unit test for the QA PostgreSQL transaction adapter.
// No secrets, real database, public API or network calls.
const {test}=require('node:test');
const assert=require('node:assert/strict');
if(process.env.QA_SYNTHETIC_ONLY!=='YES')throw Error('QA_ONLY');
const {QaCanonicalOrderSnapshotPgAdapter}=
 require('../src/client-commerce/client-order-snapshot.pg-qa.adapter');
const owner={
 issuer:'https://qa.example.invalid/realms/da-client',
 subject:'a63f867f-9f42-4573-9268-dc65a164d2c1',
 role:'client',authSource:'external',ownershipEligible:true,
};
const mutation='qa-snapshot-client-mutation-0001';
const orderId='7b48962f-83b8-4b35-a223-9234d1e652ce';
const quote={
 source:'server-canonical-catalog',
 merchantSlug:'qa-restaurant',currency:'EUR',totalMinor:2690,
 quoteFingerprint:'a'.repeat(64),cartFingerprint:'b'.repeat(64),
 fulfillment:{subtotalMinor:2300,deliveryFeeMinor:390,
  lines:[{sku:'rice',name:'Jollof rice',category:'Menu',quantity:1,
    unitAmountMinor:1500,lineAmountMinor:1500},
   {sku:'juice',name:'Bissap',category:'Drink',quantity:2,
    unitAmountMinor:400,lineAmountMinor:800}],
 },
};
function fakePool(failSnapshot=false){
 const calls=[];let released=0;
 const pool={connect:async()=>({
  release:()=>released++,
  async query(sql,args=[]){
   calls.push({sql,args});
   if(sql.startsWith('SELECT * FROM public.da_qa_service_reserve_order(')){
    return {rows:[{
     order_id:orderId,issuer:owner.issuer,client_subject:owner.subject,
     client_mutation_id:mutation,quote_fingerprint:quote.quoteFingerprint,
     cart_fingerprint:quote.cartFingerprint,merchant_slug:quote.merchantSlug,
     total_minor:'2690',currency:'EUR',state:'pending_payment',
    }]};
   }
   if(sql.startsWith('SELECT public.da_qa_service_store_order_snapshot(')){
    if(failSnapshot)throw Error('QA_INTERRUPT_BEFORE_COMMIT');
    return {rows:[{order_id:orderId}]};
   }
   return {rows:[]};
  },
 })};
 return {pool,calls,releases:()=>released};
}
test('atomic order plus published menu snapshot before any payment',async()=>{
 const mock=fakePool();
 const order=await new QaCanonicalOrderSnapshotPgAdapter(mock.pool)
  .reserveOrderAndSnapshot(owner,quote,mutation);
 assert.equal(order.orderId,orderId);
 assert.deepEqual(mock.calls.map(x=>x.sql.startsWith('SELECT')?
  x.sql.includes('store_order_snapshot')?'SNAPSHOT':'RESERVE':x.sql),
 ['BEGIN','RESERVE','SNAPSHOT','COMMIT']);
 const json=mock.calls[2].args[8];
 const lines=JSON.parse(json);
 assert.equal(lines.length,2);
 assert.equal(lines[0].lineAmountMinor,1500);
 assert.equal(lines[1].lineAmountMinor,800);
 assert.equal(mock.releases(),1);
 console.log('QA_ATOMIC_ORDER_SNAPSHOT_BEFORE_PAYMENT=PASS');
});
test('interrupt between order reservation and snapshot must rollback',async()=>{
 const mock=fakePool(true);
 await assert.rejects(
  ()=>new QaCanonicalOrderSnapshotPgAdapter(mock.pool)
   .reserveOrderAndSnapshot(owner,quote,mutation),
  /qa_snapshot_atomic_order_reservation_unavailable/);
 assert.equal(mock.calls.at(-1).sql,'ROLLBACK');
 assert.ok(!mock.calls.some(x=>x.sql==='COMMIT'));
 assert.equal(mock.releases(),1);
 console.log('QA_ATOMIC_SNAPSHOT_INTERRUPTED=ROLLBACK');
});
test('untrusted missing lines, changed amount and foreign JWT fail before DB',async()=>{
 let calls=0;
 const never={connect:async()=>{calls++;throw Error('UNEXPECTED_DB')}};
 const adapter=new QaCanonicalOrderSnapshotPgAdapter(never);
 const invalid=[
  [owner,{...quote,fulfillment:undefined}],
  [owner,{...quote,fulfillment:{...quote.fulfillment,
   subtotalMinor:1}}],
  [owner,{...quote,fulfillment:{...quote.fulfillment,
   lines:[{...quote.fulfillment.lines[0],lineAmountMinor:1},
    quote.fulfillment.lines[1]]}}],
  [{...owner,role:'merchant'},quote],
  [{...owner,subject:'invalid'},quote],
 ];
 for(const [principal,request] of invalid){
  await assert.rejects(()=>adapter.reserveOrderAndSnapshot(
   principal,request,mutation));
 }
 assert.equal(calls,0);
 console.log('QA_ATOMIC_SNAPSHOT_INVALID_CLIENT_OR_PRICE=NO_DB_TRAFFIC');
});
