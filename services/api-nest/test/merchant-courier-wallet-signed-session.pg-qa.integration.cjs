'use strict';
/**
 * F4F / QA-only real PG17 integration and cryptographically signed ephemeral
 * Merchant/Courier JWTs. Real Keycloak + real durable legal registry NOT wired.
 * Container --network none; no Stripe, no real bank/PSP, no payout.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {Pool}=require('pg');
const {QaWalletVerifiedSessionBridge}=
  require('/qa-built/merchant-courier-wallet-signed-session.pg-qa.bridge.js');
const {validatePartnerTokenIsolation}=
  require('/qa-built/merchant-courier-token-isolation.js');

if(process.env.GITHUB_ACTIONS!=='true'||
   process.env.QA_SYNTHETIC_ONLY!=='YES'||
   process.env.QA_COMMERCE_DB_HOST!=='127.0.0.1'||
   process.env.QA_COMMERCE_DB_NAME!=='postgres'){
  throw Error('QA_F4F_NETWORK_NONE_PG17_ONLY');
}
const settings={host:'127.0.0.1',port:5432,database:'postgres',
  connectionTimeoutMillis:5000,statement_timeout:8000,query_timeout:8000};
const pool=user=>new Pool({...settings,user,max:4});
const admin=pool('postgres');
const merchantDb=pool('da_qa_merchant_commerce_app');
const courierDb=pool('da_qa_courier_commerce_app');
const attestor=pool('da_qa_wallet_attestor_010');
const issuerM='https://qa.example.invalid/realms/da-merchant';
const issuerC='https://qa.example.invalid/realms/da-courier';
const issuerForeign='https://qa.other.invalid/realms/da-courier';
const merchantA='b63f867f-9f42-4573-9268-dc65a164d2c2';
const merchantB='b63f867f-9f42-4573-9268-dc65a164d2c4';
const courierA='c63f867f-9f42-4573-9268-dc65a164d2c3';
const courierB='c63f867f-9f42-4573-9268-dc65a164d2c4';
const sha=(x)=>crypto.createHash('sha256').update(x).digest('hex');
const {privateKey,publicKey}=crypto.generateKeyPairSync('rsa',{
  modulusLength:2048,publicExponent:0x10001,
});
const foreignKeys=crypto.generateKeyPairSync('rsa',{
  modulusLength:2048,publicExponent:0x10001,
});
const kid='qa-f4f-ephemeral-key-20261013';
const sessions=new Map();
const nowSec=()=>Math.floor(Date.now()/1000);
const scopeFields='issuer,subject::text,organization_id::text,territory,'+
  'valid_from,valid_until,revoked_at';

function signed(claims,key=privateKey,headerChange={}){
  const head={alg:'RS256',typ:'at+jwt',kid,...headerChange};
  const h=Buffer.from(JSON.stringify(head)).toString('base64url');
  const p=Buffer.from(JSON.stringify(claims)).toString('base64url');
  const data=h+'.'+p;
  const sig=crypto.sign('RSA-SHA256',Buffer.from(data),key)
    .toString('base64url');
  return data+'.'+sig;
}
function claims(role,issuer,subject,label){
  const audience=role==='merchant'?'delishafrica-merchant':
    'delishafrica-courier';
  return {
    iss:issuer,sub:subject,role,
    aud:['account',audience],azp:audience,
    iat:nowSec()-10,exp:nowSec()+300,
    sid:'session-'+label+'-20261013',
    jti:'jti-'+label+'-'+sha(label).slice(0,24),
    realm_access:{roles:['default-roles-afritaste',role]},
    resource_access:{account:{roles:['view-profile']},
      [audience]:{roles:[role]}},
  };
}
async function offlineSignedVerifier(jwt){
  if(typeof jwt!=='string'||jwt.length>10000)return {ok:false,reason:'malformed_token'};
  const parts=jwt.split('.');
  if(parts.length!==3)return {ok:false,reason:'malformed_token'};
  try{
    const header=JSON.parse(Buffer.from(parts[0],'base64url').toString());
    const c=JSON.parse(Buffer.from(parts[1],'base64url').toString());
    if(header.alg!=='RS256'||header.kid!==kid||
       header.typ!=='at+jwt'||header.jku||header.x5u||header.crit){
      return {ok:false,reason:'unsupported_algorithm'};
    }
    if(!crypto.verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),
      publicKey,Buffer.from(parts[2],'base64url'))){
      return {ok:false,reason:'invalid_signature'};
    }
    const role=c.azp==='delishafrica-merchant'?'merchant':
      c.azp==='delishafrica-courier'?'courier':null;
    if(!role||validatePartnerTokenIsolation(c,c.azp,role)!==null)
      return {ok:false,reason:'partner_claim_denied'};
    if(!Number.isSafeInteger(c.iat)||!Number.isSafeInteger(c.exp)||
       c.iat>nowSec()+30||c.exp<=nowSec()||c.exp-c.iat>900){
      return {ok:false,reason:'token_expired'};
    }
    return {ok:true,payload:{
      sub:c.sub,role,name:'QA signed partner',
      authSource:'external',iat:c.iat,exp:c.exp,
      iss:c.iss,aud:c.aud,azp:c.azp,sid:c.sid,jti:c.jti,
    }};
  }catch{return {ok:false,reason:'malformed_token'};}
}
function register(claim){
  sessions.set([claim.iss,claim.sub,claim.sid,claim.jti].join('|'),true);
}
const ports={
  verify:{verifyToken:offlineSignedVerifier},
  checkLiveSession:async(issuer,subject,sid,jti)=>{
    const key=[issuer,subject,sid,jti].join('|');
    if(!sessions.get(key))return null;
    return {source:'independent-revocation-ledger',active:true,
      issuer,subject,sid,jti,checkedAtEpochMs:Date.now()};
  },
  readMerchantWalletScopes:async(issuer,subject)=>{
    const rows=(await admin.query(
      'SELECT '+scopeFields+',merchant_slug,membership_status,'+
      'contract_status,kyb_status,partner_state FROM '+
      'public.da_qa_wallet_merchant_scope_010 WHERE issuer=$1 AND subject=$2::uuid',
      [issuer,subject])).rows;
    return rows.map(r=>({
      source:'committed-wallet-registry',role:'merchant',
      issuer:r.issuer,subject:r.subject,
      organizationId:r.organization_id,territory:r.territory,
      merchantSlug:r.merchant_slug,membershipRole:'finance',
      membershipStatus:r.membership_status,
      contractStatus:r.contract_status,kybStatus:r.kyb_status,
      partnerLifecycleStatus:r.partner_state,
      startsAt:r.valid_from?.toISOString?.()||String(r.valid_from),
      expiresAt:r.valid_until?.toISOString?.()||null,
      revokedAt:r.revoked_at?.toISOString?.()||null,
    }));
  },
  readCourierWalletScope:async(issuer,subject)=>{
    const rows=(await admin.query(
      'SELECT '+scopeFields+',roster_active,agreement_status,kyc_status '+
      'FROM public.da_qa_wallet_courier_scope_010 '+
      'WHERE issuer=$1 AND subject=$2::uuid',
      [issuer,subject])).rows;
    if(rows.length!==1)return null;
    const r=rows[0];
    return {source:'committed-wallet-registry',role:'courier',
      issuer:r.issuer,subject:r.subject,organizationId:r.organization_id,
      territory:r.territory,rosterActive:r.roster_active,
      agreementStatus:r.agreement_status,kycStatus:r.kyc_status,
      startsAt:r.valid_from?.toISOString?.()||String(r.valid_from),
      expiresAt:r.valid_until?.toISOString?.()||null,
      revokedAt:r.revoked_at?.toISOString?.()||null,
    };
  },
  merchantPool:merchantDb,courierPool:courierDb,attestor,
};
const merchantBridge=new QaWalletVerifiedSessionBridge(ports,issuerM);
const courierBridge=new QaWalletVerifiedSessionBridge(ports,issuerC);
const foreignBridge=new QaWalletVerifiedSessionBridge(ports,issuerForeign);
const attempt=(bridge,jwt)=>bridge.readWallet('Bearer '+jwt);
const denied=(promise)=>assert.rejects(promise,/qa_f4f_financial_identity_denied/);

test('F4F signed Merchant/Courier wallet QA bridge: real PG17, RSA, revocation, org boundaries',async()=>{
  try{
    // 010 test has revoked both A scopes. Reset only SYNTHETIC PG fixtures.
    await admin.query(
      "UPDATE public.da_qa_wallet_merchant_scope_010 SET kyb_status='verified' "+
      "WHERE issuer=$1 AND subject=$2::uuid",[issuerM,merchantA]);
    await admin.query(
      "UPDATE public.da_qa_wallet_courier_scope_010 SET roster_active=true "+
      "WHERE issuer=$1 AND subject=$2::uuid",[issuerC,courierA]);
    const mA=claims('merchant',issuerM,merchantA,'merchant-a');
    const mB=claims('merchant',issuerM,merchantB,'merchant-b');
    const cA=claims('courier',issuerC,courierA,'courier-a');
    const cB=claims('courier',issuerC,courierB,'courier-b');
    const foreign=claims('courier',issuerForeign,courierA,'courier-foreign');
    [mA,mB,cA,cB,foreign].forEach(register);
    const jwtMA=signed(mA),jwtMB=signed(mB);
    const jwtCA=signed(cA),jwtCB=signed(cB),jwtForeign=signed(foreign);

    const dataMA=await attempt(merchantBridge,jwtMA);
    assert.equal(dataMA.ownerRole,'merchant');
    assert.equal(dataMA.merchantSlug,'qa-restaurant');
    assert.equal(dataMA.organizationId,'a43f867f-9f42-4573-9268-dc65a164d2c2');
    assert.equal(dataMA.territory,'BE');
    assert.equal(dataMA.summary.accrued_minor,1840);
    assert.equal(dataMA.summary.held_minor,1840);
    assert.equal(dataMA.activity.length,1);
    assert.equal(dataMA.withdrawableMinor,0);
    assert.equal(dataMA.payoutEnabled,false);
    const dataMB=await attempt(merchantBridge,jwtMB);
    assert.equal(dataMB.ownerRole,'merchant');
    assert.equal(dataMB.territory,'FR');
    assert.equal(dataMB.summary.accrued_minor,0);
    assert.deepEqual(dataMB.activity,[]);
    console.log('QA_F4F_RSA_MERCHANT_A_B_SEPARATE_SQL_WALLET=PASS');

    const dataCA=await attempt(courierBridge,jwtCA);
    assert.equal(dataCA.ownerRole,'courier');
    assert.equal(dataCA.summary.accrued_minor,390);
    assert.equal(dataCA.summary.held_minor,390);
    assert.equal(dataCA.withdrawableMinor,0);
    const dataCB=await attempt(courierBridge,jwtCB);
    assert.equal(dataCB.summary.accrued_minor,0);
    const dataForeign=await attempt(foreignBridge,jwtForeign);
    assert.equal(dataForeign.summary.accrued_minor,0);
    await denied(attempt(courierBridge,jwtForeign));
    await denied(attempt(merchantBridge,jwtCA));
    console.log('QA_F4F_RSA_COURIER_REALM_ORG_SESSION_PARTITION=PASS');

    await denied(attempt(merchantBridge,
      signed({...mA,sub:merchantB},foreignKeys.privateKey)));
    const altered=jwtMA.split('.');
    const forged=Buffer.from(JSON.stringify({...mA,sub:merchantB}))
      .toString('base64url');
    await denied(attempt(merchantBridge,
      altered[0]+'.'+forged+'.'+altered[2]));
    await denied(attempt(merchantBridge,
      signed({...mA,azp:'delishafrica-courier'})));
    await denied(attempt(merchantBridge,
      signed({...mA,aud:['delishafrica-merchant','delishafrica-courier']})));
    await denied(attempt(merchantBridge,
      signed({...mA,realm_access:{roles:['merchant','ops']}})));
    await denied(attempt(merchantBridge,
      signed({...mA,exp:nowSec()-1})));
    await denied(attempt(merchantBridge,
      signed({...mA,sid:null})));
    await denied(merchantBridge.readWallet('Bearer fake.jwt.value'));
    await denied(merchantBridge.readWallet({sub:merchantA,role:'merchant'}));
    console.log('QA_F4F_INVALID_SIGNATURE_MIXED_ROLE_UNVERIFIED_IDENTITY=DENIED');

    // The OIDC session is revoked BEFORE the DB attestor receives a
    // challenge, even while the JWT signature and exp remain valid.
    sessions.delete([mA.iss,mA.sub,mA.sid,mA.jti].join('|'));
    await denied(attempt(merchantBridge,jwtMA));
    sessions.delete([cA.iss,cA.sub,cA.sid,cA.jti].join('|'));
    await denied(attempt(courierBridge,jwtCA));
    console.log('QA_F4F_SIGNED_BUT_REVOKED_PARTNER_SESSIONS=DENIED');

    // Contract or roster changes in committed synthetic SQL registry
    // are rejected even while the signed token and session remain active.
    await admin.query(
      "UPDATE public.da_qa_wallet_merchant_scope_010 "+
      "SET contract_status='suspended' WHERE issuer=$1 AND subject=$2::uuid",
      [issuerM,merchantB]);
    await denied(attempt(merchantBridge,jwtMB));
    await admin.query(
      "UPDATE public.da_qa_wallet_courier_scope_010 "+
      "SET roster_active=false WHERE issuer=$1 AND subject=$2::uuid",
      [issuerC,courierB]);
    await denied(attempt(courierBridge,jwtCB));
    console.log('QA_F4F_CONTRACT_OR_ROSTER_REVOKED_WITH_VALID_JWT=DENIED');

    // Prevent "auth by input": fake role/account identifiers in payload
    // cannot be used to obtain a new certificate or select a SQL wallet.
    await denied(merchantBridge.readWallet('Bearer '+signed({
      ...mA,authSource:'dev-login',aud:['delishafrica-courier'],
    })));
    console.log('QA_F4F_REAL_STRIPE_CALLS=ZERO_PAYOUTS=ZERO');
  }finally{
    await Promise.all([
      admin.end(),merchantDb.end(),courierDb.end(),attestor.end(),
    ]);
  }
});
