#!/usr/bin/env node
'use strict';
/*
 R5A-B-REAL: THE EXACT PR #46 NestJS HTTP finance controller + a NEW
 dedicated trusted QA port, REAL Keycloak 26.8.1 RS256 JWT + introspection,
 REAL PostgreSQL 16 committed scope with a login that has only SELECT.
 No production issuer / no public AppModule / no wallet ledger / no Stripe.
 All numbers returned by QA are explicitly SYNTHETIC ZERO, not a legal balance.

 The CI launcher creates fresh Docker resources and deletes them on exit.
 */
require('reflect-metadata');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const assert=require('node:assert/strict');
const {Test}=require('@nestjs/testing');
const {
  PartnerFinanceReadonlyQaController,
  FINANCE_READONLY_QA_PORT,
  FinanceReadonlyQaPortError,
}=require('../src/client-commerce/partner-finance-readonly.qa.controller');

const KC='http://127.0.0.1:18195';
const REALM='r5a-finance-real-qa';
const ISSUER=KC+'/realms/'+REALM;
const DB=process.env.R5A_QA_PG_CONTAINER||'';
const SECRET=process.env.QA_BOOTSTRAP_ADMIN_PASSWORD||'';
const SHAPE=/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const safeRole=/^(merchant|courier)$/;
const safeTenant=/^tenant-(alpha|beta)$/;
const mandatory=(label,condition)=>{
  assert.ok(condition,label);
  console.log('R5A_B_REAL_PASS='+label);
};
function http(label,status,expected){
  assert.equal(status,expected,label+' status '+status);
  mandatory(label+'_HTTP_'+expected,true);
}
if(process.env.GITHUB_ACTIONS!=='true' ||
  process.env.QA_SYNTHETIC_ONLY!=='YES' ||
  process.env.NODE_ENV==='production' ||
  process.env.QA_KEYCLOAK_ORIGIN!==KC ||
  !/^pog-r5a-finance-pg-[a-zA-Z0-9-]+$/.test(DB) ||
  SECRET.length<24) {
  throw Error('R5A_B_REAL_ISOLATED_QA_GUARD');
}
let financeSqlReads=0;
function sqlAs(login,sql) {
  assert(['postgres','qa_finance_reader'].includes(login));
  const args=['exec','-i',DB,'psql','-X','-A','-t',
    '-v','ON_ERROR_STOP=1','-U',login,'-d','r5a_finance_qa','-c',sql];
  const result=cp.spawnSync('docker',args,{
    encoding:'utf8',maxBuffer:100000,timeout:15000
  });
  if(result.error||result.status!==0) {
    throw Error('qa_pg_unavailable_or_denied');
  }
  return String(result.stdout||'').trim();
}
async function keycloak(method,route,body,access) {
  assert(route.startsWith('/admin/realms'),'admin API prefix');
  const resp=await fetch(KC+route,{
    method,redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{
      ...(access?{Authorization:'Bearer '+access}:{}),
      ...(body===undefined?{}:{'Content-Type':'application/json'})
    },
    ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  const text=await resp.text();
  let data=null;
  try{data=JSON.parse(text);}catch{}
  return {status:resp.status,data,location:resp.headers.get('location')};
}
async function token(body){
  const r=await fetch(ISSUER+'/protocol/openid-connect/token',{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams(body)
  });
  let data=null;try{data=await r.json();}catch{}
  return {status:r.status,data};
}
async function realmSetup() {
  const admin=await fetch(KC+'/realms/master/protocol/openid-connect/token',{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({client_id:'admin-cli',grant_type:'password',
      username:'qa_admin',password:SECRET})
  });
  http('ADMIN_BOOTSTRAP_QA',admin.status,200);
  const ADMIN=(await admin.json()).access_token;
  http('CREATE_ISOLATED_REALM',
    (await keycloak('POST','/admin/realms',{
      realm:REALM,enabled:true,registrationAllowed:false,verifyEmail:false,
      duplicateEmailsAllowed:false,
    },ADMIN)).status,201);
  const roles={};
  for(const role of ['merchant','courier','ops']) {
    http('CREATE_ROLE_'+role,
      (await keycloak('POST','/admin/realms/'+REALM+'/roles',{name:role},ADMIN)).status,201);
    const result=await keycloak('GET','/admin/realms/'+REALM+'/roles/'+role,undefined,ADMIN);
    http('LOOKUP_ROLE_'+role,result.status,200);
    roles[role]=result.data;
  }
  const details={};
  const appNames={merchant:'r5a-merchant-qa-client',courier:'r5a-courier-qa-client'};
  for(const role of ['merchant','courier']) {
    const clientId=appNames[role];
    http('CREATE_QA_APP_'+role,(await keycloak('POST','/admin/realms/'+REALM+'/clients',{
      clientId,enabled:true,publicClient:true,
      standardFlowEnabled:false,directAccessGrantsEnabled:true,
      serviceAccountsEnabled:false,fullScopeAllowed:false,
    },ADMIN)).status,201);
    const lookup=await keycloak('GET','/admin/realms/'+REALM+'/clients?clientId='+clientId,
      undefined,ADMIN);
    const client=lookup.data.find(x=>x.clientId===clientId);
    mandatory('QA_CLIENT_SCOPE_LIMITED_'+role,client && client.fullScopeAllowed===false);
    http('SET_ONLY_ROLE_SCOPE_'+role,
      (await keycloak('POST','/admin/realms/'+REALM+'/clients/'+client.id+
        '/scope-mappings/realm',[roles[role]],ADMIN)).status,204);
    const mappers=[
      {
        name:'qa_r5a_audience_'+role,protocol:'openid-connect',
        protocolMapper:'oidc-audience-mapper',consentRequired:false,
        config:{
          'included.client.audience':clientId,
          'access.token.claim':'true',
          'id.token.claim':'false'
        }
      },
      {
        name:'qa_r5a_tenant_'+role,protocol:'openid-connect',
        protocolMapper:'oidc-usermodel-attribute-mapper',consentRequired:false,
        config:{
          'user.attribute':'qa_tenant',
          'claim.name':'qa_tenant',
          'jsonType.label':'String',
          'access.token.claim':'true',
          'id.token.claim':'false',
          'userinfo.token.claim':'false',
          'multivalued':'false'
        }
      }
    ];
    for(const mapper of mappers) {
      http('CREATE_QA_MAPPER_'+mapper.name,
        (await keycloak('POST','/admin/realms/'+REALM+'/clients/'+client.id+
          '/protocol-mappers/models',mapper,ADMIN)).status,201);
    }
    const password=crypto.randomBytes(24).toString('base64url')+'aA1!';
    const username='r5a-'+role+'-qa';
    const email=username+'@qa.invalid';
    const tenant=role==='merchant'?'tenant-alpha':'tenant-beta';
    const created=await keycloak('POST','/admin/realms/'+REALM+'/users',{
      username,email,enabled:true,emailVerified:true,
      attributes:{qa_tenant:[tenant]}
    },ADMIN);
    http('CREATE_SYNTHETIC_USER_'+role,created.status,201);
    const userId=String(created.location||'').split('/').pop();
    mandatory('KEYCLOAK_USER_SUBJECT_UUID_'+role,UUID.test(userId));
    http('SET_EPHEMERAL_TEST_PASSWORD_'+role,
      (await keycloak('PUT','/admin/realms/'+REALM+'/users/'+userId+
        '/reset-password',{type:'password',value:password,temporary:false},ADMIN)).status,204);
    http('GRANT_ONLY_REALM_ROLE_'+role,
      (await keycloak('POST','/admin/realms/'+REALM+'/users/'+userId+
        '/role-mappings/realm',[roles[role]],ADMIN)).status,204);
    details[role]={clientId,username,password,userId,tenant,email};
  }
  http('CREATE_NON_ADMIN_INTROSPECTOR',
    (await keycloak('POST','/admin/realms/'+REALM+'/clients',{
      clientId:'r5a-private-introspector',enabled:true,
      publicClient:false,serviceAccountsEnabled:true,
      standardFlowEnabled:false,directAccessGrantsEnabled:false,
      fullScopeAllowed:false
    },ADMIN)).status,201);
  const iLookup=await keycloak('GET','/admin/realms/'+REALM+
    '/clients?clientId=r5a-private-introspector',undefined,ADMIN);
  const introspector=iLookup.data.find(x=>x.clientId==='r5a-private-introspector');
  const sec=await keycloak('GET','/admin/realms/'+REALM+'/clients/'+
    introspector.id+'/client-secret',undefined,ADMIN);
  http('READ_EPHEMERAL_INTROSPECTOR_SECRET',sec.status,200);
  mandatory('REAL_INTROSPECTOR_HAS_SECRET',typeof sec.data.value==='string');
  return {ADMIN,details,introspector:sec.data.value};
}
function pgSetup(details) {
  const schema=[
    'CREATE ROLE qa_finance_reader LOGIN;',
    'CREATE SCHEMA qa_finance;',
    "CREATE TABLE qa_finance.partner_authority ("+
       'subject uuid PRIMARY KEY,'+
       'issuer text NOT NULL,'+
       "role text NOT NULL CHECK (role IN ('merchant','courier')),"+
       'tenant text NOT NULL,'+
       'merchant_slug text,'+
       "state text NOT NULL CHECK (state IN ('active','inactive','conflict')));",
    'REVOKE ALL ON SCHEMA qa_finance FROM PUBLIC;',
    'REVOKE ALL ON qa_finance.partner_authority FROM PUBLIC;',
    'GRANT USAGE ON SCHEMA qa_finance TO qa_finance_reader;',
    'GRANT SELECT ON qa_finance.partner_authority TO qa_finance_reader;'
  ].join(' ');
  sqlAs('postgres',schema);
  for(const role of ['merchant','courier']) {
    const d=details[role];
    const slug=role==='merchant'?"'r5a-merchant'":'NULL';
    const q="INSERT INTO qa_finance.partner_authority "+
      '(subject,issuer,role,tenant,merchant_slug,state) VALUES ('+
      "'"+d.userId+"'::uuid,'"+ISSUER+"','"+role+"','"+d.tenant+"',"+
      slug+",'active');";
    sqlAs('postgres',q);
  }
  const readLogin=sqlAs('qa_finance_reader','SELECT session_user');
  mandatory('PG_REAL_LEAST_PRIVILEGE_LOGIN',readLogin==='qa_finance_reader');
  // Regression: the finance reader cannot mutate the committed authority.
  let denied=false;
  try {
    sqlAs('qa_finance_reader','UPDATE qa_finance.partner_authority SET state=\\'active\\';');
  } catch { denied=true; }
  mandatory('PG_READER_CANNOT_UPDATE',denied);
}
async function getJwt(d) {
  const t=await token({grant_type:'password',client_id:d.clientId,
    username:d.username,password:d.password,scope:'openid'});
  http('KEYCLOAK_REAL_PASSWORD_GRANT_'+d.username,t.status,200);
  mandatory('ISSUED_SIGNED_JWT_'+d.username,
    typeof t.data?.access_token==='string'&&
    t.data.access_token.split('.').length===3);
  return t.data.access_token;
}
async function trustedJwt(jwt) {
  const chunks=String(jwt).split('.');
  if(chunks.length!==3)throw new FinanceReadonlyQaPortError('unauthenticated');
  let h,p;
  try{
    h=JSON.parse(Buffer.from(chunks[0],'base64url').toString('utf8'));
    p=JSON.parse(Buffer.from(chunks[1],'base64url').toString('utf8'));
  }catch{throw new FinanceReadonlyQaPortError('unauthenticated')}
  if(h.alg!=='RS256' || typeof h.kid!=='string' ||
      p.iss!==ISSUER || !UUID.test(p.sub||'') ||
      !Number.isSafeInteger(p.exp) || p.exp<=Date.now()/1000 ||
      !Number.isSafeInteger(p.iat) || p.iat>Date.now()/1000+30) {
    throw new FinanceReadonlyQaPortError('unauthenticated');
  }
  let pub;
  try {
    const r=await fetch(ISSUER+'/protocol/openid-connect/certs',{
      redirect:'error',signal:AbortSignal.timeout(10000)
    });
    if(r.status!==200)throw Error('jwks unavailable');
    const keys=(await r.json()).keys;
    const jwk=keys.find(x=>x.kid===h.kid && x.kty==='RSA');
    if(!jwk)throw Error('unknown signing key');
    pub=crypto.createPublicKey({key:jwk,format:'jwk'});
  }catch{throw new FinanceReadonlyQaPortError('unavailable')}
  if(!crypto.verify('RSA-SHA256',Buffer.from(chunks[0]+'.'+chunks[1]),
     pub,Buffer.from(chunks[2],'base64url'))) {
    throw new FinanceReadonlyQaPortError('unauthenticated');
  }
  const role=p.realm_access?.roles?.includes('merchant')?'merchant':
    p.realm_access?.roles?.includes('courier')?'courier':null;
  if(!role || (p.realm_access.roles.includes('merchant') &&
      p.realm_access.roles.includes('courier'))) {
    throw new FinanceReadonlyQaPortError('forbidden');
  }
  const requiredClient='r5a-'+role+'-qa-client';
  const aud=typeof p.aud==='string'?[p.aud]:p.aud;
  if(p.azp!==requiredClient || !Array.isArray(aud) ||
      !aud.includes(requiredClient)) {
    throw new FinanceReadonlyQaPortError('unauthenticated');
  }
  if(!safeTenant.test(p.qa_tenant||'')) {
    throw new FinanceReadonlyQaPortError('forbidden');
  }
  return {claim:p,role};
}
function financialReader(introspector) {
  return {
    async readWallet(authorization,limit=20) {
      if(typeof authorization!=='string'||!SHAPE.test(authorization) ||
        limit!==20)throw new FinanceReadonlyQaPortError('unauthenticated');
      const jwt=authorization.match(SHAPE)[1];
      const {claim,role}=await trustedJwt(jwt);
      const post=new URLSearchParams({
        client_id:'r5a-private-introspector',
        client_secret:introspector,
        token:jwt
      });
      let introspected;
      try{
        const res=await fetch(ISSUER+'/protocol/openid-connect/token/introspect',{
          method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),
          headers:{'Content-Type':'application/x-www-form-urlencoded'},body:post
        });
        if(res.status!==200)throw Error('introspection unavailable');
        introspected=await res.json();
      }catch{throw new FinanceReadonlyQaPortError('unavailable')}
      if(introspected.active!==true ||
        introspected.sub!==claim.sub) {
        throw new FinanceReadonlyQaPortError('unauthenticated');
      }
      // Only after verified signature, issuer, audience, business role and
      // ACTIVE Keycloak session may this port read PostgreSQL.
      let row;
      try{
        financeSqlReads++;
        const sql="SELECT row_to_json(a) FROM (SELECT subject,issuer,role,"+
          "tenant,merchant_slug,state FROM qa_finance.partner_authority "+
          "WHERE subject='"+claim.sub+"'::uuid) a";
        const raw=sqlAs('qa_finance_reader',sql);
        row=raw?JSON.parse(raw):null;
      }catch{throw new FinanceReadonlyQaPortError('unavailable')}
      if(!row || row.issuer!==claim.iss || row.role!==role ||
        row.tenant!==claim.qa_tenant) {
        throw new FinanceReadonlyQaPortError('forbidden');
      }
      if(row.state==='conflict')throw new FinanceReadonlyQaPortError('conflict');
      if(row.state!=='active')throw new FinanceReadonlyQaPortError('forbidden');
      if(role==='merchant' && row.merchant_slug!=='r5a-merchant')
        throw new FinanceReadonlyQaPortError('forbidden');
      if(role==='courier' && row.merchant_slug!==null)
        throw new FinanceReadonlyQaPortError('forbidden');
      // No legal wallet data exists in this QA schema. The following is a
      // SYNTHETIC ONLY presentation contract for the isolated test; its data
      // must never be promoted, shown as money or treated as a second ledger.
      return {
        mode:'qa_synthetic_only',
        ownerRole:role,
        merchantSlug:role==='merchant'?row.merchant_slug:null,
        organizationId:'00000000-0000-4000-8000-000000000000',
        territory:'BE',
        withdrawableMinor:0,payoutEnabled:false,activity:[],
        summary:{
          currency:'EUR',
          accrued_minor:0,pending_minor:0,available_minor:0,
          held_minor:0,withdrawable_minor:0,payout_enabled:false
        }
      };
    }
  };
}
async function run(){
  let app=null;
  try{
    const {ADMIN,details,introspector}=await realmSetup();
    pgSetup(details);
    const tokenMerchant=await getJwt(details.merchant);
    const tokenCourier=await getJwt(details.courier);
    const m=await trustedJwt(tokenMerchant);
    mandatory('MERCHANT_REAL_JWT_SIGNED_ROLE',m.role==='merchant' &&
      m.claim.qa_tenant==='tenant-alpha');
    const c=await trustedJwt(tokenCourier);
    mandatory('COURIER_REAL_JWT_SIGNED_ROLE',c.role==='courier' &&
      c.claim.qa_tenant==='tenant-beta');
    const reader=financialReader(introspector);
    const mod=await Test.createTestingModule({
      controllers:[PartnerFinanceReadonlyQaController],
      providers:[{provide:FINANCE_READONLY_QA_PORT,useValue:reader}]
    }).compile();
    app=mod.createNestApplication({logger:false});
    await app.listen(0,'127.0.0.1');
    const address=app.getHttpServer().address();
    mandatory('NEST_BOUND_PRIVATE_LOOPBACK_ONLY',address.address==='127.0.0.1');
    const url='http://127.0.0.1:'+address.port+
      '/qa-isolated/partner-finance/v1/summary';
    const fetchPrivate=async(jwt,extra)=>{
      const resp=await fetch(url,{
        headers:{
          ...(jwt?{Authorization:'Bearer '+jwt}:{}),
          ...(extra||{})
        },
        redirect:'error',signal:AbortSignal.timeout(20000)
      });
      const body=await resp.text();
      assert(!body.includes(SECRET));
      assert(!body.includes(details.merchant.userId));
      assert(!body.includes(details.courier.userId));
      assert(!body.includes('qa_finance.partner_authority'));
      return {status:resp.status,body};
    };
    let before=financeSqlReads;
    http('MISSING_JWT_NO_SQL',(await fetchPrivate(null)).status,401);
    mandatory('MISSING_JWT_ZERO_SQL',financeSqlReads===before);
    http('MALFORMED_JWT_NO_SQL',(await fetchPrivate('broken')).status,401);
    mandatory('MALFORMED_JWT_ZERO_SQL',financeSqlReads===before);
    const invalid=tokenMerchant.slice(0,-2)+'aa';
    http('TAMPERED_SIGNATURE_NO_SQL',(await fetchPrivate(invalid)).status,401);
    mandatory('TAMPERED_SIGNATURE_ZERO_SQL',financeSqlReads===before);
    const first=await fetchPrivate(tokenMerchant);
    http('MERCHANT_REAL_SIGNED_INTROSPECTED_PG_HTTP',first.status,200);
    const mr=JSON.parse(first.body);
    mandatory('MERCHANT_ZERO_PAYOUT_NO_IDENTITIES',
      mr.mode==='qa_synthetic_only' && mr.ownerRole==='merchant' &&
      mr.withdrawableMinor===0 && mr.payoutEnabled===false &&
      mr.accruedMinor===0 && !('organizationId' in mr) &&
      !('activity' in mr));
    const other=await fetchPrivate(tokenCourier);
    http('COURIER_REAL_SIGNED_INTROSPECTED_PG_HTTP',other.status,200);
    mandatory('COURIER_NO_MERCHANT_DATA',!other.body.includes('r5a-merchant'));

    // Requested body/query/header tenant must never redefine issuer/sub/PG scope.
    const cross=await fetchPrivate(tokenMerchant,{
      'X-QA-Tenant':'tenant-beta','X-QA-Role':'courier'});
    http('CROSS_TENANT_REQUEST_IGNORED',cross.status,200);
    mandatory('CROSS_TENANT_NO_LEAK',cross.body===first.body);
    sqlAs('postgres',"UPDATE qa_finance.partner_authority "+
      "SET tenant='tenant-beta' WHERE subject='"+details.merchant.userId+"'::uuid");
    http('SIGNED_TENANT_VS_COMMITTED_PG_MISMATCH_DENIED',
      (await fetchPrivate(tokenMerchant)).status,403);
    sqlAs('postgres',"UPDATE qa_finance.partner_authority "+
      "SET tenant='tenant-alpha' WHERE subject='"+details.merchant.userId+"'::uuid");
    sqlAs('postgres',"UPDATE qa_finance.partner_authority "+
      "SET role='courier' WHERE subject='"+details.merchant.userId+"'::uuid");
    http('CROSS_ROLE_COMMITTED_PG_DENIED',
      (await fetchPrivate(tokenMerchant)).status,403);
    sqlAs('postgres',"UPDATE qa_finance.partner_authority "+
      "SET role='merchant' WHERE subject='"+details.merchant.userId+"'::uuid");
    sqlAs('postgres',"UPDATE qa_finance.partner_authority "+
      "SET state='conflict' WHERE subject='"+details.merchant.userId+"'::uuid");
    http('REAL_PG_COMMITTED_CONFLICT_409',
      (await fetchPrivate(tokenMerchant)).status,409);
    sqlAs('postgres',"UPDATE qa_finance.partner_authority "+
      "SET state='active' WHERE subject='"+details.merchant.userId+"'::uuid");

    const concurrent=await Promise.all(Array.from({length:16},()=>fetchPrivate(tokenCourier)));
    mandatory('SIXTEEN_REAL_POSTGRES_HTTP_CONCURRENT_200',
      concurrent.every(x=>x.status===200));
    const preLogout=await fetchPrivate(tokenMerchant);
    http('SAME_REAL_MERCHANT_TOKEN_PRE_LOGOUT_200',preLogout.status,200);
    const payload=JSON.parse(Buffer.from(tokenMerchant.split('.')[1],'base64url'));
    mandatory('MISSING_EXPIRY_BEFORE_KEYCLOAK_LOGOUT',payload.exp>Date.now()/1000);
    http('REAL_KEYCLOAK_USER_LOGOUT_204',
      (await keycloak('POST','/admin/realms/'+REALM+'/users/'+
        details.merchant.userId+'/logout',undefined,ADMIN)).status,204);
    before=financeSqlReads;
    http('SAME_NONEXPIRED_REVOKED_JWT_HTTP_401',
      (await fetchPrivate(tokenMerchant)).status,401);
    mandatory('REVOKED_JWT_ZERO_PG_READS',financeSqlReads===before);
    http('UNREVOKED_COURIER_STILL_HTTP_200',
      (await fetchPrivate(tokenCourier)).status,200);
    // No PG server connection after shutdown. No Stripe, no external calls.
    const stopped=cp.spawnSync('docker',['stop',DB],{
      encoding:'utf8',timeout:25000,maxBuffer:5000});
    mandatory('EPHEMERAL_PG_STOPPED',stopped.status===0);
    http('PG_UNAVAILABLE_FAILS_CLOSED_503',
      (await fetchPrivate(tokenCourier)).status,503);
    console.log('R5A_B_REAL_NEST_KEYCLOAK26_PG16=PASS_QA_SYNTHETIC_AUTHORITY');
    console.log('R5A_B_REAL_MONEY_BALANCES=NOT_CERTIFIED');
    console.log('R5A_B_REAL_ORCHIDPAY_LEDGER=NOT_TOUCHED');
    console.log('R5A_B_REAL_PUBLIC_APPMODULE=UNTOUCHED');
    console.log('R5A_B_REAL_STRIPE_LIVE=NO_GO');
    console.log('R5A_B_REAL_PAYOUT=NO_GO');
  }finally{
    if(app)await app.close();
  }
}
run().catch(e=>{
  const label=String(e?.message||'unknown')
    .replace(/https?:\/\/\S+/g,'[REDACTED_URL]')
    .replace(/[^A-Za-z0-9_-]/g,'_').slice(0,100);
  console.error('R5A_B_REAL_FINAL=NO_GO_'+label);
  process.exitCode=1;
});
