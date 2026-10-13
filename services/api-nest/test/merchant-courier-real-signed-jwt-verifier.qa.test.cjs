'use strict';
/**
 * F4F CI-only real ExternalJwksVerifierService.verifyToken with ephemeral
 * RSA key and pinned local key cache. No HTTP fetch, production Keycloak,
 * actual membership, external secrets, or payout. No constructor config file.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {ExternalJwksVerifierService}=
  require('../src/auth/external-jwks-verifier.service');

if(process.env.GITHUB_ACTIONS!=='true'||
   process.env.QA_SYNTHETIC_ONLY!=='YES'){
  throw Error('QA_F4F_REAL_VERIFIER_EPHEMERAL_CI_ONLY');
}
const issuer='https://qa.example.invalid/realms/afritaste';
const merchantAud='delishafrica-merchant';
const courierAud='delishafrica-courier';
const keys=crypto.generateKeyPairSync('rsa',{
  modulusLength:2048,publicExponent:0x10001,
});
const second=crypto.generateKeyPairSync('rsa',{
  modulusLength:2048,publicExponent:0x10001,
});
const kid='qa-f4f-key-only-in-memory';
const mId='b63f867f-9f42-4573-9268-dc65a164d2c2';
const cId='c63f867f-9f42-4573-9268-dc65a164d2c3';
const config={
  issuer,discoveryUrl:issuer+'/.well-known/openid-configuration',
  advertisedJwksUrl:issuer+'/protocol/openid-connect/certs',
  jwksUrl:issuer+'/protocol/openid-connect/certs',
  audience:merchantAud,allowedAlgorithms:['RS256'],
  merchantRealmRoles:['merchant'],merchantClientRoles:['merchant'],
  clockSkewSeconds:30,refreshSeconds:120,
};
function create(){
  const proto=ExternalJwksVerifierService.prototype;
  const original=proto.readConfig;
  proto.readConfig=()=>config;
  let verifier;
  try{
    verifier=new ExternalJwksVerifierService();
  }finally{
    proto.readConfig=original;
  }
  // Only synthetic memory key; this test does NOT certify JWKS provenance.
  verifier.keys.set(kid,{kid,alg:'RS256',key:keys.publicKey});
  verifier.ready=true;
  verifier.refreshKeys=async()=>{};
  return verifier;
}
const verifier=create();
const ts=()=>Math.floor(Date.now()/1000);
function claims(role){
  const aud=role==='merchant'?merchantAud:courierAud;
  return {
    iss:issuer,sub:role==='merchant'?mId:cId,
    aud:['account',aud],azp:aud,
    exp:ts()+300,iat:ts()-5,nbf:ts()-5,
    sid:'qa-signed-session-20261013-'+role,
    jti:'qa-jti-20261013-'+role,
    realm_access:{roles:['default-roles-afritaste',role]},
    resource_access:{account:{roles:['view-profile']},[aud]:{roles:[role]}},
  };
}
function sign(c,privateKey=keys.privateKey,extra={}){
  const header={alg:'RS256',kid,typ:'at+jwt',...extra};
  const h=Buffer.from(JSON.stringify(header)).toString('base64url');
  const p=Buffer.from(JSON.stringify(c)).toString('base64url');
  const source=h+'.'+p;
  return source+'.'+crypto.sign('RSA-SHA256',
    Buffer.from(source),privateKey).toString('base64url');
}
async function reason(jwt,expected){
  const v=await verifier.verifyToken(jwt);
  assert.equal(v.ok,false);
  assert.equal(v.reason,expected);
}
test('F4F REAL API verifier accepts signed valid Merchant/Courier claims only',async()=>{
  for(const role of ['merchant','courier']){
    const jwt=sign(claims(role));
    const result=await verifier.verifyToken(jwt);
    assert.equal(result.ok,true);
    assert.equal(result.payload.role,role);
    assert.equal(result.payload.authSource,'external');
    assert.equal(result.payload.azp,role==='merchant'?merchantAud:courierAud);
    assert.equal(result.payload.iss,issuer);
  }
  console.log('QA_F4F_REAL_EXTERNAL_JWKS_VERIFIER_SYNTHETIC_RSA=PASS');
});
test('F4F forged/substituted RSA signatures and issuer mismatch are denied',async()=>{
  const m=claims('merchant');
  await reason(sign(m,second.privateKey),'invalid_signature');
  const jwt=sign(m).split('.');
  jwt[1]=Buffer.from(JSON.stringify({...m,sub:cId})).toString('base64url');
  await reason(jwt.join('.'),'invalid_signature');
  await reason(sign({...m,iss:'https://attacker.invalid/realms/afritaste'}),
    'issuer_mismatch');
  await reason(sign(m,keys.privateKey,{alg:'none'}),'unsupported_algorithm');
});
test('F4F REAL verifier denies cryptographically signed cross-role partner claims',async()=>{
  const m=claims('merchant'), c=claims('courier');
  await reason(sign({...m,aud:['account',merchantAud,courierAud]}),
    'partner_audience_ambiguous');
  await reason(sign({...m,azp:courierAud}),
    'partner_authorized_party_mismatch');
  await reason(sign({...c,azp:merchantAud}),
    'partner_authorized_party_mismatch');
  await reason(sign({...m,realm_access:{roles:['merchant','courier']}}),
    'partner_realm_role_ambiguous');
  await reason(sign({...m,resource_access:{
    ...m.resource_access,
    'realm-management':{roles:['manage-users']},
  }}),'partner_resource_access_ambiguous');
  await reason(sign({...c,sub:'forged-partner-subject'}),
    'partner_subject_invalid');
  console.log('QA_F4F_REAL_VERIFIER_FORGED_CROSS_PRODUCT_ROLES=DENIED');
});
