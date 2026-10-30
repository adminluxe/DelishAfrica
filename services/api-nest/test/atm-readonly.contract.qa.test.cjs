'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {AtmReadonlyCore,ReadDenied,approvedMerchantTokenBinding} =
  require('../dist/atm-readonly/atm-readonly.core.js');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');

const now='2026-10-30T12:00:00.000Z';
const person = Object.freeze({
  issuer:'https://keycloak.afritaste.delishafrica.me/realms/afritaste',
  subject:'principal-A',role:'merchant',authSource:'external',ownershipEligible:true,
});
const owned = Object.freeze([{partnerId:'merchant-A',slug:'owner-a'}]);
const membership = Object.freeze({
  issuer:person.issuer,subject:person.subject,
  partnerId:'merchant-A',slug:'owner-a',membershipRole:'admin',
  membershipStatus:'active',contractStatus:'active',kybStatus:'verified',
  partnerLifecycleStatus:'published',accessEligible:true,revokedAt:null,
});
const event = (patch={}) => ({
  tenantId:'delishafrica',merchantId:'merchant-A',
  siteId:'site-A',partyId:'party-A',orderId:'order-A',
  id:'e-A',sourceKind:'orchidpay-shadow-qa',sourceRef:'order-A',
  sourceSHA:'test-source-SHA',observedAt:now,effectiveAt:now,
  eventVersion:1,mode:'SHADOW',kind:'LEDGER_SHADOW',verified:false,
  amountMinor:2500,currency:'EUR',paymentId:'pay-A',...patch,
});
const finance = (patch={}) => ({mode:'SHADOW',readOnly:true,
  tenantId:'delishafrica',merchantId:'merchant-A',events:[event()],...patch});
const inventory = (patch={}) => ({
  merchantId:'merchant-A',updatedAt:now,items:[
    {id:'s-A',merchantId:'merchant-A',name:'Riz',quantity:8,minimum:10,
      unit:'kg',supplierId:'v-A'},
  ],...patch,
});
const suppliers = (patch={}) => ({
  merchantId:'merchant-A',updatedAt:now,items:[
    {id:'v-A',merchantId:'merchant-A',name:'Épicerie',specialty:'Sec',
      leadDays:2,active:true},
  ],...patch,
});
function setup(opts={}) {
  let count=0;
  const calls=[];
  const who=opts.person===undefined?person:opts.person;
  const trust={
    async resolveBearer(a){calls.push('auth');return who;},
    async listOwned(){calls.push('owned');return opts.owned??owned;},
    async listMemberships(){calls.push('membership');return opts.memberships??[membership];},
  };
  const source={
    async readFinance(s){calls.push(['finance',s]);count++;if(opts.throwSource)throw Error('down');return opts.finance??finance();},
    async readInventory(s){calls.push(['inventory',s]);count++;if(opts.throwSource)throw Error('down');return opts.inventory??inventory();},
    async readSuppliers(s){calls.push(['suppliers',s]);count++;if(opts.throwSource)throw Error('down');return opts.suppliers??suppliers();},
  };
  return {core:new AtmReadonlyCore(trust,source),calls,reads:()=>count};
}
const bearer='Bearer header.payload.signature';
const expectDenied=async (p,status,code)=>{
  await assert.rejects(p,e=>e instanceof ReadDenied &&
    e.status===status && (code===undefined || e.code===code));
};
test('production fails closed even if QA opt-in accidentally set',async()=>{
  const old=process.env.NODE_ENV;const oldFlag=process.env.DA_ATM_READONLY_QA_ENABLED;
  try{
    process.env.NODE_ENV='production';process.env.DA_ATM_READONLY_QA_ENABLED='YES';
    const s=setup();await expectDenied(s.core.read('finance',bearer),503);
    assert.equal(s.calls.length,0);
  }finally{process.env.NODE_ENV=old;process.env.DA_ATM_READONLY_QA_ENABLED=oldFlag;}
});
test('OIDC audience and azp binding never grants merchant rights to the wrong client',()=>{
  assert.equal(approvedMerchantTokenBinding('afritaste-mobile',['delishafrica-merchant','account']),true);
  assert.equal(approvedMerchantTokenBinding('delishafrica-merchant','delishafrica-merchant'),true);
  for(const candidate of [
    ['afritaste-mobile','afritaste-mobile'],
    ['delishafrica-client','delishafrica-merchant'],
    ['delishafrica-courier','delishafrica-merchant'],
    ['afritaste-mobile',['delishafrica-merchant','delishafrica-master-dashboard']],
    ['afritaste-mobile',null],[null,'delishafrica-merchant'],
  ]) assert.equal(approvedMerchantTokenBinding(...candidate),false);
});
test('unconfigured QA never reads any token or financial source',async()=>{
  const old=process.env.DA_ATM_READONLY_QA_ENABLED;
  try{
    delete process.env.DA_ATM_READONLY_QA_ENABLED;
    const s=setup();await expectDenied(s.core.read('finance',bearer),503);
    assert.equal(s.calls.length,0);
  }finally{process.env.DA_ATM_READONLY_QA_ENABLED=old;}
});
const QA=()=>{
  process.env.DA_ATM_READONLY_QA_ENABLED='YES';
  process.env.NODE_ENV='test';
};
// HF18: a legacy/test Keycloak identity may still authenticate while having
// no officially approved merchant membership or linked establishment.
// This must NEVER grant ATM finance, stock, or supplier reads.
test('legacy test identity without membership is denied all ATM read models',async()=>{
  QA();const s=setup({memberships:[]});
  for(const area of ['finance','inventory','suppliers'])
    await expectDenied(s.core.read(area,bearer),403,'merchant_read_grant_required');
  assert.equal(s.reads(),0);
  assert.ok(s.calls.includes('membership'));
});
test('legacy test identity without approved establishment ownership is denied',async()=>{
  QA();const s=setup({owned:[]});
  for(const area of ['finance','inventory','suppliers'])
    await expectDenied(s.core.read(area,bearer),403,'merchant_read_grant_required');
  assert.equal(s.reads(),0);
  assert.ok(s.calls.includes('owned'));
});
test('missing or malformed bearer returns 401 before merchant or financial read',async()=>{
  QA();const s=setup();
  await expectDenied(s.core.read('finance',undefined),401);
  await expectDenied(s.core.read('inventory','Bearer unsupported chars ###'),401);
  assert.equal(s.calls.length,0);
});
test('invalid external token denies without accessing merchant membership',async()=>{
  QA();const s=setup({person:null});
  await expectDenied(s.core.read('finance',bearer),401);
  assert.deepEqual(s.calls,['auth']);
});
for (const bad of [
  {role:'client'}, {role:'ops'}, {authSource:'dev-login'},
  {ownershipEligible:false},{issuer:''},{subject:''},
]){
  test('untrusted principal rejected '+JSON.stringify(bad),async()=>{
    QA();const s=setup({person:{...person,...bad}});
    await expectDenied(s.core.read('finance',bearer),403);
    assert.deepEqual(s.calls,['auth']);
  });
}
for (const bad of [
  {membershipStatus:'suspended'}, {membershipStatus:'revoked'},
  {contractStatus:'pending'}, {kybStatus:'pending'},
  {partnerLifecycleStatus:'suspended'}, {accessEligible:false},
  {revokedAt:'2026-10-01T00:00:00.000Z'},
  {subject:'foreign-subject'},{issuer:'other-issuer'},
  {partnerId:'merchant-B'},{slug:'owner-b'},
]){
  test('finance denies unqualified membership '+JSON.stringify(bad),async()=>{
    QA();const s=setup({memberships:[{...membership,...bad}]});
    await expectDenied(s.core.read('finance',bearer),403);
    assert.equal(s.reads(),0);
  });
}
test('finance demands a distinct finance/owner/admin membership role',async()=>{
  QA();const s=setup({memberships:[{...membership,membershipRole:'kitchen'}]});
  await expectDenied(s.core.read('finance',bearer),403);
  assert.equal(s.reads(),0);
});
test('inventory can be read by kitchen; suppliers still need owner/admin/manager',async()=>{
  QA();const s=setup({memberships:[{...membership,membershipRole:'kitchen'}]});
  assert.equal((await s.core.read('inventory',bearer)).items[0].name,'Riz');
  await expectDenied(s.core.read('suppliers',bearer),403);
});
test('matching suppliers and inventory are approved read-only',async()=>{
  QA();const s=setup({memberships:[{...membership,membershipRole:'admin'}]});
  const i=await s.core.read('inventory',bearer);
  const v=await s.core.read('suppliers',bearer);
  assert.equal(i.schema,'atm.inventory.read.v1');
  assert.equal(v.schema,'atm.suppliers.read.v1');
  assert.equal(i.readOnly,true);assert.equal(v.readOnly,true);
  assert.equal(i.merchantId,'merchant-A');assert.equal(v.merchantId,'merchant-A');
});
test('ambiguous multi-merchant subject requires explicit owned slug selection',async()=>{
  QA();
  const s=setup({owned:[...owned,{partnerId:'merchant-B',slug:'owner-b'}],
    memberships:[membership,{...membership,partnerId:'merchant-B',slug:'owner-b'}]});
  await expectDenied(s.core.read('finance',bearer),409);
  const result=await s.core.read('finance',bearer,'owner-a');
  assert.equal(result.merchantId,'merchant-A');
  await expectDenied(s.core.read('finance',bearer,'owner-z'),403);
  await expectDenied(s.core.read('finance',bearer,'../owner-a'),403);
});
test('finance returns only scoped SHADOW records and never an available bank balance',async()=>{
  QA();const s=setup();const r=await s.core.read('finance',bearer);
  assert.equal(r.schema,'orchidpay.atm.shadow.v1');
  assert.equal(r.readOnly,true);assert.equal(r.mode,'SHADOW');
  assert.equal(r.events[0].verified,false);
  assert.equal(r.events[0].merchantId,'merchant-A');
  assert.equal(r.balance,undefined);
  assert.equal(r.withdrawableMinor,undefined);
  assert.equal(s.reads(),1);
});
for(const patch of [
  {mode:'LIVE'}, {readOnly:false}, {merchantId:'merchant-B'},
  {events:[event({merchantId:'merchant-B'})]},
  {events:[event({tenantId:'tenant-B'})]},
  {events:[event({mode:'LIVE'})]},
  {events:[event({verified:true})]},
  {events:[event({amountMinor:-100})]},
  {events:[event({kind:'PAYOUT_CONFIRMED'})]},
  {events:[event({currency:'BTC1'})]},
  {events:Array.from({length:101},(_,i)=>event({id:'e-'+i}))},
]){
  test('rejects malformed or forged financial evidence '+JSON.stringify(patch).slice(0,55),async()=>{
    QA();const s=setup({finance:finance(patch)});
    await expectDenied(s.core.read('finance',bearer),503);
  });
}
for(const patch of [
  {merchantId:'merchant-B'}, {updatedAt:'yesterday'},
  {items:[{...inventory().items[0],merchantId:'merchant-B'}]},
  {items:[{...inventory().items[0],quantity:-1}]},
  {items:[{...inventory().items[0],unit:'barrels'}]},
  {items:[inventory().items[0],inventory().items[0]]},
]){
  test('rejects wrong inventory contract '+JSON.stringify(patch).slice(0,50),async()=>{
    QA();const s=setup({inventory:inventory(patch)});
    await expectDenied(s.core.read('inventory',bearer),503);
  });
}
for(const patch of [
  {merchantId:'merchant-B'},{updatedAt:'not-a-date'},
  {items:[{...suppliers().items[0],merchantId:'merchant-B'}]},
  {items:[{...suppliers().items[0],leadDays:800}]},
  {items:[suppliers().items[0],suppliers().items[0]]},
]){
  test('rejects wrong supplier contract '+JSON.stringify(patch).slice(0,50),async()=>{
    QA();const s=setup({suppliers:suppliers(patch)});
    await expectDenied(s.core.read('suppliers',bearer),503);
  });
}
test('downstream failure never leaks its details',async()=>{
  QA();const s=setup({throwSource:true});
  await expectDenied(s.core.read('finance',bearer),503,'trusted_read_source_unavailable');
});
test('no payment mutation routes or merchant-selected ID in controller',()=>{
  const src=readFileSync(join(__dirname,'../src/atm-readonly/atm-readonly.controller.ts'),'utf8');
  assert.match(src,/@Get\('integrations\/orchidpay\/read-model\/me'\)/);
  assert.match(src,/@Get\('merchant\/inventory\/me'\)/);
  assert.match(src,/@Get\('merchant\/suppliers\/me'\)/);
  assert.doesNotMatch(src,/@(?:Post|Delete|Patch|Put)\(/);
  assert.match(src,/no-store/);
  const mod=readFileSync(join(__dirname,'../src/app.module.ts'),'utf8');
  assert.match(mod,/process.env.NODE_ENV !== 'production'/);
  assert.match(mod,/DA_ATM_READONLY_QA_ENABLED === 'YES'/);
});
