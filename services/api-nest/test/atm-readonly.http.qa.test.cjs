'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const oldLoad = Module._load;
Module._load = function(request,parent,isMain) {
  // QA-only dependency double: the Nest PG runtime vendor is deploy-only.
  if (/\.runtime-vendor[\\/]pg-runtime[\\/]node_modules[\\/]pg$/.test(request))
    return {Pool:class QA_UNUSED_PG {constructor(){throw Error('NO_DATABASE_CONNECTION_ALLOWED_IN_QA_HTTP');}}};
  return oldLoad.call(this,request,parent,isMain);
};
let controller,Service,Test;
try {
  require('reflect-metadata');
  controller=require('../dist/atm-readonly/atm-readonly.controller.js').AtmReadonlyController;
  Service=require('../dist/atm-readonly/atm-readonly.service.js').AtmReadonlyService;
  Test=require('@nestjs/testing').Test;
} finally {
  Module._load=oldLoad;
}
const {AtmReadonlyCore}=require('../dist/atm-readonly/atm-readonly.core.js');
const time='2026-10-30T12:00:00.000Z';
const principal={issuer:'https://keycloak.afritaste.delishafrica.me/realms/afritaste',
  subject:'subject-qa',role:'merchant',authSource:'external',ownershipEligible:true};
const ownership={partnerId:'qa-merchant-id',slug:'qa-merchant'};
const member={issuer:principal.issuer,subject:principal.subject,
  partnerId:ownership.partnerId,slug:ownership.slug,
  membershipRole:'admin',membershipStatus:'active',contractStatus:'active',
  kybStatus:'verified',partnerLifecycleStatus:'published',
  accessEligible:true,revokedAt:null};
const testSource={
  readFinance:async scope=>({mode:'SHADOW',readOnly:true,
    tenantId:'qa-tenant',merchantId:scope.merchantId,events:[]}),
  readInventory:async scope=>({merchantId:scope.merchantId,updatedAt:time,items:[]}),
  readSuppliers:async scope=>({merchantId:scope.merchantId,updatedAt:time,items:[]}),
};
let app,port,role='merchant';
async function http(path,headers={},method='GET') {
  const response=await fetch('http://127.0.0.1:'+port+'/api/v1'+path,
    {method,headers});
  return {status:response.status,headers:response.headers,
    body:await response.text()};
}
test('isolated Nest real HTTP: production gating, auth, RBAC, 200 read schemas, no writes',
  async()=>{
    let memberships=[member];
    const trust={
      resolveBearer:async authorization=>authorization==='Bearer qa-signed-test-double'
        ? {...principal,role}:null,
      listOwned:async()=>[ownership],
      listMemberships:async()=>memberships,
    };
    const core=new AtmReadonlyCore(trust,testSource);
    const testing=await Test.createTestingModule({
      controllers:[controller],
      providers:[{provide:Service,useValue:{read:(...args)=>core.read(...args)}}],
    }).compile();
    app=testing.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.listen(0,'127.0.0.1');
    port=app.getHttpServer().address().port;
    const auth={authorization:'Bearer qa-signed-test-double'};
    try {
      process.env.NODE_ENV='test';
      delete process.env.DA_ATM_READONLY_QA_ENABLED;
      const disabled=await http('/merchant/inventory/me',auth);
      assert.equal(disabled.status,503);
      process.env.DA_ATM_READONLY_QA_ENABLED='YES';
      const unauth=await http('/merchant/inventory/me');
      assert.equal(unauth.status,401);
      role='client';
      const wrongRole=await http('/merchant/suppliers/me',auth);
      assert.equal(wrongRole.status,403);
      role='merchant';
      const routes=[
        ['/integrations/orchidpay/read-model/me','orchidpay.atm.shadow.v1'],
        ['/merchant/inventory/me','atm.inventory.read.v1'],
        ['/merchant/suppliers/me','atm.suppliers.read.v1'],
      ];
      for (const [path,schema] of routes) {
        const r=await http(path,auth);
        assert.equal(r.status,200,path+' '+r.body);
        const json=JSON.parse(r.body);
        assert.equal(json.schema,schema);
        assert.equal(json.merchantId,'qa-merchant-id');
        assert.equal(json.readOnly,true);
        assert.match(r.headers.get('cache-control'),/no-store/);
        assert.equal(r.headers.get('pragma'),'no-cache');
        const post=await http(path,auth,'POST');
        assert.equal(post.status,404,'no POST route at '+path);
      }
      assert.equal((await http('/merchant/inventory/me',
        {...auth,'x-da-partner-slug':'foreign-merchant'})).status,403);
      // Legacy XR account: bearer identity may be valid, but the establishment
      // and membership must be approved by the actual merchant authority.
      memberships=[];
      for (const [path] of routes) {
        const denied=await http(path,auth);
        assert.equal(denied.status,403,'no approved membership must deny '+path);
        assert.doesNotMatch(denied.body,/qa-merchant-id/);
      }
      memberships=[member];
    } finally {
      await app.close();
      delete process.env.DA_ATM_READONLY_QA_ENABLED;
    }
  });
