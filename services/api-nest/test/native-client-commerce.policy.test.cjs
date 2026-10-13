'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomBytes } = require('node:crypto');
const { readFileSync } = require('node:fs');
const {
  nativeClientEmailBindingHmac,
  evaluateNativeClientCommerce,
} = require('../src/auth/native-client-commerce.policy');

// THESE ARE SYNTHETIC CLAIMS ONLY. A REAL JWT verifier MUST be wired separately.
const now = 1791792000;
const secret = 'SYNTHETIC_ONLY_' + 'x'.repeat(42);
const subject = 'a63f867f-9f42-4573-9268-dc65a164d2c1';
const otherSubject = 'b63f867f-9f42-4573-9268-dc65a164d2c2';
const issuer = 'https://auth.qa.example.invalid/realms/da-client';
const audience = 'delishafrica-client';
const email = 'synthetic-client@example.invalid';
const trust = Object.freeze({
  issuer, audience, clientId: audience, emailHmacSecret: secret,
  nowSeconds: now,
});
const claim = Object.freeze({
  iss: issuer, aud: ['account', audience], azp: audience, sub: subject,
  exp: now + 1200, iat: now - 45,
  email, email_verified: true,
  realm_access: { roles: ['client','default-roles-da-client','offline_access','uma_authorization'] },
  resource_access: { account: { roles: ['manage-account','view-profile'] } },
});
const evidence = Object.freeze({
  signatureVerified: true, issuerKeysPinned: true, claims: claim,
});
const ledger = Object.freeze({
  schemaVersion: 1, status: 'approved', subjectId: subject,
  emailBindingHmac: nativeClientEmailBindingHmac(secret, email),
  smsRecipientHmac: randomBytes(32).toString('hex'),
  smsVerifiedSubjectId: subject, emailVerifiedSubjectId: subject,
  providerSmsProofAccepted: true, providerEmailProofAccepted: true,
  transactionCommittedAtSeconds: now - 90, revokedAtSeconds: null,
});
const judge = (p={},l={},t={}) => evaluateNativeClientCommerce(
  { ...evidence, ...p, claims: { ...claim, ...(p.claims||{}) } },
  { ...ledger, ...l }, { ...trust, ...t },
);

test('only a signature-verified, issuer-pinned subject with durable SMS/email ledger can pass', () => {
  assert.equal(judge(), null);
});
test('rejects when the separate cryptographic verification evidence is absent', () => {
  assert.equal(evaluateNativeClientCommerce(null, ledger, trust),'native_jwt_not_cryptographically_verified');
  assert.equal(judge({signatureVerified:false}),'native_jwt_not_cryptographically_verified');
  assert.equal(judge({issuerKeysPinned:false}),'native_jwt_not_cryptographically_verified');
});
test('rejects untrusted issuer config and spoofed issuer claim, even same domain', () => {
  for (const x of [
    'http://auth.qa.example.invalid/realms/da-client',
    'https://auth.qa.example.invalid:8443/realms/da-client',
    'https://auth.qa.example.invalid/realms/da-client?x=1',
    'https://auth.qa.example.invalid/realms/da-client/',
    '',
  ]) assert.equal(judge({}, {}, {issuer:x}),'native_client_issuer_not_allowlisted');
  for (const iss of [
    'https://auth.qa.example.invalid/realms/afritaste',
    'https://evil.example.invalid/realms/da-client',
    issuer+'/something',
  ]) assert.equal(judge({claims:{iss}}),'native_client_claims_invalid');
});
test('rejects wrong clientId/azp, missing or malformed subject, and non-client audiences', () => {
  assert.equal(judge({claims:{azp:'delishafrica-merchant'}}),'native_client_claims_invalid');
  assert.equal(judge({claims:{sub:'bad-user'}}),'native_client_subject_missing');
  for(const aud of [
    'delishafrica-merchant',
    ['account',audience,'delishafrica-courier'],
    ['delishafrica-master-dashboard',audience],
    [audience,5],null,
  ]) assert.equal(judge({claims:{aud}}),'native_client_audience_invalid');
});
test('rejects expired, forged-future, malformed and reversed time windows', () => {
  for (const updates of [
    {exp:now},{exp:now-1},{exp:'9999999999'},
    {iat:now+1000},{iat:0},{iat:now+10,exp:now+9},
  ]) assert.equal(judge({claims:updates}),'native_client_token_expired');
});
test('rejects native OAuth identity without cryptographically verified email claim', () => {
  for(const x of [false,'true',null,0,undefined]) {
    assert.equal(judge({claims:{email_verified:x}}),'native_client_email_not_verified');
  }
  assert.equal(judge({claims:{email:null}}),'native_client_email_not_verified');
});
test('rejects all Merchant, Courier, Ops and Keycloak administration realm roles', () => {
  for(const role of ['merchant','courier','ops','admin','realm-admin','manage-users','query-users']) {
    const roles=[...claim.realm_access.roles,role];
    assert.equal(judge({claims:{realm_access:{roles}}}),'native_client_roles_unsafe',role);
  }
  for(const role of ['merchant','courier','ops','realm-admin']){
    assert.equal(judge({claims:{realm_access:{roles:[role]}}}),'native_client_roles_unsafe');
  }
  assert.equal(judge({claims:{realm_access:{roles:['client','default-roles-afritaste']}}}),
    'native_client_roles_unsafe');
});
test('rejects all foreign client grants, even with legitimate realm Client role', () => {
  for(const key of ['realm-management','delishafrica-merchant','delishafrica-courier']){
    assert.equal(judge({claims:{resource_access:{
      account:{roles:['view-profile']},[key]:{roles:['manage-users']},
    }}}),'native_client_roles_unsafe');
  }
  assert.equal(judge({claims:{resource_access:['account']}}),'native_client_roles_unsafe');
});
test('denies missing, pending, revoked, or manual-review ledger rows', () => {
  assert.equal(evaluateNativeClientCommerce(evidence,null,trust),'native_client_ledger_missing');
  assert.equal(judge({}, {schemaVersion:999}),'native_client_ledger_missing');
  for (const status of ['pending','revoked','needs_review']) {
    assert.equal(judge({}, {status}),'native_client_ledger_not_approved');
  }
  assert.equal(judge({}, {revokedAtSeconds:now-10}),'native_client_ledger_not_approved');
});
test('denies cross-account ledger re-use and changed email identity', () => {
  for(const field of ['subjectId','smsVerifiedSubjectId','emailVerifiedSubjectId']) {
    assert.equal(judge({}, {[field]:otherSubject}),'native_client_ledger_binding_mismatch',field);
  }
  assert.equal(judge({claims:{email:'changed@example.invalid'}}),
    'native_client_ledger_binding_mismatch');
  assert.equal(judge({}, {emailBindingHmac:'0'.repeat(64)}),
    'native_client_ledger_binding_mismatch');
  assert.equal(judge({}, {emailBindingHmac:'bad'}),'native_client_ledger_binding_mismatch');
});
test('denies missing provider attestation or tampered SMS recipient commitment', () => {
  for(const field of ['providerSmsProofAccepted','providerEmailProofAccepted']) {
    assert.equal(judge({}, {[field]:false}),'native_client_ledger_sms_not_authorized');
  }
  assert.equal(judge({}, {smsRecipientHmac:'FAKE_SMS_SUCCESS'}),
    'native_client_ledger_sms_not_authorized');
  assert.equal(judge({}, {smsRecipientHmac:'a'.repeat(63)}),
    'native_client_ledger_sms_not_authorized');
});
test('denies uncommitted, future or malformed transaction receipt', () => {
  for(const t of [0,-1,now+3,'2026-10-12',NaN]) {
    assert.equal(judge({}, {transactionCommittedAtSeconds:t}),
      'native_client_ledger_commit_invalid');
  }
});
test('normalizes e-mail binding using HMAC and requires strong secret', () => {
  assert.equal(
    nativeClientEmailBindingHmac(secret,'  SYNTHETIC-CLIENT@EXAMPLE.INVALID '),
    nativeClientEmailBindingHmac(secret,email),
  );
  assert.throws(()=>nativeClientEmailBindingHmac('short',email),
    /native_email_hmac_secret_missing/);
  assert.throws(()=>nativeClientEmailBindingHmac(secret,'fake'),
    /native_email_invalid/);
});
test('the native commerce gate is candidate-only: it is NOT wired to production app or payment routes', () => {
  const app = readFileSync('services/api-nest/src/app.module.ts','utf8');
  const orders = readFileSync('services/api-nest/src/orders/orders.controller.ts','utf8');
  const enrollment = readFileSync('services/api-nest/src/client-enrollment/client-enrollment.service.ts','utf8');
  for(const s of [app,orders,enrollment]) {
    assert(!s.includes('evaluateNativeClientCommerce'),
      'do not silently enable new realm admission before QA and migrations');
  }
});
