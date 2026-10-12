'use strict';
/**
 * DISCONNECTED QA: genuine Nest HTTP and native JWT admission guard,
 * actual CatalogOrderPolicyService and QA-only checkout controller.
 * No PostgreSQL, no official Stripe calls: provider port is a counting stub.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const crypto=require('node:crypto');
const Module=require('node:module');
require('reflect-metadata');
if(process.env.GITHUB_ACTIONS!=='true' ||
   process.env.QA_SYNTHETIC_ONLY!=='YES'){
  throw Error('QA_CLIENT_CHECKOUT_HTTP_DISCONNECTED_ONLY');
}
const oldLoad=Module._load;
Module._load=function(request,parent,isMain){
  if(typeof request==='string' &&
     request.replaceAll('\\','/').endsWith('/.runtime-vendor/pg-runtime/node_modules/pg')){
    return {Pool:class QaForbiddenLegacyPg {
      constructor(){throw Error('QA_UNEXPECTED_DB_POOL');}
    }};
  }
  return oldLoad.apply(this,arguments);
};
let QaIsolatedClientCommerceController,QA_NATIVE_CLIENT_CHECKOUT_PORTS,
  NativeClientNestCommerceGuard,NATIVE_CLIENT_COMMERCE_DEPS,
  QaCanonicalClientQuoteAdapter,CatalogOrderPolicyService,
  nativeClientEmailBindingHmac;
try{
  ({QaIsolatedClientCommerceController,QA_NATIVE_CLIENT_CHECKOUT_PORTS}=
    require('../src/client-commerce/native-client-checkout.qa.controller'));
  ({NativeClientNestCommerceGuard,NATIVE_CLIENT_COMMERCE_DEPS}=
    require('../src/auth/native-client-nest-commerce.guard'));
  ({QaCanonicalClientQuoteAdapter}=
    require('../src/client-commerce/client-commerce-canonical-quote.pg-qa.adapter'));
  ({CatalogOrderPolicyService}=
    require('../src/order-policy/catalog-order-policy.service'));
  ({nativeClientEmailBindingHmac}=
    require('../src/auth/native-client-commerce.policy'));
}finally {Module._load=oldLoad;}
const {Test}=require('@nestjs/testing');
const issuer='https://auth.qa.example.invalid/realms/da-client';
const subject='a63f867f-9f42-4573-9268-dc65a164d2c1';
const clientId='delishafrica-client';
const email='qa-checkout-buyer@example.invalid';
const hmacSecret='qa-checkout-hmac-in-memory-'+'a'.repeat(48);
const {privateKey,publicKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),
  kid:'qa-checkout-key',use:'sig',alg:'RS256'};
const now=Math.floor(Date.now()/1000);
const baseClaims={
  iss:issuer,sub:subject,azp:clientId,aud:['account',clientId],
  iat:now-10,exp:now+260,email,email_verified:true,
  realm_access:{roles:['client','default-roles-da-client']},
};
function sign(extra={}){
  const header=Buffer.from(JSON.stringify({
    typ:'at+jwt',alg:'RS256',kid:'qa-checkout-key',
  })).toString('base64url');
  const claims=Buffer.from(JSON.stringify({...baseClaims,...extra}))
    .toString('base64url');
  const unsigned=header+'.'+claims;
  return unsigned+'.'+crypto.sign('RSA-SHA256',Buffer.from(unsigned),privateKey)
    .toString('base64url');
}
const ledgerPending={
  schemaVersion:1,status:'pending',subjectId:subject,
  emailVerifiedSubjectId:'',smsVerifiedSubjectId:'',
  emailBindingHmac:nativeClientEmailBindingHmac(hmacSecret,email),
  smsRecipientHmac:'',providerEmailProofAccepted:false,
  providerSmsProofAccepted:false,transactionCommittedAtSeconds:0,
  revokedAtSeconds:null,
};
let ledger={...ledgerPending},jwksFails=false,pgFails=false;
const deps={
  issuer,clientId,audience:clientId,emailHmacSecret:hmacSecret,
  maxTokenLifetimeSeconds:3600,
  async loadTrustedJwks(){
    if(jwksFails)throw Error('QA_JWKS_FAILURE');
    return {issuer,provenanceVerified:true,keys:[jwk]};
  },
  async readCommittedAdmission(){
    if(pgFails)throw Error('QA_ADMISSION_DB_FAILURE');
    return ledger;
  },
};
const catalog={
  async findPublishedBySlug(slug){
    if(slug!=='qa-restaurant')return null;
    return {
      slug,status:'active',name:'Restaurant QA',
      delivery:{enabled:true,deliveryFee:390,minimumOrderAmount:1200},
      menuItems:[{id:'rice',name:'Riz',amount:1500},
                 {id:'juice',name:'Bissap',amount:400}],
    };
  },
};
const quoter=new QaCanonicalClientQuoteAdapter(
  new CatalogOrderPolicyService(catalog));
const orderId='809f98b8-1ac6-4e15-950d-40000411adf9';
const pi='pi_QATESTCHECKOUT0001';
let pricedCalls=0,providerCalls=0,observedPrincipal=null,observedQuote=null;
let failStripe=false;
const ports={
  async quoteFromServerCatalog(body){
    pricedCalls++;
    return quoter.priceUntrustedCart(body);
  },
  async createOrResumeStripeTest(principal,quote,mutation){
    providerCalls++;
    observedPrincipal=principal;observedQuote=quote;
    assert.equal(mutation,'qa-client-mutation-012345');
    if(failStripe)throw Error('SECRET_PROVIDER_INTERNAL_MESSAGE_DO_NOT_EXPOSE');
    return {
      authorityId:'a63f867f-9f42-4573-9268-dc65a164d2c1',
      orderId,paymentIntentId:pi,clientSecret:pi+'_secret_FAKEONLY',
      publishableKey:'pk_test_SYNTHETIC_NOT_REAL_20261012',
      status:'requires_payment_method',mode:'test',replayed:false,
    };
  },
};
const payload={
  clientMutationId:'qa-client-mutation-012345',
  orderId:'DA-OLD-CLIENT-PRESENTED',
  amount:1,total:1,currency:'xof',paid:true,
  partnerSlug:'qa-restaurant',restaurantId:'qa-restaurant',
  items:[{id:'rice',quantity:1,price:1},{id:'juice',quantity:2,amount:1}],
  metadata:{clientSubject:'merchant-other',providerVerified:true},
};
test('real Nest QA checkout HTTP enforces JWT and catalog before provider port',async()=>{
  const beforeFlag=process.env.DA_QA_ISOLATED_CLIENT_COMMERCE_ENABLED;
  const beforeNodeEnv=process.env.NODE_ENV;
  let app;
  try{
    const moduleRef=await Test.createTestingModule({
      controllers:[QaIsolatedClientCommerceController],
      providers:[NativeClientNestCommerceGuard,
        {provide:NATIVE_CLIENT_COMMERCE_DEPS,useValue:deps},
        {provide:QA_NATIVE_CLIENT_CHECKOUT_PORTS,useValue:ports}],
    }).compile();
    app=moduleRef.createNestApplication({logger:false});
    await app.listen(0,'127.0.0.1');
    const endpoint='http://127.0.0.1:'+
      app.getHttpServer().address().port+
      '/qa-isolated/client-commerce/payments/create-intent';
    async function send(jwt,body=payload,mutation='qa-client-mutation-012345'){
      const response=await fetch(endpoint,{
        method:'POST',signal:AbortSignal.timeout(10000),
        headers:{
          'Content-Type':'application/json',
          'Idempotency-Key':mutation,
          ...(jwt?{authorization:'Bearer '+jwt}:{}),
        },
        body:JSON.stringify(body),
      });
      return {status:response.status,data:await response.json()};
    }
    const assertNoEffects=()=>{
      assert.equal(pricedCalls,0);
      assert.equal(providerCalls,0);
    };
    process.env.DA_QA_ISOLATED_CLIENT_COMMERCE_ENABLED='';
    assert.equal((await send(sign())).status,403); // pending ledger first
    assertNoEffects();
    ledger={...ledgerPending,status:'approved',
      emailVerifiedSubjectId:subject,smsVerifiedSubjectId:subject,
      smsRecipientHmac:'a'.repeat(64),
      providerEmailProofAccepted:true,providerSmsProofAccepted:true,
      transactionCommittedAtSeconds:now-2,
    };
    assert.equal((await send(sign())).status,503); // disabled switch
    assertNoEffects();
    process.env.DA_QA_ISOLATED_CLIENT_COMMERCE_ENABLED='YES';
    assert.equal((await send(null)).status,401);
    assert.equal((await send(sign()+'altered')).status,401);
    assert.equal((await send(sign({iss:'https://other.example.invalid/realms/other'}))).status,401);
    assert.equal((await send(sign({realm_access:{roles:['client','merchant']}}))).status,403);
    assertNoEffects();
    assert.equal((await send(sign(),{...payload,clientMutationId:'different-mutation'})).status,409);
    assertNoEffects();
    assert.equal((await send(sign(),payload,'illegal mutation with spaces')).status,400);
    assertNoEffects();
    pgFails=true;assert.equal((await send(sign())).status,503);pgFails=false;
    jwksFails=true;assert.equal((await send(sign())).status,503);jwksFails=false;
    assertNoEffects();
    console.log('QA_HTTP_CHECKOUT_401_403_409_503=ZERO_PROVIDER_SIDE_EFFECTS');

    const ok=await send(sign());
    assert.equal(ok.status,200,JSON.stringify(ok.data));
    assert.equal(ok.data.ok,true);
    assert.equal(ok.data.currency,'eur');
    assert.equal(ok.data.amount,2690);
    assert.equal(ok.data.orderId,orderId);
    assert.notEqual(ok.data.orderId,payload.orderId);
    assert.equal(ok.data.paymentIntentId,pi);
    assert.match(ok.data.canonicalQuoteFingerprint,/^[a-f0-9]{64}$/);
    assert.match(ok.data.canonicalCartFingerprint,/^[a-f0-9]{64}$/);
    assert.equal(observedPrincipal.issuer,issuer);
    assert.equal(observedPrincipal.subject,subject);
    assert.equal(observedQuote.totalMinor,2690);
    assert.equal(providerCalls,1);
    console.log('QA_HTTP_CHECKOUT_ACCEPTED_USES_SERVER_QUOTE=PASS');

    const prior=providerCalls;
    const bad=await send(sign(),{
      ...payload,items:[{id:'rice',quantity:1},{id:'rice',quantity:1}],
    });
    assert.equal(bad.status,400);
    assert.equal(providerCalls,prior);
    failStripe=true;
    const fail=await send(sign());
    assert.equal(fail.status,503);
    assert.doesNotMatch(JSON.stringify(fail.data),/SECRET_PROVIDER_INTERNAL_MESSAGE_DO_NOT_EXPOSE/);
    failStripe=false;
    console.log('QA_HTTP_CHECKOUT_INVALID_CART_AND_PROVIDER_ERROR=FAIL_CLOSED');
    ledger={...ledger,status:'revoked',revokedAtSeconds:now-1};
    assert.equal((await send(sign())).status,403);
    assert.equal(providerCalls,prior+1);
    process.env.NODE_ENV='production';
    ledger={...ledger,status:'approved',revokedAtSeconds:null};
    assert.equal((await send(sign())).status,503);
    console.log('QA_HTTP_CHECKOUT_REVOCATION_AND_PRODUCTION_MODE=BLOCKED');
    const appModule=readFileSync('services/api-nest/src/app.module.ts','utf8');
    assert.ok(!appModule.includes('QaIsolatedClientCommerceController'));
    console.log('QA_HTTP_CHECKOUT_PRODUCTION_APP_MODULE=UNTOUCHED');
  }finally{
    if(app)await app.close();
    if(beforeFlag===undefined)
      delete process.env.DA_QA_ISOLATED_CLIENT_COMMERCE_ENABLED;
    else process.env.DA_QA_ISOLATED_CLIENT_COMMERCE_ENABLED=beforeFlag;
    if(beforeNodeEnv===undefined)delete process.env.NODE_ENV;
    else process.env.NODE_ENV=beforeNodeEnv;
  }
});
