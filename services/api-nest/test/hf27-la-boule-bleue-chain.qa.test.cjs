'use strict';
// HF27 isolated QA: real Nest auth/orders/dispatch classes, no DB, live payment, or user tokens.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'da-hf27-lbb-'));
process.env.DA_DEMO_ORDERS_STORE_FILE = path.join(tmp, 'orders-qa.json');
process.env.DA_COURIER_PRESENCE_STORE_FILE = path.join(tmp, 'presence-qa.json');
process.env.DA_INTERNAL_AUTH_ENABLED = 'false';

const Module = require('node:module');
const oldLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (/\.runtime-vendor[\\/]pg-runtime[\\/]node_modules[\\/]pg$/.test(request))
    return { Pool: class FORBIDDEN_HF27_DB { constructor() { throw Error('NO_REAL_DATABASE_IN_HF27'); } } };
  return oldLoad.call(this, request, parent, isMain);
};
let AuthService, ExternalJwksVerifierService, OrdersAuthGuard, OrdersController;
let OrdersAccessService, OrdersDispatchService, CourierPresenceService;
let FinancialStateRepository, CatalogFoundationService, CatalogOrderPolicyService, PaymentsService, Test;
let resetDemoOrders;
try {
  require('reflect-metadata');
  ({ AuthService } = require('../dist/auth/auth.service.js'));
  ({ ExternalJwksVerifierService } = require('../dist/auth/external-jwks-verifier.service.js'));
  ({ OrdersAuthGuard } = require('../dist/orders/orders.auth.guard.js'));
  ({ OrdersController } = require('../dist/orders/orders.controller.js'));
  ({ OrdersAccessService } = require('../dist/orders/orders.access.service.js'));
  ({ OrdersDispatchService } = require('../dist/orders/orders.dispatch.service.js'));
  ({ CourierPresenceService } = require('../dist/orders/courier-presence.service.js'));
  ({ FinancialStateRepository } = require('../dist/financial-state/financial-state.repository.js'));
  ({ CatalogFoundationService } = require('../dist/catalog-foundation/catalog-foundation.service.js'));
  ({ CatalogOrderPolicyService } = require('../dist/order-policy/catalog-order-policy.service.js'));
  ({ PaymentsService } = require('../dist/payments/payments.service.js'));
  ({ resetDemoOrders } = require('../dist/orders/orders.demo.store.js'));
  ({ Test } = require('@nestjs/testing'));
} finally {
  Module._load = oldLoad;
}
const ISSUER = 'https://keycloak.afritaste.delishafrica.me/realms/afritaste';
const SLUG = 'la-boule-bleue';
const MERCHANT = 'delishafrica-merchant';
const CLIENT = 'delishafrica-client';
const COURIER = 'delishafrica-courier';
const OPS = 'delishafrica-master-dashboard';
const TEMP_SUBJECT = { client:'hf27-qa-client', foreign:'hf27-foreign-client',
  merchant:'hf27-qa-owner', otherMerchant:'hf27-other-merchant',
  courier:'hf27-qa-rider', otherCourier:'hf27-other-rider', ops:'hf27-qa-ops' };
const keys = crypto.generateKeyPairSync('rsa',{modulusLength:2048});

function jwt(role,subject) {
  const now=Math.floor(Date.now()/1000);
  const config={
    client: {aud:CLIENT,azp:CLIENT,realm_access:{roles:['client']},sid:'hf27-qa-sid'},
    merchant: {aud:[CLIENT,MERCHANT],azp:'afritaste-mobile',realm_access:{roles:['merchant']}},
    courier: {aud:COURIER,azp:COURIER,realm_access:{roles:['courier']}},
    ops: {aud:OPS,azp:OPS,resource_access:{[OPS]:{roles:['ops']}}},
  }[role];
  const payload={iss:ISSUER,sub:subject,iat:now-15,exp:now+900,...config};
  const h=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT',kid:'hf27-ephemeral'})).toString('base64url');
  const p=Buffer.from(JSON.stringify(payload)).toString('base64url');
  const plain=h+'.'+p;
  return plain+'.'+crypto.sign('RSA-SHA256',Buffer.from(plain,'ascii'),keys.privateKey).toString('base64url');
}
function verifier() {
  const v=Object.create(ExternalJwksVerifierService.prototype);
  v.config={issuer:ISSUER,audience:MERCHANT,merchantRealmRoles:['merchant',MERCHANT],
    merchantClientRoles:['merchant'],clockSkewSeconds:30};
  v.keys=new Map([['hf27-ephemeral',{kid:'hf27-ephemeral',alg:'RS256',key:keys.publicKey}]]);
  v.ready=true;
  v.refreshKeys=async()=>{};
  return v;
}

test('HF27 La Boule Bleue: isolated Client > Merchant > Courier > ATM one-order truth',async()=>{
  // This is a QA-only quotation fixture, NOT a real menu item or financially verified order.
  let partner={slug:SLUG,name:'La Boule Bleue',status:'pending_verification',
    acceptingOrders:false,delivery:{enabled:true,deliveryFee:200,minimumOrderAmount:1000},
    menuItems:[{sku:'HF27-QA-NOT-A-REAL-MENU-ITEM',name:'Synthetic QA meal',
      amount:7000,category:'QA',day:null}]};
  const owners=[{slug:SLUG,partnerId:'hf27-qa-tenant',ownershipRole:'owner'}];
  let membershipEligible=false;
  let membershipOverride={};
  let membershipRowsPresent=true;
  const catalog={
    findPublishedBySlug:async slug=>slug===SLUG?partner:null,
    listOwnedBySubject:async subject=>subject===TEMP_SUBJECT.merchant?owners:[],
    listMerchantMembershipsBySubject:async(issuer,subject)=>membershipRowsPresent?[{
      issuer,subject,partnerId:'hf27-qa-tenant',slug:SLUG,
      membershipStatus:membershipEligible?'active':'pending',
      contractStatus:membershipEligible?'active':'pending',
      kybStatus:membershipEligible?'verified':'pending',
      accessEligible:membershipEligible,partnerLifecycleStatus:'published',
      revokedAt:null,startsAt:null,expiresAt:null,membershipRole:'owner',
      ...membershipOverride,
    }]:[],
  };
  const orderPolicy=new CatalogOrderPolicyService(catalog);
  const payments={authorizedQuoteForInput:async()=>null,
    verifyPaidOrder:async()=>({paymentIntentId:'HF27-QA-NONLIVE-PAYMENT-DOUBLE',
      mode:'synthetic-qa-only'})};
  const persistent=new Map();
  const financial={
    findOrder:async id=>persistent.get(String(id))||null,
    listOrders:async()=>Array.from(persistent.values()),
    upsertOrder:async o=>{persistent.set(String(o.orderId||o.id),JSON.parse(JSON.stringify(o)));return o;},
    resetOrders:async()=>{persistent.clear();},
  };
  const auth=new AuthService(verifier());
  // This test avoids Redis/network. Client revocation itself is NOT certified by this fixture.
  auth.checkExternalClientRevocation=async()=>({ok:true,revoked:false});
  const access=new OrdersAccessService(catalog,orderPolicy,payments);
  const presence=new CourierPresenceService();
  const dispatch=new OrdersDispatchService(presence,access,financial);
  const guard=new OrdersAuthGuard(auth);
  const mod=await Test.createTestingModule({
    controllers:[OrdersController],
    providers:[
      {provide:AuthService,useValue:auth},
      {provide:CatalogFoundationService,useValue:catalog},
      {provide:CatalogOrderPolicyService,useValue:orderPolicy},
      {provide:PaymentsService,useValue:payments},
      {provide:OrdersAccessService,useValue:access},
      {provide:CourierPresenceService,useValue:presence},
      {provide:FinancialStateRepository,useValue:financial},
      {provide:OrdersDispatchService,useValue:dispatch},
      {provide:OrdersAuthGuard,useValue:guard},
    ],
  }).compile();
  const app=mod.createNestApplication({logger:false});
  app.setGlobalPrefix('api/v1');
  await app.listen(0,'127.0.0.1');
  const port=app.getHttpServer().address().port;
  const actors={
    client:jwt('client',TEMP_SUBJECT.client),
    foreignClient:jwt('client',TEMP_SUBJECT.foreign),
    merchant:jwt('merchant',TEMP_SUBJECT.merchant),
    otherMerchant:jwt('merchant',TEMP_SUBJECT.otherMerchant),
    courier:jwt('courier',TEMP_SUBJECT.courier),
    otherCourier:jwt('courier',TEMP_SUBJECT.otherCourier),
    ops:jwt('ops',TEMP_SUBJECT.ops),
  };
  async function post(endpoint,actor,body={}) {
    const headers={'content-type':'application/json'};
    if(actor)headers.authorization='Bearer '+actors[actor];
    const response=await fetch('http://127.0.0.1:'+port+'/api/v1/orders/'+endpoint,
      {method:'POST',headers,body:JSON.stringify(body)});
    const json=await response.json().catch(()=>({}));
    return {status:response.status,body:json};
  }
  const input={id:'HF27-QA-LBB-'+crypto.randomUUID(),partnerSlug:SLUG,merchantSlug:SLUG,
    items:[{sku:'HF27-QA-NOT-A-REAL-MENU-ITEM',quantity:1}],
    deliveryCity:'Ixelles',countryCode:'BE',customerName:'Synthetic QA only',
    deliveryAddress:'QA-only non-deliverable address'};
  try{
    resetDemoOrders();
    assert.equal((await post('create',null,input)).status,401);
    assert.equal((await post('create','merchant',input)).status,403);
    const pending=await post('create','client',input);
    assert.equal(pending.status,400,JSON.stringify(pending.body));
    assert.equal(pending.body.code,'partner_not_orderable');
    assert.equal(persistent.size,0,'closed partner must not create orders');
    // Stage 1: even with active status, acceptingOrders=false must block new orders.
    partner={...partner,status:'active',acceptingOrders:false};
    const disabledSwitch=await post('create','client',input);
    assert.equal(disabledSwitch.status,400,JSON.stringify(disabledSwitch.body));
    assert.equal(disabledSwitch.body.code,'partner_not_orderable');
    assert.equal(persistent.size,0);
    // Stage 2: memory-only switch for QA simulation, never production.
    partner={...partner,acceptingOrders:true};
    const created=await post('create','client',input);
    assert.equal(created.status,201,JSON.stringify(created.body));
    assert.equal(created.body.id,input.id);
    assert.equal(created.body.order.partnerSlug,SLUG);
    assert.equal(created.body.order.status,'pending');
    assert.equal(created.body.idempotentReplay,false);
    const replay=await post('create','client',input);
    assert.equal(replay.status,201);
    assert.equal(replay.body.idempotentReplay,true);
    assert.equal(persistent.size,1);
    assert.equal((await post('get','foreignClient',{id:input.id})).status,404);
    assert.equal((await post('status','client',{id:input.id,status:'ready'})).status,403);
    const merchantList=await post('list','merchant',{merchantSlug:SLUG});
    assert.equal(merchantList.status,201,JSON.stringify(merchantList.body));
    assert.equal(merchantList.body.count,1);
    assert.equal(merchantList.body.orders[0].orderId,input.id);
    assert.equal((await post('list','otherMerchant',{merchantSlug:SLUG})).status,403);
    // RED-first: owning a venue must not authorize fulfillment when contract/KYB are pending.
    const pendingMembership=await post('status','merchant',{id:input.id,status:'accepted'});
    assert.equal(pendingMembership.status,403,JSON.stringify(pendingMembership.body));
    membershipEligible=true;
    // HF28 Thieyp regression: authenticated Merchant and ownership, but no
    // membership for the same Keycloak subject, must never fulfill an order.
    membershipRowsPresent=false;
    const noMatchingMembership=await post('status','merchant',{id:input.id,status:'accepted'});
    assert.equal(noMatchingMembership.status,403,JSON.stringify(noMatchingMembership.body));
    membershipRowsPresent=true;
    // Fail-closed regression matrix: no cross-tenant, inactive, revoked or bad KYB fulfillment.
    const badMemberships=[
      {partnerId:'hf27-unrelated-tenant'},
      {issuer:'https://untrusted.invalid/realms/other'},
      {subject:'hf27-unrelated-subject'},
      {membershipStatus:'suspended'},
      {contractStatus:'suspended'},
      {kybStatus:'rejected'},
      {revokedAt:'2026-11-01T00:00:00.000Z'},
      {partnerLifecycleStatus:'suspended'},
      {accessEligible:false},
    ];
    for(const patch of badMemberships){
      membershipOverride=patch;
      const refused=await post('status','merchant',{id:input.id,status:'accepted'});
      assert.equal(refused.status,403,JSON.stringify({patch,result:refused.body}));
    }
    membershipOverride={};

    for(const state of ['accepted','ready']){
      const r=await post('status','merchant',{id:input.id,status:state});
      assert.equal(r.status,201,JSON.stringify(r.body));
      assert.equal(r.body.order.orderId,input.id);
      assert.equal(r.body.status,state);
    }
    assert.equal((await post('courier/offers','courier')).body.count,0,
      'no offer before the courier goes online');
    const online=await post('courier/presence','courier',{online:true,city:'Ixelles',
      activeZone:'Ixelles',countryCode:'BE',capacity:1,name:'QA rider'});
    assert.equal(online.status,201,JSON.stringify(online.body));
    const offers=await post('courier/offers','courier');
    assert.equal(offers.status,201,JSON.stringify(offers.body));
    assert.equal(offers.body.count,1);
    assert.equal(offers.body.orders[0].orderId,input.id);
    assert.equal(offers.body.orders[0].assignmentProposal.status,'proposed');
    assert.equal((await post('courier/offers','otherCourier')).body.count,0);
    assert.equal((await post('courier/offers/accept','otherCourier',{id:input.id})).status,404);
    const accepted=await post('courier/offers/accept','courier',{id:input.id});
    assert.equal(accepted.status,201);
    assert.equal(accepted.body.proposal.status,'accepted');
    for(const state of ['picked_up','delivered']){
      const r=await post('status','courier',{id:input.id,status:state});
      assert.equal(r.status,201,JSON.stringify(r.body));
      assert.equal(r.body.order.orderId,input.id);
      assert.equal(r.body.status,state);
    }
    for(const actor of ['ops','client','merchant','courier']){
      const r=await post('get',actor,{id:input.id});
      assert.equal(r.status,201,actor+' '+JSON.stringify(r.body));
      assert.equal(r.body.order.orderId,input.id,actor);
      assert.equal(r.body.order.partnerSlug,SLUG,actor);
      assert.equal(r.body.order.status,'delivered',actor);
    }
    assert.equal((await post('get','otherMerchant',{id:input.id})).status,403);
    const ops=await post('list','ops',{merchantSlug:SLUG});
    assert.equal(ops.status,201);
    assert.equal(ops.body.count,1);
    assert.equal(ops.body.orders[0].orderId,input.id);
    assert.equal(persistent.get(input.id).status,'delivered');
    assert.equal(persistent.size,1);
  } finally{
    await app.close();
    delete process.env.DA_DEMO_ORDERS_STORE_FILE;
    delete process.env.DA_COURIER_PRESENCE_STORE_FILE;
    delete process.env.DA_INTERNAL_AUTH_ENABLED;
    fs.rmSync(tmp,{recursive:true,force:true});
  }
});
