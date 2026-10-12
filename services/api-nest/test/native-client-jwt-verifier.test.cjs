'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const crypto = require('node:crypto');
const { readFileSync } = require('node:fs');
const { verifyNativeClientJwt } = require('../src/auth/native-client-jwt-verifier');
const {
  nativeClientEmailBindingHmac,
  evaluateNativeClientCommerce,
} = require('../src/auth/native-client-commerce.policy');

// Fully synthetic RSA key pairs generated only in the ephemeral GitHub runner.
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048, publicExponent: 0x10001,
});
const otherKeys = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048, publicExponent: 0x10001,
});
const jwk = { ...publicKey.export({ format:'jwk' }),kid:'qa-client-kid-1',alg:'RS256',use:'sig' };
const wrongJwk = { ...otherKeys.publicKey.export({ format:'jwk' }),kid:'qa-client-kid-1',alg:'RS256',use:'sig' };
const issuer='https://auth.qa.example.invalid/realms/da-client';
const aud='delishafrica-client';
const sub='a63f867f-9f42-4573-9268-dc65a164d2c1';
const email='qa-client@example.invalid';
const now=1791792000;
const settings={ issuer, audience:aud,clientId:aud,nowSeconds:now,maxTokenLifetimeSeconds:1200 };
const pinned={issuer,provenanceVerified:true,keys:[jwk]};
const claims={
  iss:issuer,sub,azp:aud,aud:['account',aud],exp:now+540,iat:now-40,
  email_verified:true,email,
  realm_access:{roles:['client','default-roles-da-client','offline_access']},
  resource_access:{account:{roles:['manage-account','view-profile']}},
};
function sign(c=claims,header={},key=privateKey){
  const head={alg:'RS256',kid:'qa-client-kid-1',typ:'at+jwt',...header};
  const protectedHeader=Buffer.from(JSON.stringify(head)).toString('base64url');
  const body=Buffer.from(JSON.stringify(c)).toString('base64url');
  const unsigned=protectedHeader+'.'+body;
  return unsigned+'.'+crypto.sign('RSA-SHA256',Buffer.from(unsigned),key).toString('base64url');
}
const secret='SYNTHETIC_JWT_LEDGER_HMAC_ONLY_'+ 'x'.repeat(42);
const ledger={
  schemaVersion:1,status:'approved',subjectId:sub,
  emailBindingHmac:nativeClientEmailBindingHmac(secret,email),
  smsRecipientHmac:'a'.repeat(64),emailVerifiedSubjectId:sub,
  smsVerifiedSubjectId:sub,
  providerSmsProofAccepted:true,providerEmailProofAccepted:true,
  transactionCommittedAtSeconds:now-45,revokedAtSeconds:null,
};
const commerceTrust={issuer,audience:aud,clientId:aud,emailHmacSecret:secret,nowSeconds:now};

test('real RSA signature from the PINNED Client issuer authorizes only with durable ledger',()=>{
  const verification=verifyNativeClientJwt(sign(),pinned,settings);
  assert.equal(verification.ok,true);
  assert.equal(evaluateNativeClientCommerce(verification.evidence,ledger,commerceTrust),null);
  assert.equal(evaluateNativeClientCommerce(verification.evidence,null,commerceTrust),
    'native_client_ledger_missing');
});
test('do not accept any unknown or spoofed JWKS source, even with matching RSA key material',()=>{
  for(const source of [
    {...pinned,provenanceVerified:false},
    {...pinned,issuer:'https://auth.qa.example.invalid/realms/afritaste'},
    {...pinned,keys:[]},
    {...pinned,keys:Array(17).fill(jwk)},
  ]){
    assert.equal(verifyNativeClientJwt(sign(),source,settings).reason,
      'native_signature_provenance_untrusted');
  }
  assert.equal(verifyNativeClientJwt(sign(),{...pinned,keys:[wrongJwk]},settings).reason,
    'native_jwt_signature_invalid');
});
test('tampered claims and same-kid foreign-realm keys fail actual cryptographic signature check',()=>{
  const jwt=sign();
  const parts=jwt.split('.');
  const forgedPayload=Buffer.from(JSON.stringify({...claims,email_verified:true,sub:
    'b63f867f-9f42-4573-9268-dc65a164d2c2'})).toString('base64url');
  assert.equal(verifyNativeClientJwt(parts[0]+'.'+forgedPayload+'.'+parts[2],
    pinned,settings).reason,'native_jwt_signature_invalid');
  assert.equal(verifyNativeClientJwt(sign(claims,{},otherKeys.privateKey),
    pinned,settings).reason,'native_jwt_signature_invalid');
});
test('JWT alg none/HS256, jku, x5u and critical headers are rejected',()=>{
  for(const bad of [
    {alg:'none'},{alg:'HS256'},
    {jku:'https://evil.example/jwks.json'},
    {x5u:'https://evil.example/cert'},
    {crit:['zip']},
  ]){
    assert.equal(verifyNativeClientJwt(sign(claims,bad),pinned,settings).reason,
      'native_jwt_algorithm_rejected');
  }
  assert.equal(verifyNativeClientJwt(sign(claims,{kid:'unknown'}),pinned,settings).reason,
    'native_jwt_key_not_pinned');
  assert.equal(verifyNativeClientJwt(sign(),{...pinned,keys:[jwk,jwk]},settings).reason,
    'native_jwt_key_not_pinned');
});
test('wrong realm issuer is rejected even with cryptographically correct signature',()=>{
  for(const other of [
    'https://auth.qa.example.invalid/realms/afritaste',
    'https://attacker.example.invalid/realms/da-client',
    issuer+'/',
  ]){
    assert.equal(verifyNativeClientJwt(sign({...claims,iss:other}),pinned,settings).reason,
      'native_jwt_issuer_invalid');
  }
  for(const other of ['http://auth.qa.example.invalid/realms/da-client',
    'https://auth.qa.example.invalid:8443/realms/da-client']){
    assert.equal(verifyNativeClientJwt(sign(),pinned,{...settings,issuer:other}).reason,
      'native_signature_provenance_untrusted');
  }
});
test('unauthorized azp, merchant/courier audience or inconsistent audience array denied',()=>{
  for(const other of ['delishafrica-merchant','delishafrica-courier']){
    assert.equal(verifyNativeClientJwt(sign({...claims,azp:other}),pinned,settings).reason,
      'native_jwt_audience_invalid');
  }
  for(const invalid of [
    'delishafrica-merchant',
    [aud,'delishafrica-courier'],
    [aud,'delishafrica-master-dashboard'],
    [aud,4],null,
  ]){
    assert.equal(verifyNativeClientJwt(sign({...claims,aud:invalid}),pinned,settings).reason,
      'native_jwt_audience_invalid');
  }
});
test('rejected when signed JWT is expired, future-dated or TTL exceeds policy',()=>{
  for(const data of [
    {exp:now},{iat:now+999},{exp:now+3700},
    {exp:now+61,iat:now+62},
    {nbf:now+900},
  ]){
    const result=verifyNativeClientJwt(sign({...claims,...data}),pinned,settings);
    assert.equal(result.reason,'native_jwt_expired_or_unbounded');
  }
});
test('cryptographically valid but email-unverified and role-injected JWTs still cannot purchase',()=>{
  for(const diff of [
    {email_verified:false},
    {realm_access:{roles:['client','merchant']}},
    {realm_access:{roles:['client','realm-admin']}},
    {resource_access:{'realm-management':{roles:['manage-users']}}},
  ]){
    const signed=verifyNativeClientJwt(sign({...claims,...diff}),pinned,settings);
    assert.equal(signed.ok,true,'signed does not itself imply business permission');
    const rejected=evaluateNativeClientCommerce(signed.evidence,ledger,commerceTrust);
    assert.notEqual(rejected,null);
  }
});
test('changing or replaying a durable SMS proof for another subject cannot grant commerce',()=>{
  const signed=verifyNativeClientJwt(sign(),pinned,settings);
  assert.equal(signed.ok,true);
  assert.equal(evaluateNativeClientCommerce(signed.evidence,{
    ...ledger,smsVerifiedSubjectId:'b63f867f-9f42-4573-9268-dc65a164d2c2',
  },commerceTrust),'native_client_ledger_binding_mismatch');
  assert.equal(evaluateNativeClientCommerce(signed.evidence,{
    ...ledger,status:'revoked',revokedAtSeconds:now-10,
  },commerceTrust),'native_client_ledger_not_approved');
});
test('oversized, empty or malformed JWT never reaches ledger authorization',()=>{
  for(const value of ['', 'bad.jwt','.'.repeat(8),'x'.repeat(32769)]){
    assert.equal(verifyNativeClientJwt(value,pinned,settings).reason,
      'native_jwt_malformed');
  }
});
test('candidate signer verifier is NOT deployed, bypassing the current shared realm is forbidden',()=>{
  const app=readFileSync('services/api-nest/src/app.module.ts','utf8');
  const existing=readFileSync('services/api-nest/src/auth/external-jwks-verifier.service.ts','utf8');
  assert(!app.includes('verifyNativeClientJwt'));
  assert(!existing.includes('verifyNativeClientJwt'));
  assert(!existing.includes('native-client-jwt-verifier'));
});
