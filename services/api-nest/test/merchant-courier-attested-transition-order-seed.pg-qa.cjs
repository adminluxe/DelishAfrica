'use strict';
/**
 * F4K disposable PG17 order fixture. No Stripe API/real identity.
 * Runs AFTER all prior F4I baseline tests using a dedicated client SQL
 * password and never sees Keycloak admin or attestor credentials.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {createHash}=require('node:crypto');
const {Pool}=require('pg');
const {QaClientCommercePgAdapter}=require(
  '/qa-built/client-commerce.pg-qa.adapter.js');
const {QaCanonicalOrderSnapshotPgAdapter}=require(
  '/qa-built/client-order-snapshot.pg-qa.adapter.js');
if(process.env.GITHUB_ACTIONS!=='true'||
   process.env.QA_SYNTHETIC_ONLY!=='YES'||
   process.env.QA_COMMERCE_DB_HOST!=='127.0.0.1'||
   process.env.QA_COMMERCE_DB_NAME!=='postgres'||
   !/^[0-9a-f]{64}$/.test(process.env.QA_COMMERCE_HMAC_KEY||'')||
   (process.env.QA_CLIENT_DB_PASSWORD||'').length<32||
   process.env.QA_ATTESTOR_DB_PASSWORD!==undefined||
   process.env.QA_BOOTSTRAP_ADMIN_PASSWORD!==undefined)
  throw Error('qa_f4k_disconnected_client_fixture_only');
const client=new Pool({
  host:'127.0.0.1',port:5432,database:'postgres',
  user:'da_qa_client_commerce_app',
  password:process.env.QA_CLIENT_DB_PASSWORD,
  max:2,connectionTimeoutMillis:5000,statement_timeout:10000,
});
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
      unitAmountMinor:400,lineAmountMinor:800},
  ]},
};
async function main(){
  const reserve=new QaCanonicalOrderSnapshotPgAdapter(client);
  const pay=new QaClientCommercePgAdapter(client,
    process.env.QA_COMMERCE_HMAC_KEY);
  const orders={},commands=['BEGIN;'];
  for(const [n,id] of [
    [1,'qa-f4k-signed-delivery-0001'],
    [2,'qa-f4k-refund-hold-0002'],
  ]){
    const order=await reserve.reserveOrderAndSnapshot(buyer,quote,id);
    const paid=await pay.reserveTestPayment(buyer,order.orderId);
    const uid=/^[0-9a-f]{8}-[0-9a-f-]{27,30}$/i;
    assert.ok(uid.test(order.orderId)&&uid.test(paid.authorityId));
    const pi='pi_QA015SYNTHPAID000'+n;
    const charge='ch_QA015SYNTHPAID000'+n;
    const mac=createHash('sha256').update('qa-f4k-fake-capture-'+n)
      .digest('hex');
    commands.push(
      "SELECT * FROM public.da_qa_provider_bind_test_intent('"+
      paid.authorityId+"'::uuid,'"+pi+"',2690,'EUR');",
      "SELECT * FROM public.da_qa_finance_commit_captured_test('"+
      paid.authorityId+"'::uuid,'"+pi+"','"+charge+
      "','acct_QA015SAFEFIXTURE',2690,'EUR','"+mac+"',NULL);",
      "SELECT * FROM public.da_qa_wallet_accrue_verified_capture('"+
      order.orderId+"'::uuid);",
    );
    orders[n===1?'deliver':'refund']={
      orderId:order.orderId,authorityId:paid.authorityId,
    };
  }
  commands.push('COMMIT;');
  fs.writeFileSync('/qa-seed/f4k-orders.json',JSON.stringify(orders),
    {mode:0o600});
  fs.writeFileSync('/qa-seed/f4k-finance.sql',
    commands.join('\n')+'\n',{mode:0o600});
  console.log('QA_F4K_TWO_CANONICAL_ORDERS_CLIENT_RESERVED=PASS');
}
void main().finally(()=>client.end()).catch(()=>{
  console.error('QA_F4K_CLIENT_FIXTURE_DENIED');
  process.exitCode=1;
});
