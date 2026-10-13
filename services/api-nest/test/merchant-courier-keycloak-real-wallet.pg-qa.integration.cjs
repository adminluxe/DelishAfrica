'use strict';
/**
 * F4G: disposable Keycloak 26.4.7 HTTPS RS256/JWKS and real PG17 wallet QA.
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
    throw Error('QA_F4G_KEYCLOAK_OAUTH_DENIED_'+r.status+'_'+reason);
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
}
function makePorts(verifier,confidential){
  return {
    verify:{async verifyToken(jwt){
      const v=await verifier.verifyToken(jwt);
      if(!v.ok)return v;
      const p=await introspect(jwt,confidential);
      if(p.active!==true||p.sub!==v.payload.sub||p.iss!==v.payload.iss){
        return {ok:false,reason:'qa_provider_session_inactive'};
      }
      return v;
    }},
    async checkLiveSession(issuer,subject,sid,jti){
      const value=sha(keyPrefix+[issuer,subject,sid,jti].join('\n'));
      const result=await attestor.query(
        'SELECT issuer,subject::text,expires_at,revoked_at '+
        'FROM public.da_qa_partner_oidc_sessions_011 '+
        'WHERE session_key_sha256=$1::char(64)',[value]);
      if(result.rows.length!==1)return null;
      const s=result.rows[0];
      if(s.issuer!==issuer||s.subject!==subject||s.revoked_at||
         new Date(s.expires_at).getTime()<=Date.now())return null;
      return {source:'independent-revocation-ledger',active:true,
        issuer,subject,sid,jti,checkedAtEpochMs:Date.now()};
    },
    async readMerchantWalletScopes(issuer,subject){
      const results=await adminPg.query(
        'SELECT issuer,subject::text,merchant_slug,organization_id::text,'+
        'territory,membership_status,contract_status,kyb_status,'+
        'partner_state,valid_from,valid_until,revoked_at '+
        'FROM public.da_qa_wallet_merchant_scope_010 '+
        'WHERE issuer=$1 AND subject=$2::uuid',[issuer,subject]);
      return results.rows.map(r=>({
        source:'committed-wallet-registry',role:'merchant',
        issuer:r.issuer,subject:r.subject,merchantSlug:r.merchant_slug,
        organizationId:r.organization_id,territory:r.territory,
        membershipRole:'finance',membershipStatus:r.membership_status,
        contractStatus:r.contract_status,kybStatus:r.kyb_status,
        partnerLifecycleStatus:r.partner_state,
        startsAt:r.valid_from.toISOString(),
        expiresAt:r.valid_until?.toISOString()||null,
        revokedAt:r.revoked_at?.toISOString()||null,
      }));
    },
    async readCourierWalletScope(issuer,subject){
      const results=await adminPg.query(
        'SELECT issuer,subject::text,organization_id::text,territory,'+
        'roster_active,agreement_status,kyc_status,valid_from,'+
        'valid_until,revoked_at '+
        'FROM public.da_qa_wallet_courier_scope_010 '+
        'WHERE issuer=$1 AND subject=$2::uuid',[issuer,subject]);
      if(results.rows.length!==1)return null;
      const r=results.rows[0];
      return {source:'committed-wallet-registry',role:'courier',
        issuer:r.issuer,subject:r.subject,organizationId:r.organization_id,
        territory:r.territory,rosterActive:r.roster_active,
        agreementStatus:r.agreement_status,kycStatus:r.kyc_status,
        startsAt:r.valid_from.toISOString(),
        expiresAt:r.valid_until?.toISOString()||null,
        revokedAt:r.revoked_at?.toISOString()||null};
    },
    merchantPool:merchantPg,courierPool:courierPg,attestor,
  };
}
const denies=operation=>assert.rejects(operation,/qa_f4f_financial_identity_denied/);
const read=(bridge,access)=>bridge.readWallet('Bearer '+access);
test('F4G Keycloak 26 real local HTTPS RSA/JWKS and PG17 authorization',async()=>{
  const proxy=await startQaHttpsProxy();
  let verifier;
  try{
    const fixture=await buildKeycloak();
    verifier=officialVerifier();
    await verifier.onModuleInit();
    assert.equal(verifier.health().ready,true);
    assert.ok(verifier.health().keyCount>0);
    console.log('QA_F4G_LOCAL_KEYCLOAK_REAL_HTTPS_JWKS=PASS');
    const payloads={};
    for(const [label,u] of Object.entries(fixture.users)){
      const v=await verifier.verifyToken(u.access);
      assert.equal(v.ok,true,'verified Keycloak '+label+': '+v.reason);
      assert.equal(v.payload.sub,u.subject);
      assert.equal(v.payload.role,u.role);
      assert.equal(v.payload.iss,ISSUER);
      assert.equal(v.payload.authSource,'external');
      assert.ok(v.payload.sid&&v.payload.jti,'real signed sid jti');
      console.log('QA_F4G_CLAIM_SHAPE_'+u.role+'='+
        JSON.stringify({
          sidBound:/^[A-Za-z0-9_-]{8,180}$/.test(v.payload.sid),
          jtiBound:/^[A-Za-z0-9._~:+/-]{8,255}$/.test(v.payload.jti),
          jtiLength:v.payload.jti.length,
          jtiHasColon:v.payload.jti.includes(':'),
          jtiHasDot:v.payload.jti.includes('.'),
          jtiHasSlash:v.payload.jti.includes('/'),
          jtiHasSpace:/\s/.test(v.payload.jti),
          jtiAsciiGraphic:/^[\x21-\x7e]+$/.test(v.payload.jti),
          ttlSeconds:v.payload.exp-v.payload.iat,
          issuerPinned:v.payload.iss===ISSUER,
          audienceOwn:(typeof v.payload.aud==='string'?
            [v.payload.aud]:v.payload.aud).includes(
              u.role==='merchant'?MA:CA),
        }));
      const p=await introspect(u.access,fixture.attestorClient);
      assert.equal(p.active,true);
      assert.equal(p.sub,u.subject);
      await registerSession(v.payload);
      payloads[label]=v.payload;
    }
    console.log('QA_F4G_FOUR_REAL_KEYCLOAK_SIGNED_PARTNER_JWTS_AND_INTROSPECTION=PASS');
    await seedLegal(fixture.users);
    const bridge=new QaWalletVerifiedSessionBridge(
      makePorts(verifier,fixture.attestorClient),ISSUER);
    const a=await read(bridge,fixture.users.merchantA.access);
    assert.equal(a.ownerRole,'merchant');
    assert.equal(a.merchantSlug,'qa-restaurant');
    assert.equal(a.territory,'BE');
    assert.equal(Number(a.summary.accrued_minor),1840);
    assert.equal(a.withdrawableMinor,0);
    const b=await read(bridge,fixture.users.merchantB.access);
    assert.equal(b.merchantSlug,'qa-other');
    assert.equal(b.territory,'FR');
    assert.equal(Number(b.summary.accrued_minor),0);
    assert.deepEqual(b.activity,[]);
    console.log('QA_F4G_REAL_KEYCLOAK_MERCHANT_A_B_PG17_SEPARATION=PASS');
    const ca=await read(bridge,fixture.users.courierA.access);
    const cb=await read(bridge,fixture.users.courierB.access);
    assert.equal(ca.ownerRole,'courier');
    assert.equal(ca.territory,'BE');
    assert.equal(cb.territory,'FR');
    assert.equal(Number(ca.summary.accrued_minor),0);
    assert.equal(Number(cb.summary.accrued_minor),0);
    assert.deepEqual(ca.activity,[]);
    assert.equal(ca.payoutEnabled,false);
    console.log('QA_F4G_KEYCLOAK_REAL_COURIER_UNASSIGNED_ZERO_EARNINGS=PASS');

    const fake=fixture.users.merchantA.access.split('.');
    fake[1]=Buffer.from(JSON.stringify({
      ...JSON.parse(Buffer.from(fake[1],'base64url').toString()),
      sub:fixture.users.merchantB.subject,
    })).toString('base64url');
    await denies(read(bridge,fake.join('.')));
    const crossed=await oauth({
      grant_type:'password',client_id:CA,scope:'openid',
      username:fixture.users.merchantA.username,
      password:fixture.users.merchantA.password,
    });
    const cross=await verifier.verifyToken(crossed.access_token);
    assert.equal(cross.ok,false);
    console.log('QA_F4G_TAMPERED_RSA_AND_KEYCLOAK_CROSS_ROLE=DENIED');

    await adminPg.query(
      'UPDATE public.da_qa_partner_oidc_sessions_011 '+
      'SET revoked_at=clock_timestamp() '+
      'WHERE session_key_sha256=$1::char(64)',
      [key(payloads.merchantA)]);
    await denies(read(bridge,fixture.users.merchantA.access));
    console.log('QA_F4G_SIGNED_JWT_BUT_DURABLE_PG_SESSION_REVOKED=DENIED');

    await json('POST','/admin/realms/'+REALM+'/users/'+
      fixture.users.courierA.subject+'/logout',
      fixture.adminToken,undefined,204);
    let active=true;
    for(let i=0;i<12;i++){
      const info=await introspect(fixture.users.courierA.access,
        fixture.attestorClient);
      active=info.active;
      if(active===false)break;
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    assert.equal(active,false,'Keycloak logout must invalidate introspection');
    await denies(read(bridge,fixture.users.courierA.access));
    console.log('QA_F4G_REAL_KEYCLOAK_LOGOUT_INTROSPECTION_INACTIVE=PASS');

    await adminPg.query(
      'UPDATE public.da_qa_wallet_merchant_scope_010 SET contract_status=$1 '+
      'WHERE issuer=$2 AND subject=$3::uuid',
      ['suspended',ISSUER,fixture.users.merchantB.subject]);
    await denies(read(bridge,fixture.users.merchantB.access));
    await adminPg.query(
      'UPDATE public.da_qa_wallet_courier_scope_010 SET roster_active=false '+
      'WHERE issuer=$1 AND subject=$2::uuid',
      [ISSUER,fixture.users.courierB.subject]);
    await denies(read(bridge,fixture.users.courierB.access));
    console.log('QA_F4G_SIGNED_JWT_KYB_CONTRACT_ROSTER_REVOCATION=DENIED');

    await assert.rejects(attestor.query(
      'SELECT * FROM public.da_qa_wallet_posting'),/permission denied/i);
    await assert.rejects(attestor.query(
      'DELETE FROM public.da_qa_partner_oidc_sessions_011'),/permission denied/i);
    await assert.rejects(merchantPg.query(
      'SELECT * FROM public.da_qa_partner_oidc_sessions_011'),/permission denied/i);
    console.log('QA_F4G_ATTESTOR_AND_APP_LEAST_PRIVILEGE=PASS');
    console.log('QA_F4G_STRIPE_CALLS=ZERO_PAYOUTS=ZERO');
    console.log('QA_F4G_PRODUCTION_KEYCLOAK_AND_VPS=NOT_TOUCHED');
  }finally{
    if(verifier)verifier.onModuleDestroy();
    await proxy.close();
    await Promise.all([adminPg.end(),merchantPg.end(),
      courierPg.end(),attestor.end()]);
  }
});
