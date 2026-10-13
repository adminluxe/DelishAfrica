'use strict';
// F4L: a new set of canonical orders and fake captured receipts on PG17.
// True SQL and adapters, no Stripe API, no money, no production.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {Pool}=require('pg');
const {QaClientCommercePgAdapter}=require('/qa-built/client-commerce.pg-qa.adapter.js');
const {QaCanonicalOrderSnapshotPgAdapter}=require(
 '/qa-built/client-order-snapshot.pg-qa.adapter.js');
if(process.env.GITHUB_ACTIONS!=='true'||process.env.QA_SYNTHETIC_ONLY!=='YES'
 ||process.env.QA_COMMERCE_DB_HOST!=='127.0.0.1'
 ||process.env.QA_COMMERCE_DB_NAME!=='postgres'
 ||!/^[a-f0-9]{64}$/.test(process.env.QA_COMMERCE_HMAC_KEY||'')
 ||(process.env.QA_CLIENT_DB_PASSWORD||'').length<32
 ||process.env.QA_ATTESTOR_DB_PASSWORD!==undefined
 ||process.getuid?.()!==1000)throw Error('qa_f4l_qa_order_seed_denied');
const client=new Pool({host:'127.0.0.1',port:5432,database:'postgres',
 user:'da_qa_client_commerce_app',
 password:process.env.QA_CLIENT_DB_PASSWORD,max:2,
 connectionTimeoutMillis:5000,statement_timeout:10000});
const buyer={issuer:'https://qa.example.invalid/realms/da-client',
 subject:'a63f867f-9f42-4573-9268-dc65a164d2c1',
 role:'client',authSource:'external',ownershipEligible:true};
const quote={
 source:'server-canonical-catalog',merchantSlug:'qa-restaurant',
 quoteFingerprint:'a'.repeat(64),cartFingerprint:'b'.repeat(64),
 totalMinor:2690,currency:'EUR',
 fulfillment:{subtotalMinor:2300,deliveryFeeMinor:390,lines:[
 {sku:'rice',name:'Jollof rice',category:'Menu',quantity:1,
  unitAmountMinor:1500,lineAmountMinor:1500},
 {sku:'juice',name:'Bissap',category:'Drink',quantity:2,
  unitAmountMinor:400,lineAmountMinor:800}]},
};
const stages=['success','same','simultaneous','refundFirst',
 'refundConcurrent','assignThenRefund','revokedCourier','orgMove','picked',
 'machineRevoked','unready','foreign','reassign'];
async function main(){
 const reserve=new QaCanonicalOrderSnapshotPgAdapter(client);
 const pay=new QaClientCommercePgAdapter(client,process.env.QA_COMMERCE_HMAC_KEY);
 const orders={},statements=['BEGIN;'];
 for(const [i,key] of stages.entries()){
  const n=String(i+1).padStart(3,'0');
  const order=await reserve.reserveOrderAndSnapshot(
   buyer,quote,'qa-f4l-dispatch-'+key+'-20261013');
  const auth=await pay.reserveTestPayment(buyer,order.orderId);
  const pi='pi_QA016SYNTHPAID'+n,charge='ch_QA016SYNTHPAID'+n;
  const mac=crypto.createHash('sha256').update('qa-f4l-fake-capture-'+n).digest('hex');
  const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27,30}$/i;
  assert.match(order.orderId,uuid);assert.match(auth.authorityId,uuid);
  statements.push(
   "SELECT * FROM public.da_qa_provider_bind_test_intent('"+
    auth.authorityId+"'::uuid,'"+pi+"',2690,'EUR');",
   "SELECT * FROM public.da_qa_finance_commit_captured_test('"+
    auth.authorityId+"'::uuid,'"+pi+"','"+charge+
    "','acct_QA016SAFEFIXTURE',2690,'EUR','"+mac+"',NULL);",
   "SELECT * FROM public.da_qa_wallet_accrue_verified_capture('"+
    order.orderId+"'::uuid);");
  orders[key]={orderId:order.orderId,authorityId:auth.authorityId};
 }
 statements.push('COMMIT;');
 fs.writeFileSync('/qa-seed/f4l-orders.json',JSON.stringify(orders),{mode:0o600});
 fs.writeFileSync('/qa-seed/f4l-finance.sql',
  statements.join('\n')+'\n',{mode:0o600});
 console.log('QA_F4L_CANONICAL_SYNTHETIC_ORDERS='+stages.length);
}
void main().finally(()=>client.end()).catch(()=>{
 console.error('QA_F4L_ORDER_SEED_FAILED');process.exitCode=1;
});
