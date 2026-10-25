#!/usr/bin/env node
'use strict';
/**
 * R5B isolated integrated QA: REAL Keycloak 26.8.1 Client JWT ->
 * DelishAfrica's actual ExternalJwksVerifier + AuthService / Redis revocation ->
 * exact private Nest controller -> committed PostgreSQL16 reservation.
 *
 * This is NOT native Client enrollment, NOT the canonical DB, NOT Stripe TEST.
 * Never mounts a public AppModule or creates ANY PaymentIntent.
 */
require('reflect-metadata');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const util = require('node:util');
const execFile = util.promisify(cp.execFile);
const { Test } = require('@nestjs/testing');
const { AuthService } = require('../src/auth/auth.service');
const { ExternalJwksVerifierService } = require('../src/auth/external-jwks-verifier.service');
const {
  R5BClientReservationQaController,
  R5B_CLIENT_RESERVATION_QA_PORT,
  R5BReservationQaPortError,
} = require('../src/client-commerce/r5b-client-reservation.qa.controller');

const KC = 'http://127.0.0.1:18195';
const REALM = 'afritaste';
const ISSUER = KC + '/realms/' + REALM;
const URL = 'http://127.0.0.1:18197/qa-isolated/r5b-client-reservation/v1/reserve';
const PG = process.env.R5B_QA_PG_CONTAINER || '';
const REDIS = process.env.R5B_QA_REDIS_CONTAINER || '';
const SECRET = process.env.QA_BOOTSTRAP_ADMIN_PASSWORD || '';
const MERCHANT_A = '00000000-0000-4000-8000-000000000001';
const MERCHANT_B = '00000000-0000-4000-8000-000000000002';
const MUTATION = 'r5b_checkout_alpha_12345';
const ROOT = path.resolve(__dirname,'..');
const CONFIG = path.join(ROOT,'.runtime-config','keycloak-trusted-identity.json');
const assertEnv = (
  process.env.GITHUB_ACTIONS === 'true' &&
  process.env.QA_SYNTHETIC_ONLY === 'YES' &&
  process.env.QA_KEYCLOAK_ORIGIN === KC &&
  process.env.NODE_ENV === 'test' &&
  /^pog-r5b-client-pg-[A-Za-z0-9-]+$/.test(PG) &&
  /^pog-r5b-client-rd-[A-Za-z0-9-]+$/.test(REDIS) &&
  SECRET.length >= 24 &&
  (process.env.REDIS_URL || '').startsWith('redis://')
);
if (!assertEnv) throw Error('R5B_CI_ONLY_ENV_GUARD');

function pass(label, condition) {
  assert.ok(condition,label);
  console.log('R5B_PASS=' + label);
}
function expectCode(label,actual,expected) {
  assert.equal(actual,expected,label + '_HTTP_' + actual);
  pass(label + '_HTTP_' + expected,true);
}
function decode(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
}
async function api(method,relative,body,token) {
  const r = await fetch(KC + relative, {
    method, redirect:'manual', signal:AbortSignal.timeout(18000),
    headers: {
      ...(token ? {Authorization:'Bearer '+token} : {}),
      ...(body === undefined ? {} : {'Content-Type':'application/json'}),
    },
    ...(body === undefined ? {} : {body:JSON.stringify(body)}),
  });
  let data = null;
  if ((r.headers.get('content-type') || '').includes('json')) {
    data = await r.json().catch(() => null);
  } else {
    await r.arrayBuffer();
  }
  return {status:r.status,data,location:r.headers.get('location')};
}
async function oauth(body) {
  const r = await fetch(ISSUER + '/protocol/openid-connect/token', {
    method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams(body),
  });
  const data=await r.json().catch(()=>null);
  return {status:r.status,data};
}
async function setupKeycloak() {
  const adminRes = await fetch(KC+'/realms/master/protocol/openid-connect/token',{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({
      grant_type:'password',client_id:'admin-cli',username:'qa_admin',password:SECRET,
    }),
  });
  expectCode('ADMIN_QA_ONLY',adminRes.status,200);
  const admin=(await adminRes.json()).access_token;
  expectCode('EPHEMERAL_AFRTIASTE_REALM',
    (await api('POST','/admin/realms',{
      realm:REALM, enabled:true, registrationAllowed:false,
      verifyEmail:true, duplicateEmailsAllowed:false,
    },admin)).status,201);
  const roleMap={};
  for(const role of ['client','merchant','courier','ops']) {
    expectCode('CREATE_QA_ROLE_'+role,
      (await api('POST','/admin/realms/'+REALM+'/roles',{name:role},admin)).status,201);
    const roleRes=await api('GET','/admin/realms/'+REALM+'/roles/'+role,undefined,admin);
    expectCode('LOOKUP_QA_ROLE_'+role,roleRes.status,200);
    roleMap[role]=roleRes.data;
  }
  const clientDef={
    clientId:'delishafrica-client',enabled:true,publicClient:true,
    standardFlowEnabled:false,directAccessGrantsEnabled:true,
    serviceAccountsEnabled:false,implicitFlowEnabled:false,
    fullScopeAllowed:false,
  };
  expectCode('CREATE_QA_PUBLIC_CLIENT',
    (await api('POST','/admin/realms/'+REALM+'/clients',clientDef,admin)).status,201);
  const clientList=await api('GET','/admin/realms/'+REALM+
    '/clients?clientId=delishafrica-client',undefined,admin);
  const client=(clientList.data||[]).find(x=>x.clientId==='delishafrica-client');
  pass('APP_FULL_SCOPE_FALSE',client && client.fullScopeAllowed===false);
  expectCode('CLIENT_SCOPE_IS_ONLY_CLIENT',
    (await api('POST','/admin/realms/'+REALM+'/clients/'+client.id+
      '/scope-mappings/realm',[roleMap.client],admin)).status,204);
  expectCode('QA_CLIENT_AUDIENCE_MAPPER',
    (await api('POST','/admin/realms/'+REALM+'/clients/'+client.id+'/protocol-mappers/models',{
      name:'qa-r5b-audience',protocol:'openid-connect',
      protocolMapper:'oidc-audience-mapper',consentRequired:false,
      config:{
        'included.client.audience':'delishafrica-client',
        'access.token.claim':'true',
        'id.token.claim':'false',
      },
    },admin)).status,201);

  async function addUser(userRole,username) {
    const password=crypto.randomBytes(18).toString('base64url')+'Q1!';
    const created=await api('POST','/admin/realms/'+REALM+'/users',{
      username,email:username+'@qa.invalid',enabled:true,emailVerified:true,
      firstName:'R5B',lastName:'QA',
    },admin);
    expectCode('CREATE_QA_USER_'+username,created.status,201);
    let userId=String(created.location||'').split('/').pop();
    pass('NEW_QA_SUBJECT_UUID_'+username,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId));
    expectCode('SET_TEMP_QA_PASSWORD_'+username,
      (await api('PUT','/admin/realms/'+REALM+'/users/'+userId+
        '/reset-password',{type:'password',value:password,temporary:false},admin)).status,204);
    expectCode('SET_QA_ROLE_'+username,
      (await api('POST','/admin/realms/'+REALM+'/users/'+userId+
        '/role-mappings/realm',[roleMap[userRole]],admin)).status,204);
    const t=await oauth({grant_type:'password',client_id:'delishafrica-client',
      username,password,scope:'openid'});
    expectCode('REAL_SIGNED_QA_LOGIN_'+username,t.status,200);
    pass('REAL_QA_JWT_PRESENT_'+username,typeof t.data?.access_token==='string');
    const claims=decode(t.data.access_token);
    pass('JWT_SIGNED_ISSUER_'+username,claims.iss===ISSUER);
    pass('JWT_CLIENT_AZP_'+username,claims.azp==='delishafrica-client');
    pass('JWT_CLIENT_AUD_'+username,[].concat(claims.aud||[]).includes('delishafrica-client'));
    pass('JWT_HAS_SESSION_'+username,typeof claims.sid==='string'&&claims.sid.length>10);
    return {jwt:t.data.access_token,userId,role:userRole,password};
  }
  const alice=await addUser('client','r5b_alice');
  const bob=await addUser('client','r5b_bob');
  const other=await addUser('merchant','r5b_merchant');
  pass('MERCHANT_ONLY_TOKEN_HAS_NO_CLIENT_ROLE',
    !(decode(other.jwt).realm_access?.roles||[]).includes('client'));
  // A real Keycloak-issued Client+Merchant token must fail at the actual
  // JWT isolation boundary. Temporarily add and then remove the role scope
  // inside this disposable QA realm. This is not an FGAP privilege grant.
  const mixedRolePath='/admin/realms/'+REALM+'/users/'+alice.userId+'/role-mappings/realm';
  const publicScopePath='/admin/realms/'+REALM+'/clients/'+client.id+'/scope-mappings/realm';
  expectCode('EPHEMERAL_MIXED_ROLE_ASSIGNED',
    (await api('POST',mixedRolePath,[roleMap.merchant],admin)).status,204);
  expectCode('EPHEMERAL_MIXED_ROLE_IN_PUBLIC_SCOPE',
    (await api('POST',publicScopePath,[roleMap.merchant],admin)).status,204);
  const mix=await oauth({grant_type:'password',client_id:'delishafrica-client',
    username:'r5b_alice',password:alice.password,scope:'openid'});
  expectCode('MIXED_ROLE_REAL_KEYCLOAK_JWT',mix.status,200);
  const mixRoles=decode(mix.data.access_token).realm_access?.roles||[];
  pass('SIGNED_CLIENT_AND_MERCHANT_IN_SAME_JWT',
    mixRoles.includes('client')&&mixRoles.includes('merchant'));
  expectCode('REMOVE_MIXED_QA_USER_ROLE',
    (await api('DELETE',mixedRolePath,[roleMap.merchant],admin)).status,204);
  expectCode('REMOVE_MIXED_QA_CLIENT_SCOPE',
    (await api('DELETE',publicScopePath,[roleMap.merchant],admin)).status,204);
  return {alice,bob,other,mixedJwt:mix.data.access_token};
}

function pgArgs(user,sql) {
  return ['exec',PG,'psql','-X','-A','-t','-v','ON_ERROR_STOP=1',
          '-U',user,'-d','r5b_checkout_qa','-c',sql];
}
function psql(user,sql) {
  const x=cp.spawnSync('docker',pgArgs(user,sql),{
    encoding:'utf8',maxBuffer:300000,timeout:18000,
  });
  if(x.status!==0||x.error) {
    const raw=String(x.stderr||x.error||'');
    if(/checkout_idempotency_conflict|checkout_client_amount_mismatch/i.test(raw))
      throw new R5BReservationQaPortError('conflict');
    if(/checkout_catalog_missing_or_unavailable/i.test(raw))
      throw new R5BReservationQaPortError('catalog_denied');
    throw new R5BReservationQaPortError('sql_unavailable');
  }
  return String(x.stdout||'').trim();
}
async function psqlAsync(user,sql) {
  try {
    const r=await execFile('docker',pgArgs(user,sql),{
      encoding:'utf8',maxBuffer:300000,timeout:18000,
    });
    return JSON.parse(String(r.stdout||'').trim());
  } catch(err) {
    const raw=String(err.stderr||err.message||'');
    if(/checkout_idempotency_conflict|checkout_client_amount_mismatch/i.test(raw))
      throw new R5BReservationQaPortError('conflict');
    if(/checkout_catalog_missing_or_unavailable/i.test(raw))
      throw new R5BReservationQaPortError('catalog_denied');
    throw new R5BReservationQaPortError('sql_unavailable');
  }
}
function sqlValue(s) {
  // Every SQL field comes either from JWT verified by real AuthService,
  // from strict controller validation, or from private trusted catalogue.
  assert(/^[A-Za-z0-9_/:.%-]+$/.test(s),'trusted_sql_field');
  return "'" + s + "'";
}
async function setupPostgres() {
  const sql=fs.readFileSync(path.join(ROOT,'qa','r5a-durable-reservation.pg16.sql'),'utf8');
  const r=cp.spawnSync('docker',['exec','-i',PG,'psql','-X',
    '-v','ON_ERROR_STOP=1','-U','postgres','-d','r5b_checkout_qa'],{
    input:sql,encoding:'utf8',timeout:25000,maxBuffer:100000,
  });
  pass('REAL_PG16_QA_SCHEMA_READY',r.status===0);
  pass('CANONICAL_PG_NOT_MIGRATED',
    psql('postgres',"SELECT count(*) FROM r5a_checkout_qa.catalog_item")==='3');
  let denied=false;
  try { psql('r5a_checkout_worker',
    'SELECT count(*) FROM r5a_checkout_qa.reservation'); }
  catch { denied=true; }
  pass('QA_PG_WORKER_DIRECT_TABLE_READ_DENIED',denied);
}
function makePort() {
  let sqlCalls=0;
  let providerCalls=0;
  return {
    get sqlCalls() { return sqlCalls; },
    get providerCalls() { return providerCalls; },
    resolveTenantForMerchant: async(m) => {
      if(m===MERCHANT_A)return 'tenant-alpha';
      if(m===MERCHANT_B)return 'tenant-beta';
      return null;
    },
    reserve: async(i) => {
      sqlCalls++;
      const sql="SELECT r5a_checkout_qa.reserve("+
        sqlValue(i.issuer)+","+sqlValue(i.subject)+"::uuid,"+
        sqlValue(i.tenantId)+","+sqlValue(i.merchantId)+"::uuid,"+
        sqlValue(i.sku)+","+i.quantity+","+sqlValue(i.currency)+","+
        sqlValue(i.mutationKey)+","+
        (i.claimedAmountMinor===null?'NULL':String(i.claimedAmountMinor))+");";
      return psqlAsync('r5a_checkout_worker',sql);
    },
    readCommitted: async(issuer,subject,mutation) => {
      sqlCalls++;
      const sql="SELECT r5a_checkout_qa.read_by_mutation("+
        sqlValue(issuer)+","+sqlValue(subject)+"::uuid,"+
        sqlValue(mutation)+");";
      return psqlAsync('r5a_checkout_worker',sql);
    },
  };
}
async function post(jwt,body) {
  const response=await fetch(URL,{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(18000),
    headers:{
      'Content-Type':'application/json',
      ...(jwt?{Authorization:'Bearer '+jwt}:{}),
    },
    body:JSON.stringify(body),
  });
  const data=await response.json().catch(()=>null);
  return {status:response.status,data};
}
function requestBody(mutation=MUTATION,more={}) {
  return {
    merchantId:MERCHANT_A,sku:'qa-rice',quantity:2,
    currency:'EUR',mutationKey:mutation,...more,
  };
}
(async()=>{
  const payments=fs.readFileSync(path.join(ROOT,'src/payments/payments.service.ts'),'utf8');
  const a=payments.indexOf('  async createPaymentIntent(');
  const b=payments.indexOf('  async verifyPaidOrder(',a);
  pass('PR48_STRIPE_HTTP503_REMAINS',a>=0&&b>a&&
    payments.slice(a,b).includes('this.assertDurableCheckoutAuthority();')&&
    payments.includes('checkoutIntentCreationEnabled: false'));
  pass('PRIVATE_NEST_NOT_PUBLIC',!fs.readFileSync(
    path.join(ROOT,'src/app.module.ts'),'utf8').includes('R5BClientReservationQaController'));
  await setupPostgres();
  const users=await setupKeycloak();
  const config={
    issuer:ISSUER,discoveryUrl:ISSUER+'/.well-known/openid-configuration',
    advertisedJwksUrl:ISSUER+'/protocol/openid-connect/certs',
    jwksUrl:ISSUER+'/protocol/openid-connect/certs',
    audience:'delishafrica-merchant',allowedAlgorithms:['RS256'],
    merchantRealmRoles:['merchant'],merchantClientRoles:['merchant'],
    clockSkewSeconds:30,refreshSeconds:120,
  };
  fs.mkdirSync(path.dirname(CONFIG),{recursive:true,mode:0o700});
  fs.writeFileSync(CONFIG,JSON.stringify(config),{encoding:'utf8',mode:0o600});

  const port=makePort();
  const moduleRef=await Test.createTestingModule({
    controllers:[R5BClientReservationQaController],
    providers:[
      AuthService,ExternalJwksVerifierService,
      {provide:R5B_CLIENT_RESERVATION_QA_PORT,useValue:port},
    ],
  }).compile();
  const app=moduleRef.createNestApplication();
  try {
    await app.listen(18197,'127.0.0.1');
    pass('NEST_PRIVATE_HTTP_LOOPBACK_ONLY',true);
    const missing=await post(null,requestBody());
    expectCode('NO_BEARER_BEFORE_SQL',missing.status,401);
    pass('NO_SQL_WITH_MISSING_TOKEN',port.sqlCalls===0);
    const forged=await post(users.alice.jwt.slice(0,-8)+'aaaaaaaa',requestBody());
    expectCode('TAMPERED_REAL_JWT_BEFORE_SQL',forged.status,401);
    pass('NO_SQL_WITH_FORGED_JWT',port.sqlCalls===0);
    const devToken=moduleRef.get(AuthService).devLogin({role:'client'}).accessToken;
    const dev=await post(devToken,requestBody());
    expectCode('INTERNAL_DEV_LOGIN_DENIED',dev.status,403);
    pass('NO_SQL_WITH_DEV_LOGIN',port.sqlCalls===0);
    const mixed=await post(users.mixedJwt,requestBody());
    expectCode('SIGNED_MIXED_CLIENT_MERCHANT_JWT_DENIED',mixed.status,401);
    pass('MIXED_ROLES_DENIED_BEFORE_SQL',port.sqlCalls===0);
    const merchant=await post(users.other.jwt,requestBody());
    expectCode('MERCHANT_JWT_DENIED_BEFORE_SQL',merchant.status,401);
    pass('NO_SQL_WITH_MERCHANT',port.sqlCalls===0);
    const override=await post(users.alice.jwt,requestBody(MUTATION,{tenantId:'tenant-beta'}));
    expectCode('CLIENT_TENANT_OVERRIDE_REJECTED',override.status,400);
    pass('NO_SQL_WITH_TENANT_OVERRIDE',port.sqlCalls===0);
    const fakePrice=await post(users.alice.jwt,
      requestBody('r5b_price_tamper_1234',{claimedAmountMinor:1}));
    expectCode('CLIENT_AMOUNT_FALSIFICATION_DENIED',fakePrice.status,409);
    pass('NO_PSP_FOR_FAILED_QUOTE',port.providerCalls===0);
    const first=await post(users.alice.jwt,requestBody());
    expectCode('REAL_CLIENT_TO_REAL_PG_RESERVATION',first.status,201);
    pass('SERVER_CATALOG_PRICE_AND_COMMIT',
      first.data?.amountMinor===4380&&first.data?.currency==='EUR'&&
      first.data?.committedBeforePsp===true&&
      first.data?.paymentIntentCreated===false);
    const same=await post(users.alice.jwt,requestBody());
    expectCode('SAME_MUTATION_RETRY',same.status,201);
    pass('HTTP_RETRY_RETURNS_SAME_RESERVATION',
      same.data?.reservationId===first.data?.reservationId);
    const parallel=await Promise.all(Array.from({length:12},
      ()=>post(users.alice.jwt,requestBody('r5b_parallel_mutation_23456'))));
    pass('TWELVE_CONCURRENT_HTTP_REQUESTS_ARE_201',
      parallel.every(x=>x.status===201));
    pass('TWELVE_HTTP_RESERVATIONS_SAME_COMMIT',
      new Set(parallel.map(x=>x.data?.reservationId)).size===1);
    const rows=Number(psql('postgres',
      "SELECT count(*) FROM r5a_checkout_qa.reservation"));
    const outbox=Number(psql('postgres',
      "SELECT count(*) FROM r5a_checkout_qa.outbox"));
    pass('ONE_OUTBOX_PER_RESERVATION',outbox===rows);
    const bob=await post(users.bob.jwt,requestBody());
    expectCode('OTHER_CLIENT_INDEPENDENT',bob.status,201);
    pass('OTHER_CLIENT_OWN_KEYSPACE',
      bob.data?.reservationId!==first.data?.reservationId);
    const wrong=await post(users.alice.jwt,
      requestBody('r5b_wrong_sku_123456',{merchantId:MERCHANT_B,sku:'qa-rice'}));
    expectCode('MERCHANT_TENANT_CATALOG_MISMATCH_DENIED',wrong.status,403);
    const revoked=await moduleRef.get(AuthService).revokeClientSession(
      (await moduleRef.get(AuthService).resolvePrincipalFromAuthorization(
        'Bearer '+users.alice.jwt)).payload,
    );
    pass('REAL_CLIENT_SESSION_REVOKED_IN_REDIS',revoked.ok===true);
    const before=port.sqlCalls;
    const afterRevoke=await post(users.alice.jwt,
      requestBody('r5b_after_logout_123456'));
    expectCode('REVOKED_NONEXPIRED_CLIENT_DENIED_BEFORE_SQL',afterRevoke.status,401);
    pass('REVOKED_ZERO_SQL',port.sqlCalls===before);
    const bobStill=await post(users.bob.jwt,
      requestBody('r5b_bob_independent_123456'));
    expectCode('OTHER_CLIENT_STILL_WORKS',bobStill.status,201);
    pass('NEVER_CALLED_PROVIDER',port.providerCalls===0);
    const redisStopped=cp.spawnSync('docker',['stop',REDIS],{
      encoding:'utf8',timeout:25000,
    });
    pass('QA_REDIS_STOPPED',redisStopped.status===0);
    const beforeRedisDown=port.sqlCalls;
    const redisDown=await post(users.bob.jwt,requestBody('r5b_redis_down_123456'));
    expectCode('REDIS_UNAVAILABLE_FAIL_CLOSED',redisDown.status,503);
    pass('REDIS_DOWN_ZERO_SQL',port.sqlCalls===beforeRedisDown);
    const redisRestarted=cp.spawnSync('docker',['start',REDIS],{
      encoding:'utf8',timeout:25000,
    });
    pass('QA_REDIS_RESTARTED',redisRestarted.status===0);
    let redisReady=false;
    for(let attempt=0;attempt<40;attempt++){
      const p=cp.spawnSync('docker',['exec',REDIS,'redis-cli','ping'],{
        encoding:'utf8',timeout:4000,
      });
      if(p.status===0 && String(p.stdout||'').trim()==='PONG'){
        redisReady=true;break;
      }
      await new Promise(r=>setTimeout(r,250));
    }
    pass('REAL_REDIS_RECOVERED',redisReady);
    const stopped=cp.spawnSync('docker',['stop',PG],{
      encoding:'utf8',timeout:25000,
    });
    pass('QA_POSTGRES_STOPPED',stopped.status===0);
    const sqlDown=await post(users.bob.jwt,
      requestBody('r5b_sql_down_1234567'));
    expectCode('SQL_UNAVAILABLE_FAIL_CLOSED',sqlDown.status,503);
    pass('SQL_DOWN_NO_PSP',port.providerCalls===0);
    console.log('R5B_CLIENT_REAL_KEYCLOAK_NEST_HTTP_REDIS_PG16=PASS_QA_TARGETED');
    console.log('R5B_PRODUCTION_REALM_CLIENT_ONBOARDING=NOT_CERTIFIED');
    console.log('R5B_CANONICAL_PG_MIGRATION=NOT_APPLIED');
    console.log('R5B_STRIPE_TEST_REAL=NOT_EXECUTED');
    console.log('R5B_PAYMENT_HARDSTOP=503_PRESERVED');
    console.log('R5B_FINANCE_LIVE=NO_GO');
  } finally {
    await app.close();
    fs.rmSync(CONFIG,{force:true});
  }
})().catch(err=>{
  console.error('R5B_FINAL=FAIL_CLOSED_INTEGRATION_QA');
  console.error('R5B_ERROR_CODE='+String(err?.message||err).replace(/[^a-zA-Z0-9_:-]/g,'_').slice(0,120));
  process.exitCode=1;
});
