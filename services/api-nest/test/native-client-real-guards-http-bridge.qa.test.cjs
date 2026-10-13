'use strict';
/**
 * DelishAfrica P0: actual OrdersController/PaymentsController plus their REAL
 * OrdersAuthGuard and PaymentsAuthGuard, with a synthetic-only optional bridge.
 * The only service doubles are external side effects (Stripe/catalog/dispatch)
 * and the isolated JWT-key + committed-admission providers. No Stripe network,
 * production database, real identities or historical realm are contacted.
 * THIS IS A QA CERTIFICATE, NOT A PRODUCTION RELEASE.
 */
const assert = require('node:assert/strict');
const {test} = require('node:test');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

if (process.env.GITHUB_ACTIONS !== 'true' ||
    process.env.QA_SYNTHETIC_ONLY !== 'YES') {
  throw Error('QA_REAL_GUARDS_REQUIRES_DISCONNECTED_GITHUB_ACTIONS');
}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'da-dual-issuer-http-'));
const orderFile=path.join(tmp,'orders.json');
const paymentFile=path.join(tmp,'payment-side-effects.json');
process.env.DA_DEMO_ORDERS_STORE_FILE=orderFile;
process.env.DA_PAYMENT_AUTHORITY_STORE_FILE=path.join(tmp,'payment-authority.json');

// The repo's legacy catalog imports its deployed absolute PostgreSQL path
// at module load. Block construction instead of connecting to a real DB.
const loadOriginal=Module._load;
Module._load=function(request,parent,isMain) {
  if(typeof request==='string' &&
     request.replaceAll('\\','/').endsWith(
       '/.runtime-vendor/pg-runtime/node_modules/pg')) {
    return {Pool:class ForbiddenQaPgPool {
      constructor(){throw Error('QA_UNEXPECTED_REAL_POSTGRES_CONNECTION');}
    }};
  }
  return loadOriginal.apply(this,arguments);
};
let imports={};
try {
  const {Test}=require('@nestjs/testing');
  const {AuthService}=require('../src/auth/auth.service');
  const {ExternalJwksVerifierService}=require('../src/auth/external-jwks-verifier.service');
  const {OrdersController}=require('../src/orders/orders.controller');
  const {OrdersAuthGuard}=require('../src/orders/orders.auth.guard');
  const {OrdersAccessService}=require('../src/orders/orders.access.service');
  const {OrdersDispatchService}=require('../src/orders/orders.dispatch.service');
  const {PaymentsController}=require('../src/payments/payments.controller');
  const {PaymentsAuthGuard}=require('../src/payments/payments.auth.guard');
  const {PaymentsService}=require('../src/payments/payments.service');
  const {
    NativeClientNestCommerceGuard,
    NATIVE_CLIENT_ADMISSION_CONTEXT,
  }=require('../src/auth/native-client-nest-commerce.guard');
  const {NativeClientCommerceIssuerBridge}=
    require('../src/auth/native-client-commerce-issuer-bridge');
  const {nativeClientEmailBindingHmac}=
    require('../src/auth/native-client-commerce.policy');
  const {listDemoOrders}=require('../src/orders/orders.demo.store');
  imports={Test,AuthService,ExternalJwksVerifierService,
    OrdersController,OrdersAuthGuard,OrdersAccessService,
    OrdersDispatchService,PaymentsController,PaymentsAuthGuard,PaymentsService,
    NativeClientNestCommerceGuard,NativeClientCommerceIssuerBridge,
    NATIVE_CLIENT_ADMISSION_CONTEXT,nativeClientEmailBindingHmac,
    listDemoOrders};
} finally {Module._load=loadOriginal;}
const {
  Test,AuthService,ExternalJwksVerifierService,
  OrdersController,OrdersAuthGuard,OrdersAccessService,
  OrdersDispatchService,PaymentsController,PaymentsAuthGuard,PaymentsService,
  NativeClientNestCommerceGuard,NativeClientCommerceIssuerBridge,
  NATIVE_CLIENT_ADMISSION_CONTEXT,nativeClientEmailBindingHmac,listDemoOrders,
}=imports;

test('actual Nest HTTP routes: real legacy and native guards, zero unauthorized effects',async()=>{
  let app;
  const now=Math.floor(Date.now()/1000);
  const legacyIssuer='https://legacy.qa.invalid/realms/afritaste';
  const nativeIssuer='https://native.qa.invalid/realms/da-client';
  const subject='a63f867f-9f42-4573-9268-dc65a164d2c1';
  const email='qa-buyer@example.invalid';
  const hmac='qa-only-email-hmac-secret-'+('k'.repeat(48));
  const oldKeys=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
  const newKeys=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
  let ledger=null,pgUnavailable=false,jwksUnavailable=false;
  let created=0,paid=0,legacyList=0;
  const mkJwt=(privateKey,claims)=>{
    const h=Buffer.from(JSON.stringify({
      alg:'RS256',kid:'same-kid-different-key',typ:'at+jwt',
    })).toString('base64url');
    const p=Buffer.from(JSON.stringify(claims)).toString('base64url');
    const data=h+'.'+p;
    return data+'.'+crypto.sign('RSA-SHA256',Buffer.from(data),privateKey)
      .toString('base64url');
  };
  const mkOld=(role,key=oldKeys.privateKey,issuer=legacyIssuer)=>{
    const aud=role==='ops'
      ?'delishafrica-master-dashboard'
      :role==='courier'?'delishafrica-courier':'delishafrica-merchant';
    return mkJwt(key,{
      iss:issuer,sub:subject+'-'+role,
      iat:now-12,exp:now+240,azp:aud,aud:['account',aud],
      realm_access:{roles:role==='ops'?[]:[role]},
      ...(role==='ops'?{
        resource_access:{'delishafrica-master-dashboard':{roles:['ops']}}
      }:{}),
    });
  };
  const nativeClaims={
    iss:nativeIssuer,sub:subject,azp:'delishafrica-client',
    aud:['account','delishafrica-client'],
    iat:now-10,exp:now+240,email,email_verified:true,
    realm_access:{roles:['client','default-roles-da-client']},
  };
  const mkNative=(changes={},key=newKeys.privateKey)=>
    mkJwt(key,{...nativeClaims,...changes});
  const oldVerifier=Object.create(ExternalJwksVerifierService.prototype);
  oldVerifier.config={
    issuer:legacyIssuer,audience:'delishafrica-merchant',
    merchantRealmRoles:['merchant'],merchantClientRoles:['merchant'],
    clockSkewSeconds:5,
  };
  oldVerifier.keys=new Map([['same-kid-different-key',{
    kid:'same-kid-different-key',alg:'RS256',key:oldKeys.publicKey,
  }]]);
  oldVerifier.ready=true;
  oldVerifier.refreshKeys=async()=>{throw Error('QA_LEGACY_JWKS_NETWORK_FORBIDDEN');};
  const auth=new AuthService(oldVerifier);
  const deps={
    issuer:nativeIssuer,clientId:'delishafrica-client',
    audience:'delishafrica-client',
    emailHmacSecret:hmac,maxTokenLifetimeSeconds:3600,
    async loadTrustedJwks(){
      if(jwksUnavailable)throw Error('QA_NATIVE_JWKS_FORCED_DOWN');
      return {issuer:nativeIssuer,provenanceVerified:true,
        keys:[{...newKeys.publicKey.export({format:'jwk'}),
          kid:'same-kid-different-key',use:'sig',alg:'RS256'}]};
    },
    async readCommittedAdmission(issuer,sub){
      assert.equal(issuer,nativeIssuer);assert.equal(sub,subject);
      if(pgUnavailable)throw Error('QA_POSTGRES_ADMISSION_UNAVAILABLE');
      return ledger;
    },
  };
  const nativeGuard=new NativeClientNestCommerceGuard(deps);
  const bridge=new NativeClientCommerceIssuerBridge(nativeGuard,deps);
  const mockOrderAccess={
    principal(req){
      assert(req.daOrdersPrincipal);
      return req.daOrdersPrincipal;
    },
    requestedId(body={}){return String(body.id||body.orderId||'')},
    async secureCreateInput(principal,body){
      created++;
      assert.equal(principal.role,'client');
      assert.equal(principal.issuer,nativeIssuer);
      assert.equal(principal.subject,subject);
      assert.equal(principal.authSource,'external');
      assert.equal(principal.ownershipEligible,true);
      assert.equal(principal.email,email);
      assert(Date.parse(principal.expiresAt)>Date.now());
      return {
        id:body.id,partnerSlug:'qa-merchant',merchantSlug:'qa-merchant',
        total:1200,currency:'EUR',
        items:[{sku:'qa-menu',quantity:1,price:12}],
        daOwnership:{clientIssuer:principal.issuer,clientSubject:principal.subject},
        payment:{paymentIntentId:'pi_test_fake_NO_STRIPE_NETWORK'},
      };
    },
    async visibleOrders(principal,orders){
      legacyList++;
      assert(['merchant','courier','ops','client'].includes(principal.role));
      return [];
    },
  };
  const mockPayments={
    async createPaymentIntent(body,key,principal){
      paid++;
      assert.equal(principal.role,'client');
      assert.equal(principal.issuer,nativeIssuer);
      assert.equal(principal.subject,subject);
      assert.equal(principal.authSource,'external');
      assert.equal(principal.email,email);
      fs.writeFileSync(paymentFile,JSON.stringify({calls:paid}),{mode:0o600});
      return {ok:true,mode:'mock',provider:'stripe',paymentIntentId:
        'pi_test_fake_NO_STRIPE_NETWORK'};
    },
  };
  const safeEffects=()=>({
    created,paid,orderCount:listDemoOrders().length,
    paymentFile:fs.existsSync(paymentFile),orderFile:fs.existsSync(orderFile),
  });
  const untouched={created:0,paid:0,orderCount:0,
    paymentFile:false,orderFile:false};
  const pending=()=>({
    schemaVersion:1,status:'pending',subjectId:subject,
    emailVerifiedSubjectId:'',smsVerifiedSubjectId:'',
    emailBindingHmac:nativeClientEmailBindingHmac(hmac,email),
    smsRecipientHmac:'',providerEmailProofAccepted:false,
    providerSmsProofAccepted:false,transactionCommittedAtSeconds:0,
    revokedAtSeconds:null,
  });
  try {
    const mod=await Test.createTestingModule({
      controllers:[OrdersController,PaymentsController],
      providers:[
        {provide:AuthService,useValue:auth},
        {provide:OrdersAccessService,useValue:mockOrderAccess},
        {provide:OrdersDispatchService,useValue:{}},
        {provide:PaymentsService,useValue:mockPayments},
        OrdersAuthGuard,
        PaymentsAuthGuard,
        {provide:NativeClientCommerceIssuerBridge,useValue:bridge},
      ],
    }).compile();
    // Explicitly verify the REAL guard classes received the QA-only bridge.
    assert(mod.get(OrdersAuthGuard) instanceof OrdersAuthGuard);
    assert(mod.get(PaymentsAuthGuard) instanceof PaymentsAuthGuard);
    app=mod.createNestApplication({logger:false});
    await app.listen(0,'127.0.0.1');
    const address=app.getHttpServer().address();
    assert.equal(address.address,'127.0.0.1');
    const url='http://127.0.0.1:'+address.port;
    const post=async(route,token,body={})=>{
      const response=await fetch(url+route,{
        method:'POST',redirect:'error',signal:AbortSignal.timeout(9000),
        headers:{'content-type':'application/json',
          ...(token?{authorization:'Bearer '+token}:{})},
        body:JSON.stringify(body),
      });
      await response.arrayBuffer();
      return response.status;
    };
    const routes=['/orders/create','/payments/create-intent'];
    const body={id:'QA-BRIDGE-ORDER-ONE',cartFingerprint:'QA',total:1200};
    assert.deepEqual(safeEffects(),untouched);
    const oldStatuses=[];
    for(const role of ['merchant','courier','ops']){
      assert.equal(await post('/orders/list',mkOld(role)),201,role+' legacy list');
      oldStatuses.push(role);
      assert.equal(await post('/payments/create-intent',mkOld(role),body),403,
        role+' cannot create client PaymentIntent');
      assert.deepEqual(safeEffects(),untouched);
    }
    assert.equal(legacyList,3);
    console.log('QA_REAL_LEGACY_MERCHANT_COURIER_OPS_GUARD_HTTP=PASS');
    for(const route of routes) {
      assert.equal(await post(route,null,body),401);
      assert.equal(await post(route,mkNative()+'x',body),401);
      assert.equal(await post(route,mkNative({},oldKeys.privateKey),body),401,
        'same kid but wrong pinned RSA key');
      assert.equal(await post(route,mkOld('merchant',newKeys.privateKey),body),401,
        'same kid but wrong legacy pinned RSA key');
      assert.equal(await post(route,mkNative({email_verified:false}),body),403);
      assert.equal(await post(route,mkNative({
        realm_access:{roles:['client','merchant']}
      }),body),403);
      assert.equal(await post(route,mkNative({
        aud:['account','delishafrica-client','delishafrica-merchant'],
      }),body),401);
      assert.equal(await post(route,mkNative({
        iss:legacyIssuer
      }),body),401);
      ledger=null;
      assert.equal(await post(route,mkNative(),body),403);
      ledger=pending();
      assert.equal(await post(route,mkNative(),body),403);
      pgUnavailable=true;
      assert.equal(await post(route,mkNative(),body),503);
      pgUnavailable=false;
      jwksUnavailable=true;
      assert.equal(await post(route,mkNative(),body),503);
      jwksUnavailable=false;
      assert.deepEqual(safeEffects(),untouched,
        route+' unauthorized request produced side effects');
    }
    console.log('QA_REAL_NEST_DUAL_ISSUER_DENIALS_ZERO_EFFECTS=PASS');
    const approved=pending();
    ledger={...approved,status:'approved',
      emailVerifiedSubjectId:subject,smsVerifiedSubjectId:subject,
      providerEmailProofAccepted:true,providerSmsProofAccepted:true,
      smsRecipientHmac:'a'.repeat(64),
      transactionCommittedAtSeconds:now-5};
    assert.equal(await post('/payments/create-intent',mkNative(),body),201);
    assert.equal(paid,1);
    assert.equal(await post('/orders/create',mkNative(),body),201);
    assert.equal(created,1);
    assert.equal(listDemoOrders().length,1);
    assert(fs.existsSync(paymentFile));
    assert(fs.existsSync(orderFile));
    console.log('QA_REAL_NEST_NATIVE_APPROVED_REACHES_COUNTING_STUBS_ONLY=PASS');
    ledger={...ledger,status:'revoked',revokedAtSeconds:now-1};
    const after=safeEffects();
    for(const route of routes){
      assert.equal(await post(route,mkNative(),body),403);
      assert.deepEqual(safeEffects(),after);
    }
    console.log('QA_REAL_NEST_NATIVE_REVOKED_NO_ADDITIONAL_EFFECTS=PASS');
    console.log('QA_STRIPE_NETWORK_CALLS=ZERO');
    console.log('QA_HISTORICAL_REALM_MUTATIONS=NONE');
    console.log('QA_PRODUCTION_MODULES=UNCHANGED_NATIVE_BRIDGE_OPTIONAL');
    console.log('QA_PUBLIC_CLIENT_ENROLLMENT=NO_GO');
  } finally {
    if(app)await app.close();
    fs.rmSync(tmp,{recursive:true,force:true});
  }
});
