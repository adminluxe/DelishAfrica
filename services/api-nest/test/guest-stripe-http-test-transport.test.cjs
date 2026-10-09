'use strict';
const {test, before, after}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const ts=require('typescript');

require.extensions['.ts']=(mod,f)=>mod._compile(ts.transpileModule(readFileSync(f,'utf8'),{
 fileName:f,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}
}).outputText,f);
const {GuestStripeHttpTestTransport}=
 require('../src/guest-checkout/guest-stripe-http-test-transport.ts');

const key='sk_test_'+('x'.repeat(30));
const orderId='DA-G-'+('a'.repeat(32));
const intentId='pi_p5e_http_123456';
const params={
 orderId,amount:2190,currency:'eur',idempotencyKey:'da-gc-pi-v1:'+orderId,
 metadata:{
  source:'delishafrica-guest-checkout',orderId,
  clientIssuer:'urn:delishafrica:guest-checkout:v1',
  clientSubject:'guest_p5e_lab',clientMutationId:'guest:'+orderId,
  quoteFingerprint:'ab'.repeat(32),
 },
};
const previousEnv={
 NODE_ENV:process.env.NODE_ENV,DA_GUEST_STRIPE_TEST_ONLY:process.env.DA_GUEST_STRIPE_TEST_ONLY,
};
before(()=>{
 process.env.NODE_ENV='test';process.env.DA_GUEST_STRIPE_TEST_ONLY='1';
});
after(()=>{
 for(const [k,v] of Object.entries(previousEnv)){
  if(v===undefined)delete process.env[k];else process.env[k]=v;
 }
});
function response(data={},status=200) {
 return new Response(JSON.stringify({
  object:'payment_intent',id:intentId,amount:2190,currency:'eur',
  livemode:false,status:'requires_payment_method',
  client_secret:intentId+'_secret_test123',
  metadata:params.metadata,
  ...data,
 }),{status});
}
function harness(config={}) {
 const calls=[];
 const http=async(url,init)=>{
  calls.push({url,init});
  if(config.throwError)throw Error('untrusted-provider-error-containing-secret');
  return response(config.data||{},config.status||200);
 };
 return {transport:new GuestStripeHttpTestTransport(key,8000,http),calls};
}

test('P5E transport refuses live keys and malformed TEST credentials',()=>{
 assert.throws(()=>new GuestStripeHttpTestTransport('sk_live_fake123'),/credentials_invalid/);
 assert.throws(()=>new GuestStripeHttpTestTransport('sk_test_abc\nInjected'),/credentials_invalid/);
 assert.throws(()=>new GuestStripeHttpTestTransport('invalid'),/credentials_invalid/);
});

test('P5E restricted test API keys are permitted for least privilege',()=>{
 const t=new GuestStripeHttpTestTransport('rk_test_'+('x'.repeat(24)),5000,async()=>response());
 assert.equal(t.mode,'test');
});

test('P5E production mode and feature flag OFF deny all HTTP calls',async()=>{
 const {transport,calls}=harness();
 process.env.NODE_ENV='production';
 try {await assert.rejects(transport.createIntent(params),/http_disabled/);}
 finally{process.env.NODE_ENV='test'}
 process.env.DA_GUEST_STRIPE_TEST_ONLY='0';
 try {await assert.rejects(transport.createIntent(params),/http_disabled/);}
 finally{process.env.DA_GUEST_STRIPE_TEST_ONLY='1'}
 assert.equal(calls.length,0);
});

test('P5E createIntent uses fixed HTTPS endpoint, exact key, canonical amount and card only',async()=>{
 const {transport,calls}=harness();
 const result=await transport.createIntent(params);
 assert.equal(result.id,intentId);
 assert.equal(result.livemode,false);
 assert.equal(result.clientSecret,intentId+'_secret_test123');
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://api.stripe.com/v1/payment_intents');
 assert.equal(calls[0].init.method,'POST');
 assert.equal(calls[0].init.headers['Idempotency-Key'],params.idempotencyKey);
 assert.equal(calls[0].init.headers.Authorization,'Bearer '+key);
 const form=new URLSearchParams(calls[0].init.body);
 assert.equal(form.get('amount'),'2190');
 assert.equal(form.get('currency'),'eur');
 assert.equal(form.get('capture_method'),'automatic');
 assert.deepEqual(form.getAll('payment_method_types[]'),['card']);
 assert.equal(form.get('metadata[quoteFingerprint]'),params.metadata.quoteFingerprint);
 for(const k of form.keys())assert.ok(k.startsWith('metadata[') ||
  ['amount','currency','capture_method','payment_method_types[]'].includes(k));
});

test('P5E getIntent performs scoped HTTP GET and has no idempotency-create header',async()=>{
 const {transport,calls}=harness();
 const reply=await transport.getIntent(intentId);
 assert.equal(reply.id,intentId);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://api.stripe.com/v1/payment_intents/'+intentId);
 assert.equal(calls[0].init.method,'GET');
 assert.equal(calls[0].init.headers['Idempotency-Key'],undefined);
});

test('P5E cancelIntent uses fixed scoped path and reproducible cancellation key',async()=>{
 const {transport,calls}=harness({data:{status:'canceled',client_secret:null}});
 const first=await transport.cancelIntent(intentId);
 const second=await transport.cancelIntent(intentId);
 assert.equal(first.status,'canceled');
 assert.equal(first.clientSecret,'');
 assert.equal(second.id,intentId);
 assert.equal(calls.length,2);
 assert.equal(calls[0].url,'https://api.stripe.com/v1/payment_intents/'+intentId+'/cancel');
 assert.equal(calls[0].init.headers['Idempotency-Key'],'da-gc-cancel-v1:'+intentId);
 assert.equal(calls[0].init.headers['Idempotency-Key'],calls[1].init.headers['Idempotency-Key']);
 assert.equal(new URLSearchParams(calls[0].init.body).get('cancellation_reason'),'abandoned');
});

test('P5E invalid order/amount/idempotency/metadata are blocked BEFORE HTTP',async()=>{
 const {transport,calls}=harness();
 for(const changes of [
  {amount:1},{currency:'usd'},{orderId:'../attacker'},
  {idempotencyKey:'random-idempotency-key'},
  {metadata:{...params.metadata,orderId:'DA-G-forged'}},
 ]) {
  await assert.rejects(transport.createIntent({...params,...changes}),/invalid|untrusted/);
 }
 assert.equal(calls.length,0);
});

test('P5E malformed URL IDs cannot trigger a provider fetch',async()=>{
 const {transport,calls}=harness();
 await assert.rejects(transport.getIntent('../api/keys'),/id_invalid/);
 await assert.rejects(transport.cancelIntent('pi_x'),/id_invalid/);
 assert.equal(calls.length,0);
});

test('P5E remote error body and transport exception are sanitized',async()=>{
 const a=harness({throwError:true});
 await assert.rejects(a.transport.createIntent(params),error=>{
  assert.equal(error.message,'guest_stripe_test_provider_network_uncertain');
  assert.equal(error.message.includes('secret'),false);
  return true;
 });
 const b=harness({status:402});
 await assert.rejects(b.transport.createIntent(params),error=>{
  assert.equal(error.message,'guest_stripe_test_provider_rejected');
  return true;
 });
});

test('P5E Stripe livemode/mismatched secret/non-Intent responses fail closed',async()=>{
 const bad=[
  {livemode:true},
  {client_secret:'pi_forged_secret_bad'},
  {object:'charge'},
  {amount:Infinity},
 ];
 for(const data of bad){
  const {transport}=harness({data});
  await assert.rejects(transport.createIntent(params),/invalid/);
 }
});

test('P5E HTTP adapter accepts only the exact provider TEST mode, never raw cards',async()=>{
 const {transport,calls}=harness();
 await transport.createIntent(params);
 const body=calls[0].init.body;
 assert.equal(body.includes('card[number]'),false);
 assert.equal(body.includes('card[cvc]'),false);
 assert.equal(body.includes('payment_method_data'),false);
 assert.ok(body.includes('payment_method_types'));
});
