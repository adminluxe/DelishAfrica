'use strict';
/**
 * Static and subprocess QA proving the official Stripe TEST preflight
 * never prints secret material or accesses the provider without operator
 * authorization. Tests do NOT supply both official network gates.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const script=resolve(__dirname,'../../../ops/stripe/DA_STRIPE_TEST_OFFICIAL_PREFLIGHT_V1.sh');
const invalidToken='MUST_NEVER_APPEAR_IN_OUTPUT_TOKEN_012345';
function exec(mode,vars={}){
  const env={...process.env,
    DA_STRIPE_TEST_SECRET_KEY:'',
    DA_STRIPE_TEST_PUBLISHABLE_KEY:'',
    DA_STRIPE_TEST_WEBHOOK_SECRET:'',
    DA_STRIPE_TEST_EXPECTED_ACCOUNT_ID:'',
    DA_STRIPE_TEST_OFFICIAL_QA_ISOLATED:'',
    DA_STRIPE_TEST_PROVIDER_READONLY_GO:'',
    ...vars};
  const r=spawnSync('/bin/bash',[script,mode],{
    encoding:'utf8',env,timeout:6000,
  });
  const output=String(r.stdout||'')+'\n'+String(r.stderr||'');
  assert.ok(!output.includes(invalidToken),'secret marker leaked to output');
  return {...r,output};
}
test('offline inventory never contacts Stripe or mutates runtime',()=>{
  const s=readFileSync(script,'utf8');
  assert.ok(s.includes('GET_ACCOUNT_ONLY'));
  assert.ok(!/(\bcurl\s+.*-d\b|\bPOST\s+\/v1\/payment_intents|\bdocker\s+(?:rm|stop|restart|run)\b)/i.test(s));
  const result=exec('--inventory',{
    DA_STRIPE_TEST_SECRET_KEY:'sk_live_'+invalidToken,
  });
  assert.equal(result.status,0,result.output);
  assert.match(result.output,/PROVIDER_NETWORK=NEVER_USED/);
  assert.match(result.output,/SERVER_TEST_SECRET=MISSING_OR_INVALID/);
  console.log('QA_STRIPE_TEST_PREFLIGHT_INVENTORY=NO_NETWORK_NO_SECRET_LEAK');
});
test('a missing or LIVE provider key blocks offline qualification',()=>{
  const absent=exec('--offline');
  assert.notEqual(absent.status,0);
  assert.match(absent.output,/NO_GO_INCOMPLETE_TEST_CONFIG/);
  const live=exec('--offline',{
    DA_STRIPE_TEST_SECRET_KEY:'sk_live_'+invalidToken,
  });
  assert.notEqual(live.status,0);
  assert.match(live.output,/SERVER_TEST_SECRET=MISSING_OR_INVALID/);
  console.log('QA_STRIPE_TEST_PREFLIGHT_NO_LIVE_KEY=PASS');
});
test('official account probe is blocked without dual authorization',()=>{
  const r=exec('--account-readonly',{
    DA_STRIPE_TEST_SECRET_KEY:'sk_test_QA_PLACEHOLDER_NOT_REAL_000000001',
    DA_STRIPE_TEST_PUBLISHABLE_KEY:'pk_test_QA_PLACEHOLDER_NOT_REAL_000000001',
    DA_STRIPE_TEST_WEBHOOK_SECRET:'whsec_QA_PLACEHOLDER_NOT_REAL_000000001',
    DA_STRIPE_TEST_EXPECTED_ACCOUNT_ID:'acct_QAACCOUNTNOTREAL001',
  });
  assert.equal(r.status,14,r.output);
  assert.match(r.output,/NO_GO_OFFICIAL_PROVIDER_NOT_AUTHORIZED/);
  assert.doesNotMatch(r.output,/PROVIDER_REQUEST=GET_ACCOUNT_ONLY/);
  console.log('QA_STRIPE_TEST_PREFLIGHT_EXTERNAL_PROVIDER=OFF_BY_DEFAULT');
});
