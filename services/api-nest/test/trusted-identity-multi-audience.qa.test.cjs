'use strict';
// QA-only crypto fixtures: no real Keycloak token, user, key or network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { ExternalJwksVerifierService } = require('../dist/auth/external-jwks-verifier.service.js');

const ISSUER = 'https://keycloak.afritaste.delishafrica.me/realms/afritaste';
const MERCHANT = 'delishafrica-merchant';
const CLIENT = 'delishafrica-client';
const COURIER = 'delishafrica-courier';
const OPS = 'delishafrica-master-dashboard';
const ATM = 'afritaste-mobile';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

function token(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: ISSUER, aud: MERCHANT, azp: ATM, sub: 'qa-synthetic-person',
    iat: now - 30, exp: now + 1800, realm_access: { roles: ['merchant'] }, ...overrides };
  const header = Buffer.from(JSON.stringify({alg: 'RS256', typ: 'JWT', kid: 'qa-ephemeral'})).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const raw = header + '.' + payload;
  return raw + '.' + crypto.sign('RSA-SHA256', Buffer.from(raw, 'ascii'), privateKey).toString('base64url');
}
function verifier() {
  // Instantiate just the verifier logic against a locally generated ephemeral key.
  // No external request and no dependency on on-disk production configuration.
  const v = Object.create(ExternalJwksVerifierService.prototype);
  v.config = { issuer: ISSUER, audience: MERCHANT, merchantRealmRoles: ['merchant', MERCHANT],
    merchantClientRoles: ['merchant'], clockSkewSeconds: 30 };
  v.keys = new Map([['qa-ephemeral', {kid: 'qa-ephemeral', alg: 'RS256', key: publicKey}]]);
  v.ready = true;
  v.refreshKeys = async () => {};
  return v;
}
async function expectRole(claims, role) {
  const r = await verifier().verifyToken(token(claims));
  assert.equal(r.ok, true, JSON.stringify(r.ok ? r.payload.role : r.reason));
  assert.equal(r.payload.role, role);
}
async function expectDenied(claims, reason) {
  const r = await verifier().verifyToken(token(claims));
  assert.equal(r.ok, false, 'test must fail closed');
  assert.equal(r.reason, reason);
}

test('ATM merchant dual-audience token selects merchant, not unrelated client', async () => {
  await expectRole({aud: [CLIENT, MERCHANT, 'account']}, 'merchant');
});
test('dual-audience ATM without merchant role remains denied', async () => {
  await expectDenied({aud: [CLIENT, MERCHANT], realm_access: {roles: ['client']}}, 'merchant_role_missing');
});
test('merchant audience with unrelated azp is never a valid merchant principal', async () => {
  await expectDenied({aud: MERCHANT, azp: 'unrelated-app'}, 'authorized_party_mismatch');
});
test('merchant resource client-scoped role remains valid with allowed azp', async () => {
  await expectRole({realm_access: {roles: []}, resource_access: {[MERCHANT]: {roles: ['merchant']}}}, 'merchant');
});
test('realm delishafrica-merchant role is accepted for merchant client', async () => {
  await expectRole({azp: MERCHANT, realm_access: {roles: [MERCHANT]}}, 'merchant');
});
test('client may carry merchant audience without inheriting merchant access', async () => {
  await expectRole({aud: [MERCHANT, CLIENT], azp: CLIENT, realm_access: {roles: ['client']}}, 'client');
});
test('client with merchant audience and merchant role cannot claim merchant through client azp', async () => {
  await expectDenied({aud: [MERCHANT, CLIENT], azp: CLIENT, realm_access: {roles: ['merchant']}}, 'client_role_missing');
});
test('courier may carry merchant audience without inheriting merchant access', async () => {
  await expectRole({aud: [MERCHANT, COURIER], azp: COURIER, realm_access: {roles: ['courier']}}, 'courier');
});
test('courier azp with merchant role cannot borrow merchant permission', async () => {
  await expectDenied({aud: [MERCHANT, COURIER], azp: COURIER, realm_access: {roles: ['merchant']}}, 'courier_role_missing');
});
test('ops audience priority prevents fallthrough into merchant even for ATM azp', async () => {
  await expectDenied({aud: [OPS, MERCHANT], azp: ATM}, 'authorized_party_mismatch');
});
test('ATM client-only audience is never promoted to client principal', async () => {
  await expectDenied({aud: CLIENT, azp: ATM, realm_access: {roles: ['client']}}, 'audience_mismatch');
});
test('merchant audience without matching role remains denied', async () => {
  await expectDenied({realm_access: {roles: []}}, 'merchant_role_missing');
});
test('invalid signature remains denied even if claims look correct', async () => {
  const valid = token();
  const [header, payload, signature] = valid.split('.');
  const malformed = header + '.' + payload + '.' +
    (signature.startsWith('A') ? 'B' : 'A') + signature.slice(1);
  const r = await verifier().verifyToken(malformed);
  assert.deepEqual(r, {ok: false, reason: 'invalid_signature'});
});
