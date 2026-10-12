'use strict';
/**
 * DelishAfrica Merchant/Courier QA-only HTTP contract.
 *
 * ACTUAL OrdersAuthGuard and NestJS controller in an ephemeral loopback server.
 * The signed JWT VERIFIER is represented by a deterministic AuthService stub;
 * this test does not certify cryptographic signatures/JWKS. Identity and
 * membership/roster truth must later be wired to deployed issuer/KYB data.
 * Finance/SQL ports are counting mocks; real PostgreSQL 17 is tested
 * separately with restricted roles. NO Stripe, no VPS, no public AppModule.
 */
const assert=require('node:assert/strict');
const {test}=require('node:test');
const crypto=require('node:crypto');
require('reflect-metadata');
if(process.env.GITHUB_ACTIONS!=='true'||
   process.env.QA_SYNTHETIC_ONLY!=='YES'){
  throw Error('QA_MERCHANT_COURIER_HTTP_ONLY');
}
const {Test}=require('@nestjs/testing');
const {AuthService}=require('../src/auth/auth.service');
const {OrdersAuthGuard}=require('../src/orders/orders.auth.guard');
const {QaMerchantCourierFulfillmentController,
  QA_MERCHANT_COURIER_FULFILLMENT_PORTS,
  QA_MERCHANT_COURIER_ADMISSION_PORTS}=
  require('../src/client-commerce/merchant-courier-fulfillment.qa.controller');
const {QaMerchantCourierFulfillmentPgAdapter}=
  require('../src/client-commerce/merchant-courier-fulfillment.pg-qa.adapter');

const issuer='https://qa.example.invalid/realms/da-merchant';
const courierIssuer='https://qa.example.invalid/realms/da-courier';
const merchantSubject='a63f867f-9f42-4573-9268-dc65a164d2c1';
const courierSubject='c63f867f-9f42-4573-9268-dc65a164d2c3';
const id=crypto.randomUUID();
const principal=(role,subject,iss)=>({
  issuer:iss,subject,role,name:'QA fixture',authSource:'external',
  ownershipEligible:true,expiresAt:new Date(Date.now()+600000).toISOString(),
});
const merchantPrincipal=principal('merchant',merchantSubject,issuer);
const courierPrincipal=principal('courier',courierSubject,courierIssuer);
const devMerchant={...merchantPrincipal,authSource:'dev-login',
  ownershipEligible:false};
const buyer=principal('client',merchantSubject,issuer);
const membership={
  membershipId:'qa-member-001',issuer,subject:merchantSubject,
  partnerId:'partner-qa-001',slug:'qa-restaurant',
  partnerLifecycleStatus:'published',membershipRole:'manager',
  membershipStatus:'active',contractStatus:'active',kybStatus:'verified',
  startsAt:null,expiresAt:null,revokedAt:null,createdAt:'2026-10-12',
  updatedAt:'2026-10-12',accessEligible:true,
};
const roster={issuer:courierIssuer,subject:courierSubject,active:true,
  source:'committed-server-roster'};
let committedMembership={...membership};
let committedRoster={...roster};
let forceMembershipOutage=false,forceRosterOutage=false;
let commerceWrites=0,commerceReads=0,membershipCalls=0,rosterCalls=0;
let financialHold=false;
// Real QA adapter under test; only its PG protocol and merchant registry
// dependencies are synthetic. No live SQL connection or money mutation.
const mockMerchantPool={async query(sql,params){
  if(sql.includes('da_qa_merchant_visible_paid_orders(')){
    commerceReads++;
    assert.deepEqual(params,['qa-restaurant',30]);
    return {rows:[{order_id:id,merchant_slug:'qa-restaurant',
      items:[{sku:'rice',name:'Jollof rice',category:'Menu',quantity:1,
        unitAmountMinor:1500,lineAmountMinor:1500}],
      total_minor:'2690',currency:'EUR',fulfillment_state:'new',
      financial_state:financialHold?'financial_hold':'paid',
      dispatch_eligible:!financialHold}]};
  }
  assert.ok(sql.includes('da_qa_merchant_transition('));
  assert.equal(params[0],id);
  assert.equal(params[1],'qa-restaurant');
  commerceWrites++;
  if(financialHold)throw Error('SECRET_FINANCE_RECORD');
  return {rows:[{state:params[2]}]};
}};
const mockCourierPool={async query(sql,params){
  if(sql.includes('da_qa_courier_assigned_offers(')){
    commerceReads++;
    assert.deepEqual(params,[courierIssuer,courierSubject,20]);
    return {rows:[{order_id:id,merchant_slug:'qa-restaurant',
      delivery_state:'offered',financial_state:financialHold?
        'financial_hold':'paid',action_eligible:!financialHold}]};
  }
  assert.ok(sql.includes('da_qa_courier_transition('));
  assert.deepEqual(params.slice(0,3),[id,courierIssuer,courierSubject]);
  commerceWrites++;
  if(financialHold)throw Error('SECRET_REFUND_DB_INTERNAL');
  return {rows:[{state:params[3]}]};
}};
const mockDispatchPool={async query(){
  throw Error('QA_DISPATCH_PORT_MUST_NOT_BE_ACCESSIBLE_FROM_HTTP');
}};
const commerce=new QaMerchantCourierFulfillmentPgAdapter(
  mockMerchantPool,mockCourierPool,mockDispatchPool);
const adm={
  async readCommittedMerchantMemberships(i,s){
    membershipCalls++;
    if(forceMembershipOutage)throw Error('INTERNAL_PG_MEMBERSHIP_SECRET');
    if(i!==issuer||s!==merchantSubject)return [];
    return committedMembership?[committedMembership]:[];
  },
  async readCommittedCourierRoster(i,s){
    rosterCalls++;
    if(forceRosterOutage)throw Error('INTERNAL_ROSTER_SECRET');
    if(i!==courierIssuer||s!==courierSubject)return null;
    return committedRoster;
  },
};
// Tokens are synthetic AuthService test handles, NOT cryptographic JWTs.
// The actual OrdersAuthGuard processes the mocked resolution.
const tokens=new Map([
  ['qa-merchant',merchantPrincipal],['qa-courier',courierPrincipal],
  ['qa-client',buyer],['qa-dev-merchant',devMerchant],
]);
const auth={
  async resolvePrincipalFromAuthorization(header){
    const token=typeof header==='string'&&header.startsWith('Bearer ')
      ?header.slice(7):'';
    const p=tokens.get(token);
    if(!p)return {ok:false,authenticated:false,
      reason:'invalid_or_expired_token',principal:null};
    return {ok:true,authenticated:true,principal:p,payload:{}};
  },
};
test('isolated Merchant/Courier API requires verified roles, memberships and roster',async()=>{
  let app;
  const savedFlag=process.env.DA_QA_ISOLATED_FULFILLMENT_ENABLED;
  const savedEnv=process.env.NODE_ENV;
  try{
    const mod=await Test.createTestingModule({
      controllers:[QaMerchantCourierFulfillmentController],
      providers:[
        OrdersAuthGuard,{provide:AuthService,useValue:auth},
        {provide:QA_MERCHANT_COURIER_FULFILLMENT_PORTS,useValue:commerce},
        {provide:QA_MERCHANT_COURIER_ADMISSION_PORTS,useValue:adm},
      ],
    }).compile();
    app=mod.createNestApplication({logger:false});
    await app.listen(0,'127.0.0.1');
    const base='http://127.0.0.1:'+
      app.getHttpServer().address().port+'/qa-isolated/fulfillment/';
    async function send(route,token,body={}){
      const res=await fetch(base+route,{method:'POST',
        signal:AbortSignal.timeout(8000),
        headers:{'content-type':'application/json',
          ...(token?{authorization:'Bearer '+token}:{})},
        body:JSON.stringify(body)});
      return {status:res.status,body:await res.json()};
    }
    function noWrites(){assert.equal(commerceWrites,0);}
    const list='merchant/orders/list';
    const change='merchant/orders/transition';
    const offers='courier/offers/list';
    const move='courier/offers/transition';
    process.env.DA_QA_ISOLATED_FULFILLMENT_ENABLED='';
    assert.equal((await send(list,'qa-merchant',{merchantSlug:'qa-restaurant'})).status,503);
    assert.equal((await send(offers,'qa-courier',{})).status,503);
    assert.equal(commerceReads,0);noWrites();
    process.env.DA_QA_ISOLATED_FULFILLMENT_ENABLED='YES';
    process.env.NODE_ENV='test';
    for(const route of [list,change,offers,move]){
      assert.equal((await send(route,null,{})).status,401);
      assert.equal((await send(route,'unverified-bearer',{})).status,401);
      noWrites();
    }
    assert.equal((await send(list,'qa-client',{merchantSlug:'qa-restaurant'})).status,403);
    assert.equal((await send(change,'qa-dev-merchant',
      {merchantSlug:'qa-restaurant',orderId:id,nextStatus:'ready'})).status,403);
    assert.equal((await send(offers,'qa-merchant',{})).status,403);
    assert.equal((await send(change,'qa-courier',
      {merchantSlug:'qa-restaurant',orderId:id,nextStatus:'ready'})).status,403);
    assert.equal((await send(move,'qa-merchant',
      {orderId:id,nextStatus:'accepted'})).status,403);
    noWrites();
    console.log('QA_MERCHANT_COURIER_HTTP_WRONG_ROLE_AND_DEV_LOGIN=DENIED');

    assert.equal((await send(list,'qa-merchant',{merchantSlug:'other-restaurant'})).status,403);
    committedMembership={...membership,contractStatus:'suspended'};
    // The adapter verifies the whole committed membership even when the
    // controller obtained the matching merchant slug from trusted DB.
    assert.equal((await send(list,'qa-merchant',{merchantSlug:'qa-restaurant'})).status,503);
    assert.equal((await send(change,'qa-merchant',
      {orderId:id,merchantSlug:'qa-restaurant',nextStatus:'ready'})).status,503);
    committedMembership={...membership};
    forceMembershipOutage=true;
    assert.equal((await send(list,'qa-merchant',{merchantSlug:'qa-restaurant'})).status,503);
    forceMembershipOutage=false;
    noWrites();
    console.log('QA_MERCHANT_HTTP_UNPAID_KYB_OR_MEMBERSHIP_OUTAGE=FAIL_CLOSED');

    assert.equal((await send(change,'qa-merchant',
      {merchantSlug:'qa-restaurant',orderId:'DA-LOCAL-ID',nextStatus:'ready'})).status,400);
    assert.equal((await send(change,'qa-merchant',
      {merchantSlug:'qa-restaurant',orderId:id,nextStatus:'delivered'})).status,400);
    assert.equal((await send(move,'qa-courier',
      {orderId:id,nextStatus:'ready'})).status,400);
    noWrites();

    const inbox=await send(list,'qa-merchant',
      {merchantSlug:'qa-restaurant',role:'ops',paid:true});
    assert.equal(inbox.status,200);
    assert.equal(inbox.body.count,1);
    assert.equal(inbox.body.orders[0].orderId,id);
    assert.equal((await send(change,'qa-merchant',
      {merchantSlug:'qa-restaurant',orderId:id,nextStatus:'accepted'})).status,200);
    assert.equal((await send(change,'qa-merchant',
      {merchantSlug:'qa-restaurant',orderId:id,nextStatus:'ready'})).status,200);
    assert.equal(commerceWrites,2);
    console.log('QA_MERCHANT_HTTP_COMMITTED_MEMBERSHIP_ORDER_INBOX_ACCEPT_READY=PASS');

    committedRoster=null;
    assert.equal((await send(offers,'qa-courier',{})).status,403);
    committedRoster={...roster};
    forceRosterOutage=true;
    assert.equal((await send(move,'qa-courier',
      {orderId:id,nextStatus:'accepted'})).status,503);
    forceRosterOutage=false;
    assert.equal((await send(offers,'qa-courier',{})).status,200);
    assert.equal((await send(move,'qa-courier',
      {orderId:id,nextStatus:'accepted'})).status,200);
    financialHold=true;
    const held=await send(offers,'qa-courier',{});
    assert.equal(held.status,200);
    assert.equal(held.body.offers[0].actionEligible,false);
    const denied=await send(move,'qa-courier',
      {orderId:id,nextStatus:'picked_up'});
    assert.equal(denied.status,503);
    assert.ok(!JSON.stringify(denied.body).includes('SECRET_REFUND'));
    console.log('QA_COURIER_HTTP_ASSIGNED_ROSTER_LATE_REFUND=FAIL_CLOSED');

    financialHold=false;
    process.env.NODE_ENV='production';
    assert.equal((await send(list,'qa-merchant',
      {merchantSlug:'qa-restaurant'})).status,503);
    assert.equal((await send(move,'qa-courier',
      {orderId:id,nextStatus:'accepted'})).status,503);
    console.log('QA_MERCHANT_COURIER_CONTROLLER_NOT_LOADED_IN_PROD_FLAG=PASS');
  }finally{
    if(savedFlag===undefined)delete process.env.DA_QA_ISOLATED_FULFILLMENT_ENABLED;
    else process.env.DA_QA_ISOLATED_FULFILLMENT_ENABLED=savedFlag;
    if(savedEnv===undefined)delete process.env.NODE_ENV;
    else process.env.NODE_ENV=savedEnv;
    if(app)await app.close();
  }
});
