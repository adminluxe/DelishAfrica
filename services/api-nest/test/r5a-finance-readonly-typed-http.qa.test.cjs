/**
 * R5A-B private staging boundary only: tests the EXACT Nest controller from
 * DelishAfrica PR #46 on loopback with an INJECTED SYNTHETIC readWallet port.
 *
 * This is NOT a real Keycloak, introspection, PostgreSQL or legal ledger test.
 * It protects the typed HTTP transport contract before wiring real attestors.
 * Never register this controller in public AppModule.
 */
'use strict';
require('reflect-metadata');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {Test}=require('@nestjs/testing');
const {
  PartnerFinanceReadonlyQaController,
  FINANCE_READONLY_QA_PORT,
  FinanceReadonlyQaPortError,
}=require('../src/client-commerce/partner-finance-readonly.qa.controller');

test('R5A private Nest exact controller typed HTTP boundaries, 16 requests, zero financial writes',async()=>{
  const previous={
    NODE_ENV:process.env.NODE_ENV,
    GITHUB_ACTIONS:process.env.GITHUB_ACTIONS,
    QA_SYNTHETIC_ONLY:process.env.QA_SYNTHETIC_ONLY,
  };
  process.env.NODE_ENV='test';
  process.env.GITHUB_ACTIONS='true';
  process.env.QA_SYNTHETIC_ONLY='YES';
  let app=null,reads=0,kind='merchant',fault='',slug='r5a-merchant';
  const wallet=()=>{
    const merchant=kind==='merchant';
    return {
      mode:'qa_synthetic_only',
      ownerRole:kind,
      merchantSlug:merchant?slug:null,
      organizationId:'c0ffee00-0000-4000-8000-000000000001',
      territory:'BE',
      withdrawableMinor:0,
      payoutEnabled:false,
      hiddenIdentity:'must-never-be-returned',
      activity:[{private:'must-never-leak'}],
      summary:{
        currency:'EUR',
        accrued_minor:1900,
        pending_minor:800,
        available_minor:1100,
        held_minor:0,
        withdrawable_minor:0,
        payout_enabled:false,
      },
    };
  };
  const reader={
    async readWallet(raw,limit) {
      reads++;
      assert.equal(limit,20);
      assert.equal(raw,'Bearer signed.qa.jwt');
      if(['unauthenticated','forbidden','conflict','unavailable'].includes(fault)) {
        throw new FinanceReadonlyQaPortError(fault);
      }
      if(fault==='unknown')throw Error('INTERNAL_POSTGRES_HOST_AND_TABLES_PRIVATE');
      const w=wallet();
      if(fault==='payout')w.withdrawableMinor=1;
      if(fault==='inconsistent')w.summary.accrued_minor=2000;
      if(fault==='live')w.mode='live';
      if(fault==='other_currency')w.summary.currency='USD';
      if(fault==='bad_merchant_slug')w.merchantSlug=null;
      if(fault==='bad_courier_slug')w.merchantSlug='malicious-merchant';
      return w;
    }
  };
  try {
    const module=await Test.createTestingModule({
      controllers:[PartnerFinanceReadonlyQaController],
      providers:[{provide:FINANCE_READONLY_QA_PORT,useValue:reader}]
    }).compile();
    app=module.createNestApplication({logger:false});
    await app.listen(0,'127.0.0.1');
    const addr=app.getHttpServer().address();
    assert.equal(addr.address,'127.0.0.1');
    const url='http://127.0.0.1:'+addr.port+'/qa-isolated/partner-finance/v1/summary';
    const fetchHttp=(token)=>fetch(url,{
      headers:token?{Authorization:token}:{},
      redirect:'error',
      signal:AbortSignal.timeout(12000),
    });
    const expectStatus=async(label,status,token='Bearer signed.qa.jwt')=>{
      const response=await fetchHttp(token);
      assert.equal(response.status,status,label);
      assert.match(response.headers.get('cache-control')||'',/no-store/);
      const txt=await response.text();
      assert(!txt.includes('INTERNAL_POSTGRES_HOST_AND_TABLES_PRIVATE'));
      assert(!txt.includes('must-never-leak'));
      console.log('R5A_FINANCE_HTTP_PASS='+label+'_HTTP_'+status);
      return txt;
    };

    await expectStatus('MISSING_BEARER_401',401,null);
    assert.equal(reads,0,'no reader invocation without Bearer');
    await expectStatus('MALFORMED_BEARER_401',401,'Bearer not-a-jwt');
    assert.equal(reads,0,'no reader invocation for malformed bearer');
    const faultCases=[
      ['unauthenticated',401],
      ['forbidden',403],
      ['conflict',409],
      ['unavailable',503],
      ['unknown',503],
    ];
    for(const [value,status] of faultCases) {
      fault=value;
      await expectStatus('TRUSTED_PORT_'+value.toUpperCase(),status);
    }
    fault='';
    let response=await fetchHttp('Bearer signed.qa.jwt');
    assert.equal(response.status,200);
    const ok=await response.json();
    assert.deepEqual(ok,{
      ok:true,mode:'qa_synthetic_only',ownerRole:'merchant',
      currency:'EUR',
      accruedMinor:1900,pendingMinor:800,availableMinor:1100,heldMinor:0,
      withdrawableMinor:0,payoutEnabled:false
    });
    console.log('R5A_FINANCE_HTTP_PASS=SYNTHETIC_MERCHANT_200_NO_PII');
    for(const fail of ['payout','inconsistent','live','other_currency','bad_merchant_slug']) {
      fault=fail;
      await expectStatus('FAIL_CLOSED_'+fail.toUpperCase(),503);
    }
    fault='';
    kind='courier';
    response=await fetchHttp('Bearer signed.qa.jwt');
    assert.equal(response.status,200);
    const courier=await response.json();
    assert.equal(courier.ownerRole,'courier');
    assert.equal(courier.payoutEnabled,false);
    console.log('R5A_FINANCE_HTTP_PASS=SYNTHETIC_COURIER_200_NO_PAYOUT');
    fault='bad_courier_slug';
    await expectStatus('COURIER_MERCHANT_SCOPE_CROSS_DENIED',503);

    fault='';kind='merchant';
    const concurrent=await Promise.all(Array.from({length:16},()=>fetchHttp('Bearer signed.qa.jwt')));
    assert(concurrent.every(v=>v.status===200));
    await Promise.all(concurrent.map(v=>v.arrayBuffer()));
    console.log('R5A_FINANCE_HTTP_PASS=16_CONCURRENT_SYNTHETIC_READS');

    process.env.GITHUB_ACTIONS='false';
    const before=reads;
    await expectStatus('NON_CI_RUNTIME_503',503);
    assert.equal(reads,before,'no reader outside private QA');
    process.env.GITHUB_ACTIONS='true';
    process.env.NODE_ENV='production';
    await expectStatus('PRODUCTION_503_ZERO_FINANCE_READS',503);
    assert.equal(reads,before,'no reader in production');

    console.log('R5A_FINANCE_TYPED_HTTP=PASS_SYNTHETIC_PORT_ONLY');
    console.log('R5A_FINANCE_REAL_KEYCLOAK_POSTGRES=NOT_CERTIFIED');
    console.log('R5A_FINANCE_LIVE=NO_GO');
  }finally {
    if(app)await app.close();
    for(const [k,v] of Object.entries(previous)){
      if(v===undefined)delete process.env[k]; else process.env[k]=v;
    }
  }
});
