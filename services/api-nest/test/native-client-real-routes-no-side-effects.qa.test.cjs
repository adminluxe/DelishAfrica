'use strict';
/**
 * QA ONLY. Uses the repository's ACTUAL OrdersController and
 * PaymentsController on an isolated NestJS HTTP server.
 *
 * Original legacy authentication guards are stubbed on purpose: this tests
 * the NATIVE CLIENT admission boundary exclusively, NOT the completed
 * interaction between old and new issuer pipelines. The new guard is applied
 * to the two write methods ONLY in this transient test module.
 *
 * Stripe itself is never loaded or called. The payment service is a counting
 * fake which would record attempted side effects; any denied HTTP request
 * must leave counters, the orders store and payments marker at zero.
 */
const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
require('reflect-metadata');

if (process.env.GITHUB_ACTIONS !== 'true' ||
    process.env.QA_SYNTHETIC_ONLY !== 'YES') {
  throw Error('QA_GUARD_DISCONNECTED_GITHUB_ACTIONS_ONLY');
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(),'da-client-real-routes-'));
const orderStoreFile = path.join(tmp,'orders.json');
const stripeEffectsFile = path.join(tmp,'stripe-effects.json');
process.env.DA_DEMO_ORDERS_STORE_FILE = orderStoreFile;
process.env.DA_PAYMENT_AUTHORITY_STORE_FILE = path.join(tmp,'payments.json');

const {Test} = require('@nestjs/testing');
const {GUARDS_METADATA} = require('@nestjs/common/constants');
const {OrdersController} = require('../src/orders/orders.controller');
const {OrdersAuthGuard} = require('../src/orders/orders.auth.guard');
const {OrdersAccessService} = require('../src/orders/orders.access.service');
const {OrdersDispatchService} = require('../src/orders/orders.dispatch.service');
const {PaymentsController} = require('../src/payments/payments.controller');
const {PaymentsAuthGuard} = require('../src/payments/payments.auth.guard');
const {PaymentsService} = require('../src/payments/payments.service');
const {
  NativeClientNestCommerceGuard,NATIVE_CLIENT_COMMERCE_DEPS,
} = require('../src/auth/native-client-nest-commerce.guard');
const {nativeClientEmailBindingHmac} =
  require('../src/auth/native-client-commerce.policy');
const {listDemoOrders,getDemoOrdersStoreFile} =
  require('../src/orders/orders.demo.store');

const issuer='https://qa-issuer.example.invalid/realms/da-client';
const clientId='delishafrica-client',subject='a63f867f-9f42-4573-9268-dc65a164d2c1';
const email='buyer@example.invalid';
const secret='QA_ONLY_IN_MEMORY_SECRET_'+ 'k'.repeat(48);
const now=Math.floor(Date.now()/1000);
const {privateKey,publicKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'qa-key',
  use:'sig',alg:'RS256'};
const claims={
  iss:issuer,sub:subject,azp:clientId,aud:['account',clientId],
  iat:now-15,exp:now+360,email,email_verified:true,
  realm_access:{roles:['client','default-roles-da-client']},
};
function sign(changes={}){
  const a=Buffer.from(JSON.stringify({alg:'RS256',kid:'qa-key',typ:'at+jwt'})).toString('base64url');
  const b=Buffer.from(JSON.stringify({...claims,...changes})).toString('base64url');
  const encoded=a+'.'+b;
  return encoded+'.'+crypto.sign('RSA-SHA256',Buffer.from(encoded),privateKey)
    .toString('base64url');
}
let ledger=null,pgFails=false,jwksFails=false;
let createInputCalls=0, stripeIntentCalls=0;
let legacyOrdersGuardCalls=0,legacyPaymentsGuardCalls=0;
const principal={
  issuer,subject,clientId,role:'client',authSource:'external',
  ownershipEligible:true,name:'Synthetic buyer',
  expiresAt:new Date((now+360)*1000).toISOString(),
};
const orderAccess={
  principal(request){if(!request.daOrdersPrincipal)throw Error('test_legacy_guard_not_run');return request.daOrdersPrincipal},
  requestedId(body={}){return String(body.id||body.orderId||'')},
  async secureCreateInput(current,body){
    createInputCalls++;
    assert.equal(current.subject,subject);
    return {
      id:body.id, partnerSlug:'qa-merchant',merchantSlug:'qa-merchant',
      total:1200,currency:'EUR',items:[{sku:'qa-menu',quantity:1,price:12}],
      daOwnership:{clientIssuer:issuer,clientSubject:subject},
      payment:{paymentIntentId:'pi_test_fake_NO_STRIPE_NETWORK'},
    };
  },
  async visibleOrders(current){
    if(current.role==='merchant'||current.role==='courier')return [];
    return listDemoOrders();
  },
};
const payments={
  async createPaymentIntent(){
    stripeIntentCalls++;
    fs.writeFileSync(stripeEffectsFile,JSON.stringify({calls:stripeIntentCalls}));
    return {ok:true,provider:'stripe',mode:'test',
      paymentIntentId:'pi_test_mock_no_external_calls'};
  },
};
const mockOldOrdersGuard={
  canActivate(ctx){
    legacyOrdersGuardCalls++;
    const req=ctx.switchToHttp().getRequest();
    const header=String(req.headers.authorization||'');
    req.daOrdersPrincipal=header==='Bearer qa-merchant'?
      {...principal,role:'merchant',subject:'legacy-merchant',issuer:'https://legacy.example.invalid/realms/afritaste'}:
      header==='Bearer qa-courier'?
        {...principal,role:'courier',subject:'legacy-courier',issuer:'https://legacy.example.invalid/realms/afritaste'}:
        principal;
    return true;
  },
};
const mockOldPaymentsGuard={
  canActivate(ctx){
    legacyPaymentsGuardCalls++;
    ctx.switchToHttp().getRequest().daPaymentsPrincipal=principal;
    return true;
  },
};
const deps={
  issuer,clientId,audience:clientId,emailHmacSecret:secret,
  maxTokenLifetimeSeconds:3600,
  async loadTrustedJwks(){
    if(jwksFails)throw Error('QA_FORCED_JWKS_DOWN');
    return {issuer,provenanceVerified:true,keys:[jwk]};
  },
  async readCommittedAdmission(){
    if(pgFails)throw Error('QA_FORCED_PG_DOWN');
    return ledger;
  },
};
const pending=()=>({
  schemaVersion:1,status:'pending',subjectId:subject,
  emailBindingHmac:nativeClientEmailBindingHmac(secret,email),
  smsRecipientHmac:'',smsVerifiedSubjectId:'',
  emailVerifiedSubjectId:'',providerSmsProofAccepted:false,
  providerEmailProofAccepted:false,transactionCommittedAtSeconds:0,
  revokedAtSeconds:null,
});
function effectSnapshot(){
  return {
    orders:listDemoOrders().length,
    created:createInputCalls,stripe:stripeIntentCalls,
    stripeFile:fs.existsSync(stripeEffectsFile),
    orderFile:fs.existsSync(orderStoreFile),
  };
}
test('ACTUAL Nest order/create & payment/create-intent reject before any side effect',async()=>{
  let app;
  const methodTargets=[
    [OrdersController.prototype.create,'orders/create'],
    [PaymentsController.prototype.createIntent,'payments/create-intent'],
  ];
  const original=methodTargets.map(([fn])=>Reflect.getMetadata(GUARDS_METADATA,fn)||[]);
  try{
    // Attach the candidate guard to the ACTUAL methods in this process ONLY.
    for(let i=0;i<methodTargets.length;i++){
      Reflect.defineMetadata(GUARDS_METADATA,
        [...original[i],NativeClientNestCommerceGuard],methodTargets[i][0]);
    }
    const moduleRef=await Test.createTestingModule({
      controllers:[OrdersController,PaymentsController],
      providers:[
        {provide:OrdersAuthGuard,useValue:mockOldOrdersGuard},
        {provide:PaymentsAuthGuard,useValue:mockOldPaymentsGuard},
        {provide:OrdersAccessService,useValue:orderAccess},
        {provide:OrdersDispatchService,useValue:{}},
        {provide:PaymentsService,useValue:payments},
        NativeClientNestCommerceGuard,
        {provide:NATIVE_CLIENT_COMMERCE_DEPS,useValue:deps},
      ],
    }).compile();
    app=moduleRef.createNestApplication({logger:false});
    await app.listen(0,'127.0.0.1');
    const port=app.getHttpServer().address().port;
    const base='http://127.0.0.1:'+port;
    async function post(route,token,body={}){
      const r=await fetch(base+route,{method:'POST',
        signal:AbortSignal.timeout(12000),
        headers:{'content-type':'application/json',
          ...(token?{authorization:'Bearer '+token}:{})},
        body:JSON.stringify(body)});
      const status=r.status;
      await r.arrayBuffer();
      return status;
    }
    const order='/orders/create';
    const payment='/payments/create-intent';
    const payload={id:'DA-QA-ONE',cartFingerprint:'QA-ONLY',
      amount:1200,currency:'EUR',clientMutationId:'QA-MUTATION'};
    const assertNoEffects=()=>{
      assert.deepEqual(effectSnapshot(),{
        orders:0,created:0,stripe:0,stripeFile:false,orderFile:false,
      },'denied request MUST NOT mutate orders, payment file or Stripe intent');
    };
    assertNoEffects();
    for(const route of [order,payment]){
      assert.equal(await post(route,null,payload),401,route+' no auth');
      assertNoEffects();
      assert.equal(await post(route,sign()+'tampered',payload),401,route+' tampered signature');
      assertNoEffects();
      ledger=null;
      assert.equal(await post(route,sign(),payload),403,route+' ledger absent');
      assertNoEffects();
      ledger=pending();
      assert.equal(await post(route,sign(),payload),403,route+' no SMS');
      assertNoEffects();
      assert.equal(await post(route,sign({email_verified:false}),payload),403,route+' email not verified');
      assertNoEffects();
      assert.equal(await post(route,sign({realm_access:{roles:['client','merchant']}}),payload),
        403,route+' role injection');
      assertNoEffects();
      assert.equal(await post(route,sign({iss:'https://legacy.example.invalid/realms/afritaste'}),payload),
        401,route+' wrong issuer');
      assertNoEffects();
      pgFails=true;
      assert.equal(await post(route,sign(),payload),503,route+' PG outage');
      pgFails=false;
      assertNoEffects();
      jwksFails=true;
      assert.equal(await post(route,sign(),payload),503,route+' JWKS outage');
      jwksFails=false;
      assertNoEffects();
    }
    console.log('QA_ACTUAL_WRITE_ROUTES_DENIALS_ZERO_SIDE_EFFECTS=PASS');

    const approved=pending();
    ledger={...approved,status:'approved',
      emailVerifiedSubjectId:subject,smsVerifiedSubjectId:subject,
      smsRecipientHmac:'a'.repeat(64),providerSmsProofAccepted:true,
      providerEmailProofAccepted:true,transactionCommittedAtSeconds:now-5};
    assert.equal(await post(payment,sign(),payload),201);
    assert.equal(stripeIntentCalls,1);
    assert.equal(fs.existsSync(stripeEffectsFile),true);
    assert.equal(await post(order,sign(),payload),201);
    assert.equal(createInputCalls,1);
    assert.equal(listDemoOrders().length,1);
    assert.equal(fs.existsSync(orderStoreFile),true);
    console.log('QA_ACTUAL_WRITE_ROUTES_APPROVED_REACH_ONLY_ISOLATED_STUBS=PASS');

    ledger={...ledger,status:'revoked',revokedAtSeconds:now-1};
    const before=effectSnapshot();
    for(const route of [payment,order]){
      assert.equal(await post(route,sign(),payload),403);
      assert.deepEqual(effectSnapshot(),before,'revoked must not produce additional effects');
    }
    console.log('QA_REVOKED_WRITE_ROUTES_ZERO_ADDITIONAL_SIDE_EFFECTS=PASS');

    // Keep merchant/courier read-route contracts untouched in this QA
    // module. These legacy guard stubs do NOT certify real legacy OIDC.
    const list=async(roleToken)=>{
      const r=await fetch(base+'/orders/list',{method:'POST',
        headers:{'content-type':'application/json',authorization:'Bearer '+roleToken},
        body:'{}',signal:AbortSignal.timeout(8000)});
      await r.arrayBuffer();
      return r.status;
    };
    assert.equal(await list('qa-merchant'),201);
    assert.equal(await list('qa-courier'),201);
    assert(legacyOrdersGuardCalls>0 && legacyPaymentsGuardCalls>0);
    console.log('QA_UNCHANGED_MERCHANT_COURIER_READ_ROUTE_STUBS=PASS');
    console.log('QA_STRIPE_NETWORK_CALLS=ZERO_WITH_COUNTING_STUB');
    console.log('QA_REAL_AUTH_GUARD_CHAIN=NOT_TESTED_ISSUER_BRIDGE_STILL_NO_GO');
    console.log('QA_PRODUCTION_CONTROLLERS=UNMODIFIED');
  }finally{
    if(app)await app.close();
    methodTargets.forEach(([fn],i)=>Reflect.defineMetadata(GUARDS_METADATA,original[i],fn));
    fs.rmSync(tmp,{recursive:true,force:true});
  }
});
