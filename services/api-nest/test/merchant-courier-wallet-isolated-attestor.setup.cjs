'use strict';
const fs=require('node:fs');
/**
 * F4H: disposable Keycloak 26.4.7 HTTPS RS256/JWKS and real PG17 wallet QA.
 * --network none, no external provider. Direct grant exists ONLY in the
 * ephemeral test realm; this does NOT certify native mobile PKCE.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {Pool}=require('pg');
const {ExternalJwksVerifierService}=require('/qa-built/external-jwks-verifier.service.js');
const {QaWalletVerifiedSessionBridge}=require('/qa-built/merchant-courier-wallet-signed-session.pg-qa.bridge.js');
const {startQaHttpsProxy}=require('./synthetic-keycloak-tls-proxy.qa.cjs');

const ROOT='https://127.0.0.1';
const REALM='da-wallet-partners-qa';
const ISSUER=ROOT+'/realms/'+REALM;
const MA='delishafrica-merchant',CA='delishafrica-courier';
const OA='a43f867f-9f42-4573-9268-dc65a164d2c2';
const OB='a43f867f-9f42-4573-9268-dc65a164d2c4';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const keyPrefix='DA-F4G-keycloak-partner-sid-jti-v1\n';
const pw=()=>crypto.randomBytes(24).toString('base64url')+'Qa!';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const key=p=>sha(keyPrefix+[p.iss,p.sub,p.sid,p.jti].join('\n'));
const iso=n=>new Date(n*1000).toISOString();
for(const [field,value] of [
  ['GITHUB_ACTIONS','true'],['QA_SYNTHETIC_ONLY','YES'],
  ['QA_KEYCLOAK_ORIGIN',ROOT],['QA_HTTPS_ORIGIN',ROOT],
  ['NODE_EXTRA_CA_CERTS','/qa-tls/qa.crt'],
  ['QA_COMMERCE_DB_HOST','127.0.0.1'],
  ['QA_COMMERCE_DB_NAME','postgres']
]){
  assert.equal(process.env[field],value,'F4G isolated environment only: '+field);
}
assert.ok((process.env.QA_BOOTSTRAP_ADMIN_PASSWORD||'').length>=20);

const db=user=>new Pool({host:'127.0.0.1',port:5432,database:'postgres',
  user,max:4,connectionTimeoutMillis:6000,statement_timeout:12000});
const adminPg=db('postgres'),merchantPg=db('da_qa_merchant_commerce_app');
const courierPg=db('da_qa_courier_commerce_app');
const attestor=db('da_qa_wallet_attestor_010');
const financeRegistryReader=db('da_qa_finance_registry_reader_012');
const {QaFinanceAuthorityRegistryReader}=
  require('/qa-built/merchant-courier-finance-authority.pg-qa.adapter.js');
function check(result,status,marker){
  assert.equal(result.status,status,marker+' HTTP status');
  return result;
}
async function json(method,path,bearer,body,expected){
  const u=new URL(path,ROOT);
  assert.equal(u.origin,ROOT);
  const r=await fetch(u,{method,redirect:'manual',signal:AbortSignal.timeout(20000),
    headers:{...(bearer?{authorization:'Bearer '+bearer}:{}),
      ...(body===undefined?{}:{'content-type':'application/json'})},
    ...(body===undefined?{}:{body:JSON.stringify(body)})});
  check(r,expected,path.split('/').slice(-1)[0]);
  const data=await r.text();
  if(!data)return null;
  try{return JSON.parse(data)}catch{return null}
}
async function oauth(body,confidential){
  const r=await fetch(ISSUER+'/protocol/openid-connect/'+
    (confidential?'token/introspect':'token'),{
    method:'POST',redirect:'manual',signal:AbortSignal.timeout(20000),
    headers:{'content-type':'application/x-www-form-urlencoded',
      ...(confidential?{authorization:'Basic '+
        Buffer.from(confidential.id+':'+confidential.secret).toString('base64')}:{}),
    },body:new URLSearchParams(body),
  });
  if(r.status!==200){
    const failBody=await r.json().catch(()=>({}));
    const reason=String(failBody?.error||'unknown').replace(/[^a-z_]/gi,'_').slice(0,40);
    throw Error('QA_F4H_KEYCLOAK_OAUTH_DENIED_'+r.status+'_'+reason);
  }
  return r.json();
}
async function buildKeycloak(){
  const r=await fetch(ROOT+'/realms/master/protocol/openid-connect/token',{
    method:'POST',redirect:'manual',signal:AbortSignal.timeout(20000),
    headers:{'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({client_id:'admin-cli',grant_type:'password',
      username:'qa_admin',password:process.env.QA_BOOTSTRAP_ADMIN_PASSWORD}),
  });
  check(r,200,'qa admin login');
  const adminToken=(await r.json()).access_token;
  assert.equal(typeof adminToken,'string');
  await json('POST','/admin/realms',adminToken,{
    realm:REALM,enabled:true,registrationAllowed:false,
  },201);
  for(const role of ['merchant','courier']){
    await json('POST','/admin/realms/'+REALM+'/roles',adminToken,{name:role},201);
  }
  for(const clientId of [MA,CA]){
    await json('POST','/admin/realms/'+REALM+'/clients',adminToken,{
      clientId,enabled:true,publicClient:true,
      standardFlowEnabled:true,directAccessGrantsEnabled:true,
      serviceAccountsEnabled:false,fullScopeAllowed:true,
      redirectUris:[ROOT+'/callback'],webOrigins:[],
      attributes:{'pkce.code.challenge.method':'S256'},
    },201);
    const all=await json('GET','/admin/realms/'+REALM+
      '/clients?clientId='+clientId,adminToken,undefined,200);
    const internalId=all.find(c=>c.clientId===clientId)?.id;
    assert.match(internalId,UUID);
    await json('POST','/admin/realms/'+REALM+'/clients/'+internalId+
      '/protocol-mappers/models',adminToken,{
      name:'qa-audience-'+clientId,protocol:'openid-connect',
      protocolMapper:'oidc-audience-mapper',consentRequired:false,
      config:{'included.client.audience':clientId,
        'access.token.claim':'true','id.token.claim':'false'},
    },201);
  }
  const attestorClient={id:'da-f4g-confidential-attestor-qa',secret:pw()};
  await json('POST','/admin/realms/'+REALM+'/clients',adminToken,{
    clientId:attestorClient.id,enabled:true,publicClient:false,
    clientAuthenticatorType:'client-secret',
    secret:attestorClient.secret,standardFlowEnabled:false,
    directAccessGrantsEnabled:false,serviceAccountsEnabled:true,
    fullScopeAllowed:false,
  },201);
  const roleRecords={};
  for(const role of ['merchant','courier']){
    roleRecords[role]=await json('GET','/admin/realms/'+REALM+
      '/roles/'+role,adminToken,undefined,200);
  }
  const users={};
  for(const [slot,role] of [
    ['merchantA','merchant'],['merchantB','merchant'],
    ['courierA','courier'],['courierB','courier'],
  ]){
    const username='f4g-'+slot.toLowerCase(),password=pw();
    await json('POST','/admin/realms/'+REALM+'/users',adminToken,{
      username,enabled:true,emailVerified:true,requiredActions:[],
      firstName:'QA',lastName:'F4G'+slot,
      email:username+'@example.invalid',
      credentials:[{type:'password',value:password,temporary:false}],
    },201);
    const candidates=await json('GET','/admin/realms/'+REALM+
      '/users?username='+username+'&exact=true',
      adminToken,undefined,200);
    const subject=candidates.find(u=>u.username===username)?.id;
    assert.match(subject,UUID);
    await json('POST','/admin/realms/'+REALM+'/users/'+subject+
      '/role-mappings/realm',adminToken,[roleRecords[role]],204);
    const clientId=role==='merchant'?MA:CA;
    const token=await oauth({grant_type:'password',client_id:clientId,
      username,password,scope:'openid email profile'});
    assert.equal(typeof token.access_token,'string');
    users[slot]={username,password,subject,role,access:token.access_token};
  }
  return {adminToken,attestorClient,users};
}
async function introspect(access,confidential){
  return oauth({token:access},confidential);
}
function officialVerifier(){
  const proto=ExternalJwksVerifierService.prototype;
  const old=proto.readConfig;
  proto.readConfig=()=>({
    issuer:ISSUER,discoveryUrl:ISSUER+'/.well-known/openid-configuration',
    advertisedJwksUrl:ISSUER+'/protocol/openid-connect/certs',
    jwksUrl:ISSUER+'/protocol/openid-connect/certs',
    audience:MA,allowedAlgorithms:['RS256'],
    merchantRealmRoles:['merchant'],merchantClientRoles:['merchant'],
    clockSkewSeconds:30,refreshSeconds:600,
  });
  let result;
  try{result=new ExternalJwksVerifierService()}
  finally{proto.readConfig=old}
  return result;
}
async function registerSession(p){
  assert.ok(p.sid&&p.jti,'Keycloak token has signed session and token IDs');
  await adminPg.query(
    'INSERT INTO public.da_qa_partner_oidc_sessions_011 '+
    '(session_key_sha256,issuer,subject,owner_role,audience,issued_at,expires_at) '+
    'VALUES($1::char(64),$2,$3::uuid,$4,$5,$6::timestamptz,$7::timestamptz)',
    [key(p),p.iss,p.sub,p.role,p.role==='merchant'?MA:CA,iso(p.iat),iso(p.exp)]);
}
async function seedLegal(users){
  // The legacy QA 010 registry remains a SECOND INDEPENDENT authorization
  // boundary. Finance authority 012 below is backed by the REAL Merchant
  // catalogue membership schema, not these wallet 010 fixtures.
  for(const [slot,slug,org,territory] of [
    ['merchantA','qa-restaurant',OA,'BE'],
    ['merchantB','qa-other',OB,'FR']]){
    await adminPg.query(
      'INSERT INTO public.da_qa_wallet_merchant_scope_010 '+
      '(issuer,subject,merchant_slug,organization_id,territory,'+
      'membership_status,contract_status,kyb_status,partner_state,valid_from) '+
      "VALUES($1,$2::uuid,$3::varchar,$4::uuid,$5::char(2),"+
      "'active','active','verified','published',now()-interval '5 minutes')",
      [ISSUER,users[slot].subject,slug,org,territory]);
  }
  for(const [slot,org,territory] of [
    ['courierA',OA,'BE'],['courierB',OB,'FR']]){
    await adminPg.query(
      'INSERT INTO public.da_qa_wallet_courier_scope_010 '+
      '(issuer,subject,organization_id,territory,roster_active,'+
      'agreement_status,kyc_status,valid_from) '+
      "VALUES($1,$2::uuid,$3::uuid,$4::char(2),true,"+
      "'active','verified',now()-interval '5 minutes')",
      [ISSUER,users[slot].subject,org,territory]);
  }
  for(const [org,territory] of [[OA,'BE'],[OB,'FR']]){
    await adminPg.query(
      'INSERT INTO public.da_qa_finance_legal_entities_012 '+
      '(organization_id,territory,legal_status,kyb_status,payments_on_hold,valid_from) '+
      "VALUES($1::uuid,$2::char(2),'active','verified',true,now()-interval '5 minutes')",
      [org,territory]);
  }
  for(const [slot,partnerId,slug,org,territory] of [
    ['merchantA','qa_partner_a','qa-restaurant',OA,'BE'],
    ['merchantB','qa_partner_b','qa-other',OB,'FR']]){
    await adminPg.query(
      'INSERT INTO public.da_catalog_partners '+
      '(partner_id,slug,lifecycle_status,published_payload) '+
      "VALUES($1,$2,'published',$3::jsonb)",
      [partnerId,slug,JSON.stringify({id:partnerId,slug,name:'F4H synthetic partner'})]);
    await adminPg.query(
      'INSERT INTO public.da_qa_finance_partner_entities_012 '+
      '(partner_id,organization_id,territory,valid_from) '+
      "VALUES($1,$2::uuid,$3::char(2),now()-interval '5 minutes')",
      [partnerId,org,territory]);
  }
  for(const [slot,user] of Object.entries(users)){
    await adminPg.query(
      'INSERT INTO public.da_identity_subjects '+
      '(issuer,subject,identity_kind,identity_status) '+
      "VALUES($1,$2,$3,'active')",
      [ISSUER,user.subject,user.role]);
    if(user.role==='merchant'){
      const partnerId=slot==='merchantA'?'qa_partner_a':'qa_partner_b';
      await adminPg.query(
        'INSERT INTO public.da_merchant_memberships '+
        '(issuer,subject,partner_id,membership_role,membership_status,'+
        'contract_status,kyb_status,starts_at) '+
        "VALUES($1,$2,$3,'finance','active','active','verified',"+
        "now()-interval '5 minutes')",
        [ISSUER,user.subject,partnerId]);
    }else{
      await adminPg.query(
        'INSERT INTO public.da_qa_finance_courier_roster_012 '+
        '(issuer,subject,organization_id,territory,roster_status,'+
        'agreement_status,kyc_status,valid_from) '+
        "VALUES($1,$2,$3::uuid,$4::char(2),'active','active','verified',"+
        "now()-interval '5 minutes')",
        [ISSUER,user.subject,slot==='courierA'?OA:OB,
          slot==='courierA'?'BE':'FR']);
    }
  }
  console.log('QA_F4H_ACTUAL_CATALOG_MEMBERSHIPS_AND_DURABLE_QA_COURIER_ROSTER=SEEDED');
}

async function main(){
  // This is a one-shot privileged TEST INITIALIZER, destroyed BEFORE
  // starting the isolated attestor and unprivileged app. No token values
  // or secret material are printed or saved to workflow logs.
  const fixture=await buildKeycloak();
  const v=officialVerifier();
  await v.onModuleInit();
  assert.equal(v.health().ready,true);
  const publicUsers={};
  try{
    for(const [slot,u] of Object.entries(fixture.users)){
      const signed=await v.verifyToken(u.access);
      assert.equal(signed.ok,true,'Keycloak signed issuer token');
      assert.equal(signed.payload.sub,u.subject);
      assert.equal(signed.payload.iss,ISSUER);
      assert.equal(signed.payload.role,u.role);
      const result=await introspect(u.access,fixture.attestorClient);
      assert.equal(result.active,true);
      assert.equal(result.sub,u.subject);
      await registerSession(signed.payload);
      publicUsers[slot]={role:u.role,access:u.access};
    }
    await seedLegal(fixture.users);
    fs.writeFileSync('/qa-seed/users.json',JSON.stringify(publicUsers),
      {encoding:'utf8',mode:0o600});
    fs.writeFileSync('/qa-seed/private-introspection.json',
      JSON.stringify({secret:fixture.attestorClient.secret}),
      {encoding:'utf8',mode:0o600});
    console.log('QA_F4I_EPHEMERAL_KEYCLOAK_4_JWTS_AND_LEGAL_FIXTURES=PASS');
  }finally{
    await v.onModuleDestroy();
    await Promise.all([adminPg.end(),merchantPg.end(),courierPg.end(),
      attestor.end(),financeRegistryReader.end()]);
  }
}
void main().catch(()=>{
  console.error('QA_F4I_EPHEMERAL_IDENTITY_SEED_DENIED');
  process.exitCode=1;
});
