'use strict';
/**
 * QA: exercises ACTUAL PaymentsService against a strictly local Stripe
 * retrieval stub and independently generated signature fixtures.
 * ZERO Stripe network calls, ZERO live secrets, ZERO real payment.
 *
 * Tests must NOT be interpreted as acceptance of actual Stripe TEST
 * transactions or webhooks. All server responses are synthetic.
 */
const assert=require('node:assert/strict');
const {test}=require('node:test');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const Module=require('node:module');
if(process.env.GITHUB_ACTIONS!=='true' ||
   process.env.QA_SYNTHETIC_ONLY!=='YES') {
  throw Error('QA_SYNTHETIC_ONLY_IN_GITHUB_ACTIONS');
}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'da-stripe-finality-'));
const originalFetch=global.fetch;
const oldStripeSecret=process.env.STRIPE_SECRET_KEY;
const oldWebhookSecret=process.env.STRIPE_WEBHOOK_SECRET;
const oldStore=process.env.DA_PAYMENT_AUTHORITY_STORE_FILE;
const secret='sk_test_QA_STRICTLY_FAKE_DO_NOT_USE';
const webhookSecret='whsec_QA_STRICTLY_FAKE_DO_NOT_USE';
process.env.STRIPE_SECRET_KEY=secret;
process.env.STRIPE_WEBHOOK_SECRET=webhookSecret;
process.env.DA_PAYMENT_AUTHORITY_STORE_FILE=path.join(temp,'authority.json');
// The existing catalog foundation still imports a deployment-specific pg
// vendor module as soon as PaymentsService is imported. It is not used by
// these tests: block any unexpected database connection attempt.
const originalModuleLoad=Module._load;
Module._load=function(request,parent,isMain){
  if(typeof request==='string' &&
    request.replaceAll('\\','/').endsWith('/.runtime-vendor/pg-runtime/node_modules/pg')) {
    return {Pool:class QAForbiddenVendorPool {
      constructor(){throw Error('QA_UNEXPECTED_REAL_POSTGRES_POOL')}
    }};
  }
  return originalModuleLoad.apply(this,arguments);
};
const {PaymentsService}=require('../src/payments/payments.service');
Module._load=originalModuleLoad;

const service=new PaymentsService({quote:async()=>{throw Error('QA_NO_LIVE_CATALOG')}});

const issuer='https://qa.example.invalid/realms/da-client';
const subject='a63f867f-9f42-4573-9268-dc65a164d2c1';
const clientId='qa-client-alice';
const orderId='DA-QA-ORDER-0001';
const intentId='pi_test_fake_signature_0001';
const chargeId='ch_test_fake_charge_0001';
const mutationId='qa-client-mutation-0001';
const cartFingerprint='a'.repeat(64);
const quoteFingerprint='b'.repeat(64);
const principal={issuer,subject,clientId,role:'client',authSource:'external',
  ownershipEligible:true,name:'QA Test Identity',expiresAt:new Date(Date.now()+600000).toISOString()};
const quote={total:1200,currency:'eur',partnerSlug:'qa-merchant',
  quoteFingerprint,items:[]};
const input={orderId,paymentIntentId:intentId,
  clientMutationId:mutationId,cartFingerprint};
const metadata={orderId,partnerSlug:quote.partnerSlug,quoteFingerprint,
  clientMutationId:mutationId,clientIssuer:issuer,clientSubject:subject,
  clientId,cartFingerprint};

const base=()=>({
  id:intentId,object:'payment_intent',livemode:false,
  status:'succeeded',amount:1200,amount_received:1200,currency:'eur',
  metadata:{...metadata},
  latest_charge:{
    id:chargeId,object:'charge',payment_intent:intentId,
    status:'succeeded',paid:true,captured:true,currency:'eur',
    amount:1200,amount_captured:1200,amount_refunded:0,
    refunded:false,disputed:false,
  },
});
let stubbedRequests=0;
function interceptStripe(responseFactory){
  global.fetch=async(uri,options={})=>{
    stubbedRequests++;
    assert.equal(String(uri).split('?')[0],
      'https://api.stripe.com/v1/payment_intents/'+intentId);
    assert.equal(options.method,'GET');
    assert.equal(options.headers?.Authorization,'Bearer '+secret);
    assert(String(uri).includes('expand%5B%5D=latest_charge'));
    return Response.json(responseFactory(),{status:200});
  };
}
async function checkRejected(mutator,description){
  const provider=base();
  mutator(provider);
  interceptStripe(()=>provider);
  await assert.rejects(service.verifyPaidOrder(principal,input,quote),
    err=>err?.status>=400&&err?.status<600,
    'Must fail-closed on '+description);
}

test('real PaymentsService requires retrieved Stripe TEST financial finality, not a signed event alone',async()=>{
  try{
    interceptStripe(base);
    const valid=await service.verifyPaidOrder(principal,input,quote);
    assert.equal(valid.status,'paid');
    assert.equal(valid.verified,true);
    assert.equal(valid.mode,'test');
    assert.equal(valid.financialFinality,
      'charge_captured_unrefunded_undisputed_v1');
    assert.equal(valid.amount,1200);
    assert.equal(valid.amountCaptured,1200);
    assert.equal(valid.chargeId,chargeId);
    console.log('QA_STRIPE_API_RETRIEVAL_SYNTHETIC_POSITIVE=PASS');

    for (const [name,mutate] of [
      ['wrong_client',p=>{p.metadata.clientSubject=crypto.randomUUID()}],
      ['wrong_issuer',p=>{p.metadata.clientIssuer='https://evil.invalid/realms/x'}],
      ['wrong_quote',p=>{p.metadata.quoteFingerprint='f'.repeat(64)}],
      ['wrong_order',p=>{p.metadata.orderId='DA-OTHER'}],
      ['wrong_mutation',p=>{p.metadata.clientMutationId='qa-other'}],
      ['cart_mismatch',p=>{p.metadata.cartFingerprint='c'.repeat(64)}],
      ['amount_mismatch',p=>{p.amount_received=1300}],
      ['currency_mismatch',p=>{p.currency='usd'}],
      ['pending',p=>{p.status='processing'}],
      ['charge_unpaid',p=>{p.latest_charge.paid=false}],
      ['charge_uncaptured',p=>{p.latest_charge.captured=false}],
      ['captured_amount_low',p=>{p.latest_charge.amount_captured=800}],
      ['charge_refund',p=>{p.latest_charge.amount_refunded=300}],
      ['charge_dispute',p=>{p.latest_charge.disputed=true}],
      ['foreign_charge',p=>{p.latest_charge.payment_intent='pi_test_other'}],
      ['live_mode',p=>{p.livemode=true}],
    ]){
      await checkRejected(mutate,name);
      console.log('QA_STRIPE_FINANCIAL_DENIAL_'+name.toUpperCase()+'=PASS');
    }

    const timestamp=Math.floor(Date.now()/1000);
    const event={id:'evt_qa_synthetic_001',type:'payment_intent.succeeded',
      livemode:false,data:{object:{id:intentId,status:'succeeded'}}};
    const raw=Buffer.from(JSON.stringify(event));
    const signature=t=>crypto.createHmac('sha256',webhookSecret)
      .update(t+'.'+raw.toString('utf8')).digest('hex');
    const verified=service.handleStripeWebhook(raw,{},'t='+timestamp+',v1='+signature(timestamp));
    assert.equal(verified.verified,true);
    assert.equal(verified.authorityRecordFound,false,
      'signed webhook without a matching local record is not a paid order');
    assert.equal(fs.existsSync(process.env.DA_PAYMENT_AUTHORITY_STORE_FILE),false,
      'webhook without authority may not create persisted payment evidence');
    console.log('QA_STRIPE_SIGNED_WEBHOOK_ALONE_NOT_A_PAID_ORDER=PASS');
    await assert.rejects(async()=>{
      service.handleStripeWebhook(raw,{},'t='+timestamp+',v1='+'0'.repeat(64));
    },err=>err?.status>=400);
    await assert.rejects(async()=>{
      const old=timestamp-4000;
      service.handleStripeWebhook(raw,{},'t='+old+',v1='+signature(old));
    },err=>err?.status>=400);
    console.log('QA_STRIPE_INVALID_OR_EXPIRED_WEBHOOK_SIGNATURE=REJECTED');
    assert(stubbedRequests>0,'retrieval must actually exercise provider stub');
    console.log('QA_STRIPE_PROVIDER_NETWORK=ZERO_STUBBED_RETRIEVAL_ONLY');
    console.log('QA_STRIPE_LIVE_KEYS_OR_PAYMENT=NEVER_USED');
  }finally{
    global.fetch=originalFetch;
    if(oldStripeSecret===undefined)delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY=oldStripeSecret;
    if(oldWebhookSecret===undefined)delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET=oldWebhookSecret;
    if(oldStore===undefined)delete process.env.DA_PAYMENT_AUTHORITY_STORE_FILE;
    else process.env.DA_PAYMENT_AUTHORITY_STORE_FILE=oldStore;
    fs.rmSync(temp,{recursive:true,force:true});
  }
});
