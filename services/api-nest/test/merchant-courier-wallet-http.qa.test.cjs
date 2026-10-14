'use strict';
/**
 * Isolated finance read API test; actual Nest HTTP, OrdersAuthGuard, actual
 * QA wallet adapter. Deterministic AuthService and PostgreSQL ports STUBBED.
 * Real PostgreSQL17 monetary assertions live in the separate SQL workflow.
 */
const assert=require('node:assert/strict');
const {test}=require('node:test');
const crypto=require('node:crypto');
require('reflect-metadata');
if(process.env.GITHUB_ACTIONS!=='true'||
   process.env.QA_SYNTHETIC_ONLY!=='YES'){
  throw Error('QA_WALLET_HTTP_DISCONNECTED_ONLY');
}
const {Test}=require('@nestjs/testing');
const {AuthService}=require('../src/auth/auth.service');
const {OrdersAuthGuard}=require('../src/orders/orders.auth.guard');
const {QaMerchantCourierWalletController,
  QA_MERCHANT_COURIER_WALLET_PORTS}=
  require('../src/client-commerce/merchant-courier-wallet.qa.controller');
const {QA_MERCHANT_COURIER_ADMISSION_PORTS}=
  require('../src/client-commerce/merchant-courier-fulfillment.qa.controller');
const {QaMerchantCourierWalletPgAdapter}=
  require('../src/client-commerce/merchant-courier-wallet.pg-qa.adapter');

const merchantIssuer='https://qa.example.invalid/realms/da-merchant';
const courierIssuer='https://qa.example.invalid/realms/da-courier';
const msub='b63f867f-9f42-4573-9268-dc65a164d2c2';
const csub='c63f867f-9f42-4573-9268-dc65a164d2c3';
const orderId=crypto.randomUUID();
const principal=(role,subject,issuer)=>({
  issuer,subject,role,authSource:'external',ownershipEligible:true,
  name:'QA fixture',expiresAt:new Date(Date.now()+600000).toISOString(),
});
const merchant=principal('merchant',msub,merchantIssuer);
const courier=principal('courier',csub,courierIssuer);
const authTokens=new Map([
  ['merchant',merchant],['courier',courier],
  ['buyer',principal('client',msub,merchantIssuer)],
  ['demo',{...merchant,authSource:'dev-login',ownershipEligible:false}],
]);
const auth={async resolvePrincipalFromAuthorization(header){
  const token=typeof header==='string'&&header.startsWith('Bearer ')
    ?header.slice('Bearer '.length):'';
  if(!authTokens.has(token)){
    return {ok:false,authenticated:false,principal:null,
      reason:'invalid_or_expired_token'};
  }
  return {ok:true,authenticated:true,
    principal:authTokens.get(token),payload:{}};
}};
const activeMerchant={
  issuer:merchantIssuer,subject:msub,slug:'qa-restaurant',
  membershipId:'qa-wallet-http',partnerId:'qa-restaurant',
  membershipStatus:'active',partnerLifecycleStatus:'published',
  contractStatus:'active',kybStatus:'verified',
  membershipRole:'manager',accessEligible:true,
  startsAt:null,expiresAt:null,revokedAt:null,
};
let membership={...activeMerchant};
const activeCourier={issuer:courierIssuer,subject:csub,active:true,
  source:'committed-server-roster'};
let roster={...activeCourier};
let forceMembershipError=false,forceRosterError=false;
let moneyReads=0,financeWrites=0;
let status='pending';
const amount=role=>role==='merchant'?1840:390;
function fakeSummary(role){
  const n=amount(role);
  return {currency:'EUR',accrued_minor:String(n),
    pending_minor:String(status==='pending'?n:0),
    available_minor:String(status==='available'?n:0),
    held_minor:String(status==='held'?n:0),
    withdrawable_minor:'0',order_count:'1',payout_enabled:false};
}
const fakeMerchantPg={async query(sql,params){
  moneyReads++;
  if(sql.includes('da_qa_wallet_merchant_summary')){
    assert.deepEqual(params,['qa-restaurant']);
    return {rows:[{merchant_slug:'qa-restaurant',...fakeSummary('merchant')}]};
  }
  assert.ok(sql.includes('da_qa_wallet_merchant_activity'));
  assert.deepEqual(params,['qa-restaurant',30]);
  return {rows:[{order_id:orderId,policy_id:'QA_FIXTURE_EUR_V1',
    gross_minor:'2300',fee_minor:'460',earned_minor:'1840',currency:'EUR',
    financial_state:status==='held'?'financial_hold':'captured',
    fulfillment_state:status==='pending'?'accepted':'ready',
    occurred_at:new Date().toISOString()}]};
}};
const fakeCourierPg={async query(sql,params){
  moneyReads++;
  if(sql.includes('da_qa_wallet_courier_summary')){
    assert.deepEqual(params,[courierIssuer,csub]);
    return {rows:[fakeSummary('courier')]};
  }
  assert.ok(sql.includes('da_qa_wallet_courier_activity'));
  assert.deepEqual(params,[courierIssuer,csub,20]);
  return {rows:[{order_id:orderId,earned_minor:'390',currency:'EUR',
    financial_state:status==='held'?'financial_hold':'captured',
    delivery_state:status==='available'?'delivered':'accepted',
    occurred_at:new Date().toISOString()}]};
}};
const noFinance={async query(){financeWrites++;
  throw Error('QA_WALLET_HTTP_MUST_NEVER_ACCRUE_OR_PAYOUT');}};
const adapter=new QaMerchantCourierWalletPgAdapter(
  fakeMerchantPg,fakeCourierPg,noFinance);
const admission={
  async readCommittedMerchantMemberships(issuer,subject){
    if(forceMembershipError)throw Error('PRIVATE_DB_FAULT');
    if(issuer!==merchantIssuer||subject!==msub)return [];
    return membership?[membership]:[];
  },
  async readCommittedCourierRoster(issuer,subject){
    if(forceRosterError)throw Error('PRIVATE_COURIER_FAULT');
    if(issuer!==courierIssuer||subject!==csub)return null;
    return roster;
  },
};

test('QA wallet HTTP read only, strict role, tested membership, no cashout',async()=>{
  const priorFlag=process.env.DA_QA_ISOLATED_WALLET_ENABLED;
  const priorMode=process.env.NODE_ENV;
  let app;
  try{
    const mod=await Test.createTestingModule({
      controllers:[QaMerchantCourierWalletController],
      providers:[OrdersAuthGuard,
        {provide:AuthService,useValue:auth},
        {provide:QA_MERCHANT_COURIER_ADMISSION_PORTS,useValue:admission},
        {provide:QA_MERCHANT_COURIER_WALLET_PORTS,useValue:adapter},
      ],
    }).compile();
    app=mod.createNestApplication({logger:false});
    await app.listen(0,'127.0.0.1');
    const base='http://127.0.0.1:'+
      app.getHttpServer().address().port+'/qa-isolated/wallet/';
    async function post(path,token,body={}){
      const res=await fetch(base+path,{method:'POST',
        signal:AbortSignal.timeout(12000),
        headers:{'content-type':'application/json',
          ...(token?{authorization:'Bearer '+token}:{})},
        body:JSON.stringify(body)});
      const payload=await res.json();
      return {status:res.status,body:payload,
        cache:res.headers.get('cache-control')};
    }
    const merchantRoute='merchant/summary';
    const courierRoute='courier/summary';
    const memberBody={merchantSlug:'qa-restaurant'};
    process.env.DA_QA_ISOLATED_WALLET_ENABLED='';
    assert.equal((await post(merchantRoute,'merchant',memberBody)).status,503);
    assert.equal((await post(courierRoute,'courier')).status,503);
    assert.equal(moneyReads,0);
    process.env.DA_QA_ISOLATED_WALLET_ENABLED='YES';
    process.env.NODE_ENV='test';
    for(const path of [merchantRoute,courierRoute]){
      assert.equal((await post(path,null,memberBody)).status,401);
      assert.equal((await post(path,'fake-token',memberBody)).status,401);
    }
    assert.equal((await post(merchantRoute,'buyer',memberBody)).status,403);
    assert.equal((await post(merchantRoute,'courier',memberBody)).status,403);
    assert.equal((await post(merchantRoute,'demo',memberBody)).status,403);
    assert.equal((await post(courierRoute,'merchant')).status,403);
    assert.equal(moneyReads,0);
    console.log('QA_WALLET_HTTP_UNAUTHENTICATED_CROSS_ROLE_DEV=ZERO_DATA_ACCESS');

    for(const fields of [
      {...memberBody,paid:true},
      {...memberBody,amount:999999},
      {...memberBody,payoutId:'fake'},
      {...memberBody,clientSubject:msub},
    ]){
      assert.equal((await post(merchantRoute,'merchant',fields)).status,400);
    }
    assert.equal((await post(courierRoute,'courier',{issuer:courierIssuer})).status,400);
    assert.equal((await post(merchantRoute,'merchant',{merchantSlug:'other-merchant'})).status,403);
    assert.equal((await post(merchantRoute,'merchant',{merchantSlug:'qa-restaurant',limit:100})).status,400);
    assert.equal(moneyReads,0);

    membership={...activeMerchant,kybStatus:'expired'};
    assert.equal((await post(merchantRoute,'merchant',memberBody)).status,503);
    membership={...activeMerchant};
    forceMembershipError=true;
    assert.equal((await post(merchantRoute,'merchant',memberBody)).status,503);
    forceMembershipError=false;
    roster=null;
    assert.equal((await post(courierRoute,'courier')).status,403);
    roster={...activeCourier};
    forceRosterError=true;
    assert.equal((await post(courierRoute,'courier')).status,503);
    forceRosterError=false;
    assert.equal(moneyReads,0);
    console.log('QA_WALLET_HTTP_KYB_MEMBERSHIP_ROSTER_FAILURE=FAIL_CLOSED');

    const m=await post(merchantRoute,'merchant',memberBody);
    assert.equal(m.status,200);assert.ok(m.cache.includes('no-store'));
    assert.equal(m.body.summary.pendingMinor,1840);
    assert.equal(m.body.summary.availableMinor,0);
    assert.equal(m.body.summary.withdrawableMinor,0);
    assert.equal(m.body.summary.payoutEnabled,false);
    assert.equal(m.body.activity[0].grossMinor,2300);
    const c=await post(courierRoute,'courier');
    assert.equal(c.status,200);assert.ok(c.cache.includes('no-store'));
    assert.equal(c.body.summary.pendingMinor,390);
    assert.equal(c.body.summary.withdrawableMinor,0);
    assert.equal(c.body.activity[0].earnedMinor,390);
    status='available';
    assert.equal((await post(merchantRoute,'merchant',memberBody)).body.summary.availableMinor,1840);
    assert.equal((await post(courierRoute,'courier')).body.summary.availableMinor,390);
    status='held';
    assert.equal((await post(merchantRoute,'merchant',memberBody)).body.summary.heldMinor,1840);
    assert.equal((await post(courierRoute,'courier')).body.summary.heldMinor,390);
    assert.equal(financeWrites,0);
    assert.equal((await post('merchant/withdraw','merchant',memberBody)).status,404);
    assert.equal((await post('courier/withdraw','courier')).status,404);
    console.log('QA_WALLET_HTTP_PENDING_AVAILABLE_HELD_NO_STORE=PASS_NO_PAYOUT');

    process.env.NODE_ENV='production';
    assert.equal((await post(merchantRoute,'merchant',memberBody)).status,503);
    assert.equal((await post(courierRoute,'courier')).status,503);
    assert.equal(financeWrites,0);
    console.log('QA_WALLET_HTTP_IN_PRODUCTION=OFF_EVEN_IF_FLAG_YES');
  }finally{
    if(priorFlag===undefined)delete process.env.DA_QA_ISOLATED_WALLET_ENABLED;
    else process.env.DA_QA_ISOLATED_WALLET_ENABLED=priorFlag;
    if(priorMode===undefined)delete process.env.NODE_ENV;
    else process.env.NODE_ENV=priorMode;
    if(app)await app.close();
  }
});
