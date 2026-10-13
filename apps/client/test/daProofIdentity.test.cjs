/* Pure Client contact-normalization tests, no network and no proof token logging. */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ts = require(require.resolve('typescript', { paths: [path.resolve(__dirname, '..')] }));
const source = fs.readFileSync(path.resolve(__dirname, '../utils/daProofIdentity.ts'), 'utf8');
const emitted = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleObject = { exports: {} };
(new Function('exports', 'module', emitted))(moduleObject.exports, moduleObject);
const { daCanonicalContact, daLocalProofFresh } = moduleObject.exports;

const now = Date.parse('2026-10-11T21:00:00Z');
const fresh = new Date(now + 20_000).toISOString();
const expired = new Date(now - 20_000).toISOString();
const phone = '+32470123456';
const email = 'contact@example.org';

test('phone formatting and international 00 prefix are canonicalized identically to the API', () => {
  assert.equal(daCanonicalContact('sms', '+32 (470) 12-34.56'), phone);
  assert.equal(daCanonicalContact('sms', '0032 470 12 34 56'), phone);
  assert.equal(daCanonicalContact('sms', '  +32.470.12.34.56  '), phone);
  assert.equal(daCanonicalContact('sms', '+32470123457'), '+32470123457');
});

test('email casing and outer whitespace do not change a verified identity', () => {
  assert.equal(daCanonicalContact('email', '  CONTACT@EXAMPLE.ORG  '), email);
  assert.equal(daCanonicalContact('email', 'contact@example.org'), email);
  assert.notEqual(daCanonicalContact('email', 'other@example.org'), email);
});

test('an existing unexpired signed proof survives harmless phone/email formatting', () => {
  assert.equal(daLocalProofFresh('sms',
    { token: 'redacted-signed-sms-proof', destination: '0032 470 12 34 56', expiresAt: fresh },
    '+32 (470) 12-34-56', now), true);
  assert.equal(daLocalProofFresh('email',
    { token: 'redacted-signed-email-proof', destination: 'CONTACT@EXAMPLE.ORG', expiresAt: fresh },
    '  contact@example.org ', now), true);
});

test('a genuinely different destination or expired proof cannot be treated as valid', () => {
  const record = { token: 'redacted-signed-proof', destination: phone, expiresAt: fresh };
  assert.equal(daLocalProofFresh('sms', record, '+32470123457', now), false);
  assert.equal(daLocalProofFresh('sms', { ...record, expiresAt: expired }, phone, now), false);
  assert.equal(daLocalProofFresh('sms', { ...record, expiresAt: 'invalid' }, phone, now), false);
  assert.equal(daLocalProofFresh('sms', { ...record, token: '' }, phone, now), false);
  assert.equal(daLocalProofFresh('sms', null, phone, now), false);
});

test('checkout still requires BOTH server re-attestations and a canonical Client session', () => {
  const checkout = fs.readFileSync(path.resolve(__dirname, '../app/checkout-preflight.tsx'), 'utf8');
  const link = fs.readFileSync(path.resolve(__dirname, '../utils/daOrdersApi.ts'), 'utf8');
  const activate = fs.readFileSync(path.resolve(__dirname, '../app/activate-account.tsx'), 'utf8');
  assert(checkout.includes('daSessionRehydrationStatus()'));
  assert(checkout.includes("daAttestIdentityProof({"));
  assert(checkout.includes('daLocalProofFresh('));
  assert(link.includes("daLocalProofFresh('sms'"));
  assert(link.includes("daLocalProofFresh('email'"));
  assert(link.includes("/auth/client/me"));
  assert(activate.includes('ready && verified ? <View'));
  assert(activate.includes('ready && verified ? <Pressable'));
  assert(activate.includes("daAttestIdentityProof({"));
  assert(!activate.includes('presentPaymentSheet'));
});
