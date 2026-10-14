'use strict';
/** Isolated QA: real Client receipt PG reader against a strict in-memory
 * query stub. No network, Stripe, runtime tables or production credentials. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
if(process.env.GITHUB_ACTIONS!=='true'||
   process.env.QA_SYNTHETIC_ONLY!=='YES') {
  throw Error('QA_RECEIPT_READER_CI_SYNTHETIC_ONLY');
}
const {QaClientOwnedOrderReceiptReader}=
  require('../src/client-commerce/client-order-receipt.pg-qa.adapter');
const issuer='https://qa.example.invalid/realms/da-client';
const subject='a63f867f-9f42-4573-9268-dc65a164d2c1';
const order='7b48962f-83b8-4b35-a223-9234d1e652ce';
const pi='pi_QAOWNEDRECPT001';
const mutation='qa-client-owned-mutation-001';
const principal=Object.freeze({
  issuer,subject,role:'client',authSource:'external',ownershipEligible:true,
});
const base=Object.freeze({
  order_id:order,client_mutation_id:mutation,payment_intent_id:pi,
  financial_status:'paid',dispatch_eligible:true,
  quote_fingerprint:'a'.repeat(64),cart_fingerprint:'b'.repeat(64),
  merchant_slug:'qa-restaurant',total_minor:'2690',currency:'EUR',
});
function reader(row,log=[]){
  return new QaClientOwnedOrderReceiptReader({
    async query(sql,values){
      log.push({sql,values});
      assert.equal(sql,'SELECT * FROM public.da_qa_client_read_owned_order('+
        '$1::uuid,$2::text,$3::uuid)');
      assert.deepEqual(values,[order,issuer,subject]);
      return {rows:row?[row]:[]};
    },
  });
}

test('only owner-scoped SQL function is invoked and captured status is read only',async()=>{
  const queries=[];
  const value=await reader(base,queries).readOwned(principal,order,mutation);
  assert.equal(value.financialStatus,'paid');
  assert.equal(value.dispatchEligible,true);
  assert.equal(value.paymentIntentId,pi);
  assert.equal(value.amount,2690);
  assert.equal(value.currency,'eur');
  assert.equal(queries.length,1);
  assert.ok(!queries[0].sql.match(/\b(UPDATE|INSERT|DELETE)\b/i));
  assert.ok(!JSON.stringify(value).includes(subject));
  console.log('QA_CLIENT_RECEIPT_READ_ONLY_OWNERSHIP_AND_PRICE=PASS');
});
test('refund hold and pending state never represent paid',async()=>{
  const held=await reader({...base,financial_status:'financial_hold',
    dispatch_eligible:false}).readOwned(principal,order,mutation);
  assert.equal(held.financialStatus,'financial_hold');
  assert.equal(held.dispatchEligible,false);
  const pending=await reader({...base,financial_status:'awaiting_payment',
    payment_intent_id:null,dispatch_eligible:false})
    .readOwned(principal,order,mutation);
  assert.equal(pending.financialStatus,'awaiting_payment');
  assert.equal(pending.paymentIntentId,null);
  console.log('QA_CLIENT_RECEIPT_LATE_HOLD_AND_PENDING=NO_PAID');
});
test('mismatched mutation, issuer, subject, role and missing row fail closed',async()=>{
  await assert.rejects(()=>reader(base).readOwned(principal,order,'new-mutation-002'),
    /qa_receipt_database_status_inconsistent/);
  await assert.rejects(()=>reader(null).readOwned(principal,order,mutation),
    /qa_receipt_order_not_found_or_not_owned/);
  await assert.rejects(()=>reader(base).readOwned({...principal,role:'merchant'},order,mutation),
    /qa_receipt_verified_client_and_order_required/);
  await assert.rejects(()=>reader(base).readOwned({...principal,subject:'stranger'},order,mutation),
    /qa_receipt_verified_client_and_order_required/);
  await assert.rejects(()=>reader(base).readOwned({...principal,issuer:'http://qa.invalid'},order,mutation),
    /qa_receipt_verified_client_and_order_required/);
  await assert.rejects(()=>reader({...base,order_id:'7b48962f-83b8-4b35-a223-9234d1e652ff'})
    .readOwned(principal,order,mutation),/qa_receipt_database_status_inconsistent/);
  console.log('QA_CLIENT_RECEIPT_MISMATCHED_PRINCIPAL_AND_MUTATION=DENIED');
});
test('fraudulent paid without receipt gating or incorrect PI is not trusted',async()=>{
  for(const row of [
    {...base,financial_status:'paid',dispatch_eligible:false},
    {...base,financial_status:'financial_hold',dispatch_eligible:true},
    {...base,payment_intent_id:null},
    {...base,payment_intent_id:'not_a_valid_stripe_pi'},
    {...base,financial_status:'unknown'},
    {...base,total_minor:'NaN'},
    {...base,quote_fingerprint:'0'.repeat(12)},
  ]){
    await assert.rejects(()=>reader(row).readOwned(principal,order,mutation),
      /qa_receipt_database_status_inconsistent/);
  }
  console.log('QA_CLIENT_RECEIPT_FORGED_PAID_OR_PI=FAIL_CLOSED');
});
