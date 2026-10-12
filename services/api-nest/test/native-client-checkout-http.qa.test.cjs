'use strict';
/**
 * DISCONNECTED QA: genuine Nest HTTP with signed JWT + committed Client
 * admission, real CatalogOrderPolicyService, and strict TWO-PHASE commerce.
 *
 * Provider and PostgreSQL ports here are strict in-memory counting STUBS.
 * Independent PostgreSQL17 tests verify the actual SQL and provider adapters.
 * NEVER real Stripe, NEVER a public route, NEVER a production database.
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
    return {Pool:class QaForbiddenLegacyPg{
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
const pi='pi_QATESTCHECKOUT0001';
let pricedCalls=0,reserveCalls=0,providerCalls=0;
let observedPrincipal=null,observedQuote=null,failStripe=false,failReserve=false;
const reservations=new Map();
const ports={
  async quoteFromServerCatalog(body){
    pricedCalls++;
    return quoter.priceUntrustedCart(body);
  },
  async reserveCanonicalOrder(principal,quote,mutation){
    reserveCalls++;
    observedPrincipal=principal;observedQuote=quote;
    if(failReserve)throw Error('SECRET_DB_FAULT_NOT_FOR_HTTP');
    const key=[principal.issuer,principal.subject.toLowerCase(),mutation].join(':');
    const previous=reservations.get(key);
    if(previous){
      if(previous.quoteFingerprint!==quote.quoteFingerprint ||
         previous.cartFingerprint!==quote.cartFingerprint ||
         previous.totalMinor!==quote.totalMinor ||
         previous.merchantSlug!==quote.merchantSlug){
        throw Error('qa_idempotency_payload_mismatch');
      }
      return previous;
    }
    const order=Object.freeze({
      orderId:crypto.randomUUID(),
      issuer:principal.issuer,clientSubject:principal.subject,
      clientMutationId:mutation,
      quoteFingerprint:quote.quoteFingerprint,
      cartFingerprint:quote.cartFingerprint,
      merchantSlug:quote.merchantSlug,totalMinor:quote.totalMinor,
      currency:quote.currency,state:'pending_payment',
    });
    reservations.set(key,order);
    return order;
  },
  async createOrResumeStripeTest(principal,quote,mutation){
    providerCalls++;
    observedPrincipal=principal;observedQuote=quote;
    assert.equal(mutation,'qa-client-mutation-012345');
    if(failStripe)throw Error('SECRET_PROVIDER_INTERNAL_MESSAGE_DO_NOT_EXPOSE');
    const stored=reservations.get([principal.issuer,principal.subject.toLowerCase(),mutation].join(':'));
    assert.ok(stored,'provider port called without reserved order');
    return {
      authorityId:'a63f867f-9f42-4573-9268-dc65a164d2c1',
      orderId:stored.orderId,paymentIntentId:pi,clientSecret:pi+'_secret_FAKEONLY',
      publishableKey:'pk_test_SYNTHETIC_NOT_REAL_20261012',
      status:'requires_payment_method',mode:'test',replayed:providerCalls>1,
    };
  },
};
const cart={
  clientMutationId:'qa-client-mutation-012345',
  // Intentionally fake values: NEVER trusted over server catalog.
  amount:1,total:1,currency:'xof',paid:true,
  partnerSlug:'qa-restaurant',restaurantId:'qa-restaurant',
  items:[{id:'rice',quantity:1,price:1},{id:'juice',quantity:2,amount:1}],
  metadata:{clientSubject:'merchant-other',providerVerified:true},
};

test('real Nest HTTP two-phase Client order and Stripe TEST remain isolated',async()=>{
  const beforeFlag=process.env.DA_QA_ISOLATED_CLIENT_COMMERCE_ENABLED;
  const beforeNodeEnv=process.env.NODE_ENV;
  let app;
  try{
    const mod=await Test.createTestingModule({
      controllers:[QaIsolatedClientCommerceController],
      providers:[NativeClientNestCommerceGuard,
        {provide:NATIVE_CLIENT_COMMERCE_DEPS,useValue:deps},
        {provide:QA_NATIVE_CLIENT_CHECKOUT_PORTS,useValue:ports}],
    }).compile();
    app=mod.createNestApplication({logger:false});
    await app.listen(0,'127.0.0.1');
    const base='http://127.0.0.1:'+app.getHttpServer().address().port+
      '/qa-isolated/client-commerce/';
    const paths={order:'orders/create',intent:'payments/create-intent'};
    async function send(path,jwt,body=cart,mutation='qa-client-mutation-012345'){
      const response=await fetch(base+paths[path],{
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
    const noEffect=()=>{assert.equal(reserveCalls,0);assert.equal(providerCalls,0);};
    process.env.DA_QA_ISOLATED_CLIENT_COMMERCE_ENABLED='';
    assert.equal((await send('order',sign())).status,403); // pending admission
    noEffect();
    ledger={...ledgerPending,status:'approved',
      emailVerifiedSubjectId:subject,smsVerifiedSubjectId:subject,
      smsRecipientHmac:'a'.repeat(64),
      providerEmailProofAccepted:true,providerSmsProofAccepted:true,
      transactionCommittedAtSeconds:now-2,
    };
    for(const path of Object.keys(paths)){
      assert.equal((await send(path,sign())).status,503); // QA switch OFF
    }
    noEffect();
    process.env.DA_QA_ISOLATED_CLIENT_COMMERCE_ENABLED='YES';
    for(const path of Object.keys(paths)){
      assert.equal((await send(path,null)).status,401);
      assert.equal((await send(path,sign()+'altered')).status,401);
      assert.equal((await send(path,sign({iss:'https://other.example.invalid/realms/other'}))).status,401);
      assert.equal((await send(path,sign({realm_access:{roles:['client','merchant']}}))).status,403);
      assert.equal((await send(path,sign(),{...cart,clientMutationId:'different-mutation'})).status,409);
      assert.equal((await send(path,sign(),cart,'spaces not allowed')).status,400);
    }
    noEffect();
    pgFails=true;assert.equal((await send('order',sign())).status,503);pgFails=false;
    jwksFails=true;assert.equal((await send('order',sign())).status,503);jwksFails=false;
    noEffect();
    console.log('QA_HTTP_TWO_PHASE_401_403_409_503=ZERO_SIDE_EFFECTS');

    const oldLocal=await send('order',sign(),{...cart,orderId:'DA-CLIENT-LOCAL-003'});
    assert.equal(oldLocal.status,409);
    noEffect();
    const order=await send('order',sign());
    assert.equal(order.status,201,JSON.stringify(order.data));
    assert.equal(order.data.ok,true);
    assert.match(order.data.orderId,/^[0-9a-f-]{36}$/);
    assert.equal(order.data.currency,'eur');
    assert.equal(order.data.amount,2690);
    assert.equal(order.data.state,'pending_payment');
    assert.equal(order.data.clientMutationId,'qa-client-mutation-012345');
    assert.equal(order.data.merchantSlug,'qa-restaurant');
    assert.equal(order.data.paymentIntentId,undefined);
    assert.equal(order.data.clientSecret,undefined);
    assert.equal(reservations.size,1);
    assert.equal(providerCalls,0);
    const replay=await send('order',sign());
    assert.equal(replay.status,201);
    assert.equal(replay.data.orderId,order.data.orderId);
    assert.equal(reservations.size,1);
    assert.equal(providerCalls,0);
    console.log('QA_HTTP_ORDER_RESERVATION_IDEMPOTENT_UUID_SERVER_CANONICAL=PASS');

    const forPayment={...cart,
      orderId:order.data.orderId,
      canonicalQuoteFingerprint:order.data.canonicalQuoteFingerprint,
      canonicalCartFingerprint:order.data.canonicalCartFingerprint,
    };
    const beforeProvider=providerCalls;
    assert.equal((await send('intent',sign(),{...cart,orderId:'DA-OLD-ID'})).status,400);
    assert.equal((await send('intent',sign(),{...forPayment,orderId:crypto.randomUUID()})).status,409);
    assert.equal((await send('intent',sign(),{...forPayment,canonicalQuoteFingerprint:'a'.repeat(64)})).status,409);
    assert.equal((await send('intent',sign(),{...forPayment,canonicalCartFingerprint:'a'.repeat(64)})).status,409);
    assert.equal((await send('intent',sign(),{...forPayment,items:[{id:'rice',quantity:2},{id:'juice',quantity:2}]})).status,409);
    assert.equal(providerCalls,beforeProvider);
    assert.equal(reservations.size,1);
    console.log('QA_HTTP_PAYMENT_REQUIRES_SAME_ORDER_AND_SERVER_QUOTE_NO_SIDE_EFFECTS');

    const success=await send('intent',sign(),forPayment);
    assert.equal(success.status,200,JSON.stringify(success.data));
    assert.equal(success.data.ok,true);
    assert.equal(success.data.orderId,order.data.orderId);
    assert.equal(success.data.currency,'eur');
    assert.equal(success.data.amount,2690);
    assert.equal(success.data.paymentIntentId,pi);
    assert.equal(success.data.clientSecret,pi+'_secret_FAKEONLY');
    assert.equal(success.data.canonicalQuoteFingerprint,order.data.canonicalQuoteFingerprint);
    assert.equal(success.data.canonicalCartFingerprint,order.data.canonicalCartFingerprint);
    assert.equal(observedPrincipal.issuer,issuer);
    assert.equal(observedPrincipal.subject,subject);
    assert.equal(observedQuote.totalMinor,2690);
    assert.equal(providerCalls,beforeProvider+1);
    console.log('QA_HTTP_PAYMENT_SERVER_RESERVED_ORDER_AND_CATALOG_AMOUNT=PASS');

    const providerBefore=providerCalls;
    failStripe=true;
    const failed=await send('intent',sign(),forPayment);
    assert.equal(failed.status,503);
    assert.doesNotMatch(JSON.stringify(failed.data),/SECRET_PROVIDER_INTERNAL_MESSAGE_DO_NOT_EXPOSE/);
    failStripe=false;
    failReserve=true;
    const failedPg=await send('intent',sign(),forPayment);
    assert.equal(failedPg.status,503);
    assert.doesNotMatch(JSON.stringify(failedPg.data),/SECRET_DB_FAULT_NOT_FOR_HTTP/);
    failReserve=false;
    assert.equal(providerCalls,providerBefore+1);
    console.log('QA_HTTP_PAYMENT_PG_PROVIDER_FAILURES=NEVER_LEAK_DETAILS');

    ledger={...ledger,status:'revoked',revokedAtSeconds:now-1};
    assert.equal((await send('order',sign())).status,403);
    assert.equal((await send('intent',sign(),forPayment)).status,403);
    process.env.NODE_ENV='production';
    ledger={...ledger,status:'approved',revokedAtSeconds:null};
    assert.equal((await send('order',sign())).status,503);
    assert.equal((await send('intent',sign(),forPayment)).status,503);
    console.log('QA_HTTP_PAYMENT_REVOKED_AND_PRODUCTION=BLOCKED');
    const appModule=readFileSync('services/api-nest/src/app.module.ts','utf8');
    assert.ok(!appModule.includes('QaIsolatedClientCommerceController'));
    console.log('QA_HTTP_TWO_PHASE_PRODUCTION_APP_MODULE=UNTOUCHED');
  }finally{
    if(app)await app.close();
    if(beforeFlag===undefined)delete process.env.DA_QA_ISOLATED_CLIENT_COMMERCE_ENABLED;
    else process.env.DA_QA_ISOLATED_CLIENT_COMMERCE_ENABLED=beforeFlag;
    if(beforeNodeEnv===undefined)delete process.env.NODE_ENV;
    else process.env.NODE_ENV=beforeNodeEnv;
  }
});
