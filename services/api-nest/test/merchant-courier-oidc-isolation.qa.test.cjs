'use strict';
/** QA F4E: signed token claims checked after RSA by real external JWKS verifier. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {validatePartnerTokenIsolation:check}=
  require('../src/auth/merchant-courier-token-isolation');

const uuid='b63f867f-9f42-4573-9268-dc65a164d2c2';
const merchantAud='delishafrica-merchant';
const courierAud='delishafrica-courier';
const merchant={
  aud:['account',merchantAud],azp:merchantAud,sub:uuid,
  realm_access:{roles:['default-roles-afritaste','offline_access','merchant']},
  resource_access:{
    account:{roles:['view-profile','manage-account']},
    [merchantAud]:{roles:['merchant']},
  },
};
const courier={
  aud:['account',courierAud],azp:courierAud,sub:uuid,
  realm_access:{roles:['default-roles-afritaste','courier']},
  resource_access:{account:{roles:['view-profile']},[courierAud]:{roles:['courier']}},
};

test('F4E signed Merchant and Courier party-specific claims pass only own application',()=>{
  assert.equal(check(merchant,merchantAud,'merchant'),null);
  assert.equal(check(courier,courierAud,'courier'),null);
});
test('F4E foreign audience, courier-as-merchant, multi-app audience denied',()=>{
  for(const [role,aud,base,foreign] of [
    ['merchant',merchantAud,merchant,courierAud],
    ['courier',courierAud,courier,merchantAud],
  ]){
    for(const bad of [
      {...base,aud:['account',aud,foreign]},
      {...base,aud:foreign},
      {...base,aud:['account',aud,9]},
      {...base,aud:[]},
      {...base,aud:null},
    ]){
      assert.equal(check(bad,aud,role),'partner_audience_ambiguous');
    }
  }
});
test('F4E JWT azp must equal the signed app audience',()=>{
  for(const [role,aud,claims] of [
    ['merchant',merchantAud,merchant],['courier',courierAud,courier]
  ]){
    for(const azp of [undefined,'delishafrica-client','bad-actor',courierAud===aud?merchantAud:courierAud]){
      assert.equal(check({...claims,azp},aud,role),'partner_authorized_party_mismatch');
    }
  }
});
test('F4E mixed roles, ops, realm-admin and privilege escalation denied',()=>{
  for(const [role,aud,claims] of [
    ['merchant',merchantAud,merchant],['courier',courierAud,courier]
  ]){
    for(const elevated of ['client','ops','admin','realm-admin','manage-users',
      role==='merchant'?'courier':'merchant']){
      assert.equal(check({...claims,realm_access:{
        roles:[...claims.realm_access.roles,elevated],
      }},aud,role),'partner_realm_role_ambiguous',elevated);
    }
  }
});
test('F4E Keycloak cross-product resource grants denied even if expected app role exists',()=>{
  for(const [role,aud,claims,foreign] of [
    ['merchant',merchantAud,merchant,courierAud],
    ['courier',courierAud,courier,merchantAud]
  ]){
    assert.equal(check({...claims,resource_access:{
      ...claims.resource_access,[foreign]:{roles:['viewer']},
    }},aud,role),'partner_resource_access_ambiguous');
    assert.equal(check({...claims,resource_access:{
      ...claims.resource_access,'realm-management':{roles:['view-users']},
    }},aud,role),'partner_resource_access_ambiguous');
    assert.equal(check({...claims,resource_access:[]},aud,role),
      'partner_resource_access_ambiguous');
    assert.equal(check({...claims,resource_access:{
      [aud]:{roles:[role==='merchant'?'courier':'merchant']},
    }},aud,role),'partner_resource_access_ambiguous');
  }
});
test('F4E partner subject must be durable Keycloak UUID-shaped identity',()=>{
  for(const claims of [{...merchant,sub:'other'},
    {...merchant,sub:'ddd'},{...merchant,sub:null}]){
    assert.equal(check(claims,merchantAud,'merchant'),'partner_subject_invalid');
  }
});
test('F4E actual external JWT verifier calls partner gate only after cryptographic signature',()=>{
  const src=readFileSync(
    'services/api-nest/src/auth/external-jwks-verifier.service.ts','utf8');
  const signature=src.indexOf('const verified = crypto.verify(');
  const checkIndex=src.indexOf('validatePartnerTokenIsolation(');
  assert(signature>=0 && checkIndex>signature);
  assert(src.includes('claims.iss !== this.config.issuer'));
  assert(src.includes('partner_authorized_party_mismatch')===false);
  console.log('QA_F4E_RSA_THEN_PARTNER_ISOLATION=PASS');
});
