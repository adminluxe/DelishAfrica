/**
 * Local ephemeral Nest HTTP contract (2026-10-14).
 * MOCKED authorization port: does not certify real Keycloak/KYB/Stripe.
 * Production route registration intentionally remains impossible.
 */
require('reflect-metadata');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Test}=require('@nestjs/testing');
const {
  PartnerFinanceReadonlyQaController,
  FINANCE_READONLY_QA_PORT,
}=require('../src/client-commerce/partner-finance-readonly.qa.controller');

test('P0 authenticated finance presentation: no leak, no payout, production denied',async()=>{
  const old={NODE_ENV:process.env.NODE_ENV,
    GITHUB_ACTIONS:process.env.GITHUB_ACTIONS,
    QA_SYNTHETIC_ONLY:process.env.QA_SYNTHETIC_ONLY};
  process.env.NODE_ENV='test';
  process.env.GITHUB_ACTIONS='true';
  process.env.QA_SYNTHETIC_ONLY='YES';
  let app, reads=0, reportMode='qa_synthetic_only', withdrawable=0;
  const reader={
    async readWallet(raw,limit) {
      reads++;
      assert.equal(limit,20);
      if(raw!=='Bearer signed.qa.jwt')throw Error('mock denies token');
      return {
        mode:reportMode,ownerRole:'merchant',merchantSlug:'rice-peace',
        organizationId:'00000000-0000-4000-8000-000000000001',
        territory:'BE',withdrawableMinor:withdrawable,payoutEnabled:false,
        activity:[{sensitive:'should-never-cross-HTTP'}],
        summary:{
          currency:'EUR',accrued_minor:1900,pending_minor:900,
          available_minor:1000,held_minor:0,
          withdrawable_minor:withdrawable,payout_enabled:false,
        },
      };
    },
  };
  try {
    const module=await Test.createTestingModule({
      controllers:[PartnerFinanceReadonlyQaController],
      providers:[{provide:FINANCE_READONLY_QA_PORT,useValue:reader}],
    }).compile();
    app=module.createNestApplication({logger:false});
    await app.listen(0,'127.0.0.1');
    const address=app.getHttpServer().address();
    assert(address&&typeof address.port==='number');
    const url='http://127.0.0.1:'+address.port+'/qa-isolated/partner-finance/v1/summary';
    const query=(token)=>fetch(url,{
      headers:token?{Authorization:token}:{},
      redirect:'manual',
    });
    let response=await query();
    assert.equal(response.status,503);
    assert.equal(reads,0,'no SQL attestor call before authorization shape');
    response=await query('Bearer signed.qa.jwt');
    assert.equal(response.status,200);
    assert.match(response.headers.get('cache-control')||'',/no-store/);
    const body=await response.json();
    assert.deepEqual(body,{
      ok:true,mode:'qa_synthetic_only',ownerRole:'merchant',
      currency:'EUR',accruedMinor:1900,pendingMinor:900,
      availableMinor:1000,heldMinor:0,
      withdrawableMinor:0,payoutEnabled:false,
    });
    assert(!('organizationId' in body)&&!('activity' in body));
    reportMode='live';
    response=await query('Bearer signed.qa.jwt');
    assert.equal(response.status,503,'live claims cannot masquerade as QA');
    reportMode='qa_synthetic_only';
    withdrawable=1;
    response=await query('Bearer signed.qa.jwt');
    assert.equal(response.status,503,'payout intent forbidden');
    withdrawable=0;
    process.env.NODE_ENV='production';
    const before=reads;
    response=await query('Bearer signed.qa.jwt');
    assert.equal(response.status,503,'server refuses any production mount');
    assert.equal(reads,before,'no finance read attempted in production');
    console.log('P0_FINANCE_NEST_HTTP=PASS_MOCK_BOUNDARY_ONLY');
  }finally{
    if(app)await app.close();
    for(const [k,v] of Object.entries(old)){
      if(v===undefined)delete process.env[k];else process.env[k]=v;
    }
  }
});
