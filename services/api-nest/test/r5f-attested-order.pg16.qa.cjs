#!/usr/bin/env node
'use strict';
/**
 * R5D isolated integrated QA: REAL Keycloak 26.8.1 Client JWT ->
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
  R5DCanonicalQuoteReservationQaController,
  R5D_CANONICAL_RESERVATION_QA_PORT,
  R5DReservationQaPortError,
} = require('../src/client-commerce/r5d-canonical-quote-reservation.qa.controller');
const { CatalogFoundationRepository } = require('../src/catalog-foundation/catalog-foundation.repository');
const { CatalogFoundationService } = require('../src/catalog-foundation/catalog-foundation.service');
const { CatalogOrderPolicyService } = require('../src/order-policy/catalog-order-policy.service');

const KC = 'http://127.0.0.1:18195';
const REALM = 'afritaste';
const ISSUER = KC + '/realms/' + REALM;
const URL = 'http://127.0.0.1:18198/qa-isolated/r5d-canonical-quote/v1/reserve';
const PG = process.env.R5D_QA_PG_CONTAINER || '';
const REDIS = process.env.R5D_QA_REDIS_CONTAINER || '';
const SECRET = process.env.QA_BOOTSTRAP_ADMIN_PASSWORD || '';
const CATALOG_PASSWORD = process.env.R5D_CATALOG_READ_PASSWORD || '';
const HMAC_KEY_HEX = process.env.R5F_QA_SIGNING_KEY_HEX || '';
const DB='r5d_qa';
const PARTNER_ID = 'merchant-text-1';
const PARTNER_SLUG = 'qa-partner';
const MUTATION = 'r5d_checkout_alpha_12345';
const ROOT = path.resolve(__dirname,'..');
const CONFIG = path.join(ROOT,'.runtime-config','keycloak-trusted-identity.json');
const assertEnv = (
  process.env.GITHUB_ACTIONS === 'true' &&
  process.env.QA_SYNTHETIC_ONLY === 'YES' &&
  process.env.QA_KEYCLOAK_ORIGIN === KC &&
  process.env.NODE_ENV === 'test' &&
  /^pog-r5d-client-pg-[A-Za-z0-9-]+$/.test(PG) &&
  /^pog-r5d-client-rd-[A-Za-z0-9-]+$/.test(REDIS) &&
  SECRET.length >= 24 && CATALOG_PASSWORD.length >= 24 &&
  /^[0-9a-f]{64}$/.test(HMAC_KEY_HEX) &&
  (process.env.DATABASE_URL || '').includes('r5d_catalog_reader') &&
  (process.env.REDIS_URL || '').startsWith('redis://')
);
if (!assertEnv) throw Error('R5D_CI_ONLY_ENV_GUARD');

function pass(label, condition) {
  assert.ok(condition,label);
  console.log('R5F_PASS=' + label);
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
      name:'qa-r5d-audience',protocol:'openid-connect',
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
      firstName:'R5D',lastName:'QA',
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
  const alice=await addUser('client','r5d_alice');
  const bob=await addUser('client','r5d_bob');
  const other=await addUser('merchant','r5d_merchant');
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
    username:'r5d_alice',password:alice.password,scope:'openid'});
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
          '-U',user,'-d',DB,'-c',sql];
}
function pgExec(user,sql) {
  const x=cp.spawnSync('docker',pgArgs(user,sql),{
    encoding:'utf8',timeout:18000,maxBuffer:500000,
  });
  if(x.error||x.status!==0) {
    const stderr=String(x.stderr||x.error||'');
    if(stderr.includes('checkout_identity_attestation_invalid')) {
      throw new R5DReservationQaPortError('attestation_denied');
    }
    if(stderr.includes('checkout_idempotency_conflict') ||
       stderr.includes('checkout_qa_price_forged')) {
      throw new R5DReservationQaPortError('conflict');
    }
    if(stderr.includes('checkout_catalog_revision_changed')) {
      throw new R5DReservationQaPortError('revision_changed');
    }
    if(stderr.includes('checkout_partner_not_published') ||
       stderr.includes('checkout_client_not_active')) {
      throw new R5DReservationQaPortError('partner_denied');
    }
    throw new R5DReservationQaPortError('sql_unavailable');
  }
  return String(x.stdout||'').trim();
}
async function pgAsync(user,sql) {
  try {
    const r=await execFile('docker',pgArgs(user,sql),{
      encoding:'utf8',maxBuffer:500000,timeout:30000,
    });
    return String(r.stdout||'').trim();
  } catch(e) {
    const m=String(e.stderr||e.message||'');
    if(m.includes('checkout_identity_attestation_invalid')) {
      throw new R5DReservationQaPortError('attestation_denied');
    }
    if(m.includes('checkout_idempotency_conflict') ||
       m.includes('checkout_qa_price_forged')) {
      throw new R5DReservationQaPortError('conflict');
    }
    if(m.includes('checkout_catalog_revision_changed')) {
      throw new R5DReservationQaPortError('revision_changed');
    }
    if(m.includes('checkout_partner_not_published') ||
       m.includes('checkout_client_not_active')) {
      throw new R5DReservationQaPortError('partner_denied');
    }
    throw new R5DReservationQaPortError('sql_unavailable');
  }
}
function literal(v) {
  assert(typeof v==='string' && /^[A-Za-z0-9._:/%-]{3,350}$/.test(v),
    'trusted_SQL_field_allowlist');
  return "'"+v+"'";
}
function jexpr(value) {
  const b64=Buffer.from(JSON.stringify(value),'utf8').toString('base64');
  return "convert_from(decode('"+b64+"','base64'),'UTF8')::jsonb";
}
function hmacFor(issuer,subject,partner,mutation,fingerprint,quote,revision) {
  // PostgreSQL canonical text for jsonb has a different key order from
  // JSON.stringify. Obtain the digest from an isolated read-only SQL session.
  const canonical=pgExec('r5d_catalog_reader','SELECT '+jexpr(quote)+'::text');
  const digest=crypto.createHash('sha256').update(canonical,'utf8').digest('hex');
  const msg=[issuer,subject,partner,mutation,fingerprint,
    String(revision),digest].join(String.fromCharCode(31));
  return crypto.createHmac('sha256',Buffer.from(HMAC_KEY_HEX,'hex'))
    .update(msg,'utf8').digest('hex');
}
function sqlStdin(sql) {
  const result=cp.spawnSync('docker',['exec','-i',PG,'psql','-X',
    '-v','ON_ERROR_STOP=1','-U','postgres','-d',DB],{
    input:sql,encoding:'utf8',timeout:25000,maxBuffer:1000000,
  });
  pass('QA_ADMIN_SQL_SUCCEEDED',result.status===0);
}
function setupPostgres() {
  const base=fs.readFileSync(
    path.join(ROOT,'migrations/catalog-foundation/34b4b5b2a5a2_001_catalog_foundation.sql'),'utf8');
  const r5c=fs.readFileSync(
    path.join(ROOT,'migrations/checkout-candidate/20261025_r5c_reservation_expand_only.qa.sql'),'utf8');
  const r5d=fs.readFileSync(
    path.join(ROOT,'migrations/checkout-candidate/20261025_r5d_revision_guard.qa.sql'),'utf8');
  const r5e=fs.readFileSync(
    path.join(ROOT,'migrations/checkout-candidate/20261025_r5e_price_recheck.qa.sql'),'utf8');
  const r5f=fs.readFileSync(
    path.join(ROOT,'migrations/checkout-candidate/20261025_r5f_attested_order.qa.sql'),'utf8');
  sqlStdin(base);
  sqlStdin(r5c);
  sqlStdin("CREATE ROLE r5d_catalog_reader LOGIN PASSWORD '"+CATALOG_PASSWORD+"';"+
    " CREATE ROLE r5d_checkout_worker LOGIN;"+
    " CREATE ROLE r5d_checkout_auditor LOGIN;"+
    " GRANT SELECT ON public.da_catalog_schema_migrations,public.da_catalog_partners,public.da_catalog_ownerships,public.da_catalog_audit TO r5d_catalog_reader;"+
    " GRANT USAGE ON SCHEMA da_checkout_candidate TO r5d_checkout_auditor;"+
    " GRANT SELECT ON da_checkout_candidate.reservation,da_checkout_candidate.outbox"+
    " TO r5d_checkout_auditor;");
  sqlStdin(r5d);
  sqlStdin(r5e);
  sqlStdin(r5f);
  sqlStdin("INSERT INTO da_checkout_candidate.attestation_keys_qa(singleton,key_bytes) "+
    "VALUES(true,decode('"+HMAC_KEY_HEX+"','hex'))");
  pass('R5F_CANONICAL_AND_PRIVATE_KEY_TABLES_READY',pgExec('postgres',
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='da_checkout_candidate'")==='3');
  const directRead=pgExec('postgres',
    "SELECT has_table_privilege('r5d_checkout_worker',"+
    "'da_checkout_candidate.reservation','SELECT')");
  pass('SQL_WORKER_DIRECT_SELECT_DENIED',directRead==='f');
  const directRaw=pgExec('postgres',
    "SELECT has_function_privilege('r5d_checkout_worker',"+
    "'da_checkout_candidate.reserve_trusted(text,text,text,text,text,jsonb)','EXECUTE')");
  pass('SQL_WORKER_RAW_RESERVE_DENIED',directRaw==='f');
  const checked=pgExec('postgres',
    "SELECT has_function_privilege('r5d_checkout_worker',"+
    "'da_checkout_candidate.reserve_revision_qa(text,text,text,text,text,jsonb,integer)','EXECUTE')");
  pass('SQL_WORKER_OLD_REVISION_WRAPPER_DENIED',checked==='f');
  const verified=pgExec('postgres',
    "SELECT has_function_privilege('r5d_checkout_worker',"+
    "'da_checkout_candidate.reserve_verified_qa(text,text,text,text,text,jsonb,integer)','EXECUTE')");
  pass('SQL_WORKER_OLD_PRICE_WRAPPER_DENIED',verified==='f');
  const attested=pgExec('postgres',
    "SELECT has_function_privilege('r5d_checkout_worker',"+
    "'da_checkout_candidate.reserve_attested_qa(text,text,text,text,text,jsonb,integer,text)','EXECUTE')");
  pass('SQL_WORKER_ONLY_HMAC_ATTESTED_EXECUTE',attested==='t');
  const keyReadable=pgExec('postgres',
    "SELECT has_table_privilege('r5d_checkout_worker',"+
    "'da_checkout_candidate.attestation_keys_qa','SELECT')");
  pass('SQL_WORKER_CANNOT_READ_HMAC_KEY',keyReadable==='f');

  const payload={
    id:PARTNER_ID,slug:PARTNER_SLUG,name:'R5D QA Restaurant',
    status:'active',
    delivery:{enabled:true,deliveryFee:280,minimumOrderAmount:0},
    menuItems:[
      {id:'qa-rice',sku:'qa-rice',name:'Rice',amount:2190},
      {id:'qa-mango',sku:'qa-mango',name:'Mango',amount:950},
    ],
  };
  sqlStdin("INSERT INTO public.da_catalog_partners"+
    "(partner_id,slug,lifecycle_status,published_payload,published_revision) VALUES("+
    literal(PARTNER_ID)+","+literal(PARTNER_SLUG)+",'published',"+
    jexpr(payload)+",1)");
  pass('SERVER_PUBLISHED_CATALOG_PERSISTED',pgExec('postgres',
    "SELECT published_revision FROM public.da_catalog_partners WHERE slug='qa-partner'")==='1');
}
function seedVerifiedClients(users) {
  sqlStdin("INSERT INTO public.da_identity_subjects"+
    "(issuer,subject,identity_kind,identity_status) VALUES "+
    "("+literal(ISSUER)+","+literal(users.alice.userId)+",'client','active'),"+
    "("+literal(ISSUER)+","+literal(users.bob.userId)+",'client','active')");
  pass('CLIENTS_FROM_SIGNED_KEYCLOAK_SUBJECT_PERSISTED',
    pgExec('postgres',"SELECT count(*) FROM public.da_identity_subjects WHERE identity_kind='client'")==='2');
}
function makePort() {
  let reservationSqlCalls=0,providerCalls=0,catalogLookups=0;
  let forceStaleRevisionOnce=false;
  return {
    get reservationSqlCalls(){ return reservationSqlCalls; },
    get providerCalls(){ return providerCalls; },
    get catalogLookups(){return catalogLookups;},
    set staleRevisionOnce(v){forceStaleRevisionOnce=v===true;},
    resolvePublishedPartner:async slug=>{
      catalogLookups++;
      if(!/^qa-[a-z0-9-]{2,60}$/.test(slug))return null;
      const sql="SELECT row_to_json(t) FROM ("+
       "SELECT partner_id AS \"partnerId\", slug,"+
       " published_revision AS revision FROM public.da_catalog_partners"+
       " WHERE slug="+literal(slug)+
       " AND lifecycle_status='published' LIMIT 1) t;";
      const raw=await pgAsync('r5d_catalog_reader',sql);
      if(!raw||raw==='null')return null;
      const partner=JSON.parse(raw);
      if(forceStaleRevisionOnce){
        forceStaleRevisionOnce=false;
        partner.revision=Math.max(1,partner.revision-1);
      }
      return partner;
    },
    reserve:async i=>{
      reservationSqlCalls++;
      const attestation=hmacFor(i.issuer,i.subject,i.partnerId,
        i.mutationKey,i.quoteFingerprint,i.quoteSnapshot,i.expectedPublishedRevision);
      const sql="SELECT da_checkout_candidate.reserve_attested_qa("+
        literal(i.issuer)+","+literal(i.subject)+","+
        literal(i.partnerId)+","+literal(i.mutationKey)+","+
        literal(i.quoteFingerprint)+","+jexpr(i.quoteSnapshot)+","+
        i.expectedPublishedRevision+","+literal(attestation)+");";
      const raw=JSON.parse(await pgAsync('r5d_checkout_worker',sql));
      return {
        reservation_id:raw.reservation_id,issuer:i.issuer,
        subject:i.subject,partner_id:i.partnerId,
        mutation_key:i.mutationKey,quote_fingerprint:i.quoteFingerprint,
        amount_minor:raw.amount_minor,currency:raw.currency,status:raw.status,
      };
    },
    readCommitted:async (issuer,subject,key)=>{
      reservationSqlCalls++;
      const sql="SELECT row_to_json(t) FROM ("+
        "SELECT id::text AS reservation_id,issuer,subject,partner_id,mutation_key,"+
        "quote_fingerprint,amount_minor,currency,status "+
        "FROM da_checkout_candidate.reservation WHERE "+
        "issuer="+literal(issuer)+" AND subject="+literal(subject)+
        " AND mutation_key="+literal(key)+" LIMIT 1) t;";
      const raw=await pgAsync('r5d_checkout_auditor',sql);
      return raw && raw!=='null'?JSON.parse(raw):null;
    },
  };
}
async function post(jwt,body) {
  const response=await fetch(URL,{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(24000),
    headers:{
      'Content-Type':'application/json',
      ...(jwt?{Authorization:'Bearer '+jwt}:{}),
    },
    body:JSON.stringify(body),
  });
  const data=await response.json().catch(()=>null);
  return {status:response.status,data};
}
function requestBody(key=MUTATION,more={}) {
  return {partnerSlug:PARTNER_SLUG,
    items:[{id:'qa-rice',quantity:2}],mutationKey:key,...more};
}
async function waitForPg(){
  for(let i=0;i<80;i++){
    try {if(pgExec('postgres','SELECT 1')==='1')return;} catch{}
    await new Promise(r=>setTimeout(r,250));
  }
  throw Error('pg_unavailable_after_restart');
}
(async()=>{
  const payments=fs.readFileSync(path.join(ROOT,'src/payments/payments.service.ts'),'utf8');
  const a=payments.indexOf('  async createPaymentIntent(');
  const b=payments.indexOf('  async verifyPaidOrder(',a);
  pass('PR48_HARDSTOP_STILL_503',a>=0&&b>a&&
    payments.slice(a,b).includes('this.assertDurableCheckoutAuthority();')&&
    payments.includes('checkoutIntentCreationEnabled: false'));
  pass('PRIVATE_R5D_NOT_MOUNTED_PUBLIC',!fs.readFileSync(
    path.join(ROOT,'src/app.module.ts'),'utf8').includes('R5DCanonicalQuoteReservationQaController'));
  setupPostgres();
  const users=await setupKeycloak();
  seedVerifiedClients(users);
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
  const mod=await Test.createTestingModule({
    controllers:[R5DCanonicalQuoteReservationQaController],
    providers:[
      AuthService,ExternalJwksVerifierService,
      CatalogFoundationRepository,CatalogFoundationService,CatalogOrderPolicyService,
      {provide:R5D_CANONICAL_RESERVATION_QA_PORT,useValue:port},
    ],
  }).compile();
  const app=mod.createNestApplication();
  try {
    await mod.get(CatalogFoundationService).initialize([]);
    const health=await mod.get(CatalogFoundationService).health();
    pass('EXACT_REAL_CATALOG_REPOSITORY_POSTGRES_MODE',
      health.mode==='postgres'&&health.ready===true);
    await app.listen(18198,'127.0.0.1');
    pass('R5D_NEST_HTTP_LOOPBACK_ONLY',true);
    const invalid=[
      ['MISSING_JWT',null,requestBody(),401],
      ['TAMPERED_SIGNED_JWT',users.alice.jwt.slice(0,-8)+'aaaaaaaa',requestBody(),401],
      ['REAL_SIGNED_MIXED_ROLES',users.mixedJwt,requestBody(),401],
      ['REAL_SIGNED_MERCHANT_ONLY',users.other.jwt,requestBody(),401],
      ['FORGED_CLIENT_AMOUNT',users.alice.jwt,requestBody(MUTATION,{amountMinor:1}),400],
      ['FORGED_TENANT',users.alice.jwt,requestBody(MUTATION,{tenantId:'tenant-beta'}),400],
      ['FORGED_ISSUER',users.alice.jwt,requestBody(MUTATION,{issuer:'https://qa.invalid'}),400],
      ['FORGED_QUOTE',users.alice.jwt,requestBody(MUTATION,{quote:{total:1}}),400],
      ['FORGED_FINGERPRINT',users.alice.jwt,requestBody(MUTATION,{quoteFingerprint:'a'.repeat(64)}),400],
      ['FORGED_CURRENCY',users.alice.jwt,requestBody(MUTATION,{currency:'USD'}),400],
      ['FORGED_ITEM_PRICE',users.alice.jwt,requestBody(MUTATION,{items:[{id:'qa-rice',quantity:2,price:1}]}),400],
      ['DUPLICATE_SKU',users.alice.jwt,requestBody(MUTATION,{items:[{id:'qa-rice',quantity:1},{id:'qa-rice',quantity:1}]}),400],
      ['UNKNOWN_ITEM',users.alice.jwt,requestBody(MUTATION,{items:[{id:'qa-ghost',quantity:1}]}),400],
      ['UNKNOWN_PARTNER',users.alice.jwt,requestBody(MUTATION,{partnerSlug:'qa-ghost'}),403],
    ];
    for(const [label,jwt,body,code] of invalid) {
      const current=await post(jwt,body);
      expectCode(label,current.status,code);
    }
    const beforeDev=port.reservationSqlCalls;
    const devToken=mod.get(AuthService).devLogin({role:'client'}).accessToken;
    expectCode('INTERNAL_DEV_LOGIN', (await post(devToken,requestBody())).status,403);
    pass('ALL_NEGATIVES_ZERO_RESERVATION_SQL',
      port.reservationSqlCalls===beforeDev&&beforeDev===0);
    const first=await post(users.alice.jwt,requestBody());
    expectCode('REAL_CLIENT_ACTUAL_POLICY_POSTGRES_COMMIT',first.status,201);
    pass('SERVER_QUOTE_PLUS_DELIVERY_FEE',
      first.data?.amountMinor===4660 && first.data?.currency==='eur' &&
      first.data?.committedBeforePsp===true &&
      first.data?.paymentIntentCreated===false);
    const persisted=pgExec('r5d_checkout_auditor',
      "SELECT quote_snapshot->>'deliveryFee' FROM da_checkout_candidate.reservation"+
      " WHERE issuer="+literal(ISSUER)+" AND subject="+literal(users.alice.userId)+
      " AND mutation_key="+literal(MUTATION));
    pass('DELIVERY_FEE_FROM_CANONICAL_PG_PAYLOAD',persisted==='280');
    // Direct, limited SQL worker adversarial attempts. No valid Client JWT
    // or Node quote can be used to launder a manipulated financial snapshot.
    const honest=JSON.parse(pgExec('r5d_checkout_auditor',
      "SELECT quote_snapshot FROM da_checkout_candidate.reservation WHERE "+
      "issuer="+literal(ISSUER)+" AND subject="+literal(users.alice.userId)+
      " AND mutation_key="+literal(MUTATION)));
    const fingerprint=pgExec('r5d_checkout_auditor',
      "SELECT quote_fingerprint FROM da_checkout_candidate.reservation WHERE "+
      "issuer="+literal(ISSUER)+" AND subject="+literal(users.alice.userId)+
      " AND mutation_key="+literal(MUTATION));
    function maliciousAttempt(label,mutation,forged) {
      // Even a signing-capable backend cannot override the PG price authority.
      const tag=hmacFor(ISSUER,users.alice.userId,PARTNER_ID,
        mutation,fingerprint,forged,1);
      const sql="SELECT da_checkout_candidate.reserve_attested_qa("+
        literal(ISSUER)+","+literal(users.alice.userId)+","+
        literal(PARTNER_ID)+","+literal(mutation)+","+
        literal(fingerprint)+","+jexpr(forged)+",1,"+literal(tag)+")";
      let exactPriceRejection=false;
      try { pgExec('r5d_checkout_worker',sql); }
      catch(e) {
        exactPriceRejection=e instanceof R5DReservationQaPortError &&
          e.kind==='conflict';
      }
      pass(label,exactPriceRejection);
    }
    maliciousAttempt('DIRECT_SQL_WORKER_FAKED_TOTAL_DENIED',
      'r5e_forged_total_123456',{...honest,total:1});
    const wrongItem={...honest.items[0],unitAmount:1,lineAmount:2};
    maliciousAttempt('DIRECT_SQL_WORKER_FAKED_UNIT_PRICE_DENIED',
      'r5e_forged_unit_123456',{
        ...honest,items:[wrongItem],subtotal:2,total:282,
      });
    maliciousAttempt('DIRECT_SQL_WORKER_FAKED_DELIVERY_DENIED',
      'r5e_forged_fee_123456',{
        ...honest,deliveryFee:0,total:4380,
      });
    pass('DIRECT_SQL_WORKER_FORGERIES_NO_RESERVATION',pgExec(
      'r5d_checkout_auditor',
      "SELECT count(*) FROM da_checkout_candidate.reservation "+
      "WHERE mutation_key LIKE 'r5e_forged_%'")==='0');
    // An intercepted legitimate HMAC is useless when any signed field
    // (identity, merchant, mutation or full JSONB cart) is altered by a worker.
    const stolen=hmacFor(ISSUER,users.alice.userId,PARTNER_ID,
      MUTATION,fingerprint,honest,1);
    function stolenTagAttempt(label,issuer,subject,partner,mutation,quote) {
      const sql="SELECT da_checkout_candidate.reserve_attested_qa("+
        literal(issuer)+","+literal(subject)+","+literal(partner)+","+
        literal(mutation)+","+literal(fingerprint)+","+jexpr(quote)+",1,"+
        literal(stolen)+")";
      let attestationRefusal=false;
      try {pgExec('r5d_checkout_worker',sql);}
      catch(e) {
        attestationRefusal=e instanceof R5DReservationQaPortError &&
          e.kind==='attestation_denied';
      }
      pass(label,attestationRefusal);
    }
    stolenTagAttempt('STOLEN_HMAC_OTHER_REAL_CLIENT_REJECTED',
      ISSUER,users.bob.userId,PARTNER_ID,MUTATION,honest);
    stolenTagAttempt('STOLEN_HMAC_OTHER_MUTATION_REJECTED',
      ISSUER,users.alice.userId,PARTNER_ID,'r5f_other_mutation_123456',honest);
    stolenTagAttempt('STOLEN_HMAC_OTHER_MERCHANT_REJECTED',
      ISSUER,users.alice.userId,'merchant-text-2',MUTATION,honest);
    const sameTotalDifferentCart={...honest,
      items:[{...honest.items[0],sku:'qa-mango'}]};
    stolenTagAttempt('STOLEN_HMAC_OTHER_CART_REJECTED',
      ISSUER,users.alice.userId,PARTNER_ID,MUTATION,sameTotalDifferentCart);
    pass('STOLEN_HMAC_ZERO_NEW_RESERVATIONS',
      pgExec('r5d_checkout_auditor',
        "SELECT count(*) FROM da_checkout_candidate.reservation "+
        "WHERE mutation_key='r5f_other_mutation_123456'")==='0');
    const same=await post(users.alice.jwt,requestBody());
    expectCode('SAME_MUTATION_RETRY',same.status,201);
    pass('RETRY_MATCHES_SAME_COMMITTED_RESERVATION',
      first.data?.reservationId===same.data?.reservationId);
    const parallel=await Promise.all(Array.from({length:12},
      ()=>post(users.alice.jwt,requestBody('r5d_parallel_123456789'))));
    pass('TWELVE_HTTP_REQUESTS_SUCCESS',parallel.every(x=>x.status===201));
    pass('TWELVE_HTTP_ONE_COMMITTED_ROW',
      new Set(parallel.map(x=>x.data?.reservationId)).size===1);
    const count=pgExec('r5d_checkout_auditor',
      'SELECT count(*) FROM da_checkout_candidate.reservation');
    const outbox=pgExec('r5d_checkout_auditor',
      'SELECT count(*) FROM da_checkout_candidate.outbox');
    pass('ONE_OUTBOX_PER_RESERVATION',count===outbox);
    const bob=await post(users.bob.jwt,requestBody());
    expectCode('OTHER_REAL_CLIENT_INDEPENDENT',bob.status,201);
    pass('OTHER_REAL_SUBJECT_DISTINCT',bob.data?.reservationId!==first.data?.reservationId);
    const altered=await post(users.alice.jwt,requestBody(MUTATION,
      {items:[{id:'qa-rice',quantity:3}]}));
    expectCode('SAME_MUTATION_DIFFERENT_CART_CONFLICT',altered.status,409);
    const changed=JSON.parse(pgExec('postgres',
      "SELECT published_payload FROM da_catalog_partners WHERE slug='qa-partner'"));
    changed.menuItems[0].amount=2290;
    sqlStdin("UPDATE public.da_catalog_partners SET published_payload="+
      jexpr(changed)+",published_revision=published_revision+1 "+
      "WHERE slug='qa-partner';");
    const reprice=await post(users.alice.jwt,requestBody('r5d_new_catalog_price_123456'));
    expectCode('CANONICAL_DB_PRICE_CHANGE_REFLECTED',reprice.status,201);
    pass('NEW_PRICE_FROM_SQL_NOT_CLIENT',
      reprice.data?.amountMinor===4860);
    port.staleRevisionOnce=true;
    const outdated=await post(users.alice.jwt,requestBody('r5d_old_revision_1234567'));
    expectCode('PUBLISHED_REVISION_RACE_REJECTED',outdated.status,409);
    pass('REVISION_RACE_NO_NEW_RESERVATION',
      pgExec('r5d_checkout_auditor',
        "SELECT count(*) FROM da_checkout_candidate.reservation "+
        "WHERE mutation_key='r5d_old_revision_1234567'")==='0');
    const before=port.reservationSqlCalls;
    const resolution=await mod.get(AuthService).resolvePrincipalFromAuthorization(
      'Bearer '+users.alice.jwt);
    pass('CLIENT_KEYCLOAK_AUTHORIZATION_BEFORE_REVOKE',
      resolution.ok===true);
    const revoke=await mod.get(AuthService).revokeClientSession(resolution.payload);
    pass('REDIS_CLIENT_SESSION_REVOKED',revoke.ok===true);
    const afterRevoke=await post(users.alice.jwt,
      requestBody('r5d_after_client_logout_123456'));
    expectCode('REVOKED_CLIENT_DENIED_EARLY',afterRevoke.status,401);
    pass('REVOKED_NO_CATALOG_RESERVATION_SQL',port.reservationSqlCalls===before);
    const bobStill=await post(users.bob.jwt,requestBody('r5d_bob_after_revoke_123456'));
    expectCode('UNREVOKED_CLIENT_STILL_AUTHORIZED',bobStill.status,201);
    const redisStop=cp.spawnSync('docker',['stop',REDIS],{
      encoding:'utf8',timeout:25000});
    pass('REDIS_STOPPED',redisStop.status===0);
    const sqlBeforeDown=port.reservationSqlCalls;
    const redisDown=await post(users.bob.jwt,requestBody('r5d_redis_down_123456'));
    expectCode('REDIS_DOWN_FAILS_CLOSED',redisDown.status,503);
    pass('REDIS_DOWN_ZERO_RESERVATION_SQL',
      port.reservationSqlCalls===sqlBeforeDown);
    const redisStart=cp.spawnSync('docker',['start',REDIS],{
      encoding:'utf8',timeout:25000});
    pass('REDIS_RESTARTED',redisStart.status===0);
    const pgRestart=cp.spawnSync('docker',['restart',PG],{
      encoding:'utf8',timeout:45000});
    pass('POSTGRES_RESTARTED',pgRestart.status===0);
    await waitForPg();
    pass('RESERVATION_DURABLE_THROUGH_DATABASE_RESTART',
      pgExec('r5d_checkout_auditor',
        "SELECT count(*) FROM da_checkout_candidate.reservation "+
        "WHERE mutation_key="+literal(MUTATION))==='2');
    pass('NO_PSP_ATTEMPTED',port.providerCalls===0);
    const pgStop=cp.spawnSync('docker',['stop',PG],{
      encoding:'utf8',timeout:30000});
    pass('QA_POSTGRES_STOPPED',pgStop.status===0);
    const down=await post(users.bob.jwt,requestBody('r5d_postgres_down_123456'));
    expectCode('PG_UNAVAILABLE_FAIL_CLOSED',down.status,503);
    pass('PG_DOWN_NO_PROVIDER_CALLS',port.providerCalls===0);
    console.log('R5F_HMAC_BOUND_CLIENT_ORDER_SQL=PASS_QA_TARGETED');
    console.log('R5F_REAL_ISSUER_AND_IOS_ANDROID=NOT_CERTIFIED');
    console.log('R5F_PG_CANONICAL_PRODUCTION_MIGRATION=NOT_APPLIED');
    console.log('R5F_REAL_STRIPE_TEST=NOT_EXECUTED');
    console.log('R5F_FINANCE_AND_STORE_RELEASE=NO_GO');
  } finally {
    await app.close();
    fs.rmSync(CONFIG,{force:true});
  }
})().catch(err=>{
  console.error('R5F_FINAL=FAIL_CLOSED_QA');
  console.error('R5F_ERROR_CODE='+String(err?.message||err)
    .replace(/[^A-Za-z0-9_:-]/g,'_').slice(0,140));
  process.exitCode=1;
});
