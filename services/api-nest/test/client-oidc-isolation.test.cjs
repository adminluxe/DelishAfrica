'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { validateClientTokenIsolation } = require('../src/auth/client-token-isolation');

const audience = 'delishafrica-client';
const validClaims = {
  aud: ['account', audience],
  realm_access: {
    roles: ['default-roles-afritaste', 'client', 'offline_access', 'uma_authorization'],
  },
  resource_access: {
    account: { roles: ['view-profile', 'manage-account', 'manage-account-links'] },
  },
};

test('a signed Client-only claims object with normal account self-service roles is isolated', () => {
  assert.equal(validateClientTokenIsolation(validClaims, audience), null);
  assert.equal(validateClientTokenIsolation({
    aud: audience,
    realm_access: { roles: ['client'] },
  }, audience), null);
});

test('additional Merchant, Courier, Ops or administration realm roles fail closed', () => {
  for (const other of ['merchant', 'courier', 'ops', 'admin', 'realm-admin', 'manage-users', 'view-users']) {
    const claims = {
      ...validClaims,
      realm_access: { roles: [...validClaims.realm_access.roles, other] },
    };
    assert.equal(validateClientTokenIsolation(claims, audience),
      'client_role_ambiguous', other);
  }
});

test('a missing, malformed or non-Client realm role claim is rejected', () => {
  for (const roles of [undefined, ['merchant'], [], ['client', 4], 'client']) {
    const claims = { ...validClaims, realm_access: { roles } };
    assert.equal(validateClientTokenIsolation(claims, audience), 'client_role_missing');
  }
});

test('cross-product audiences cannot be used as a Client identity', () => {
  for (const aud of [
    ['account', audience, 'delishafrica-courier'],
    [audience, 'delishafrica-master-dashboard'],
    [audience, 'delishafrica-merchant'],
    ['account'],
    [audience, 5],
  ]) {
    assert.equal(validateClientTokenIsolation({ ...validClaims, aud }, audience),
      'client_audience_ambiguous');
  }
});

test('realm-management and other client-role mappings must be empty', () => {
  for (const [client, grantedRole] of [
    ['realm-management', 'manage-users'],
    ['realm-management', 'view-realm'],
    ['delishafrica-courier', 'courier'],
    ['delishafrica-merchant', 'merchant'],
    ['delishafrica-master-dashboard', 'ops'],
    ['custom-role-client', 'admin'],
  ]) {
    const claims = {
      ...validClaims,
      resource_access: { ...validClaims.resource_access, [client]: { roles: [grantedRole] } },
    };
    assert.equal(validateClientTokenIsolation(claims, audience),
      'client_client_privilege_detected', client);
  }
});

test('invalid resource_access grants never bypass verification', () => {
  for (const value of [null, 'yes', ['realm-management'], { 'realm-management': { roles: true } }]) {
    assert.equal(validateClientTokenIsolation({ ...validClaims, resource_access: value }, audience),
      'client_client_privilege_detected');
  }
});

test('the production JWT verifier calls Client isolation only AFTER signature validation', () => {
  const source = readFileSync('services/api-nest/src/auth/external-jwks-verifier.service.ts', 'utf8');
  const signature = source.indexOf("const verified = crypto.verify(");
  const isolation = source.indexOf('validateClientTokenIsolation(claims, CLIENT_AUDIENCE)');
  assert(signature >= 0 && isolation > signature,
    'cross-role check must be an additional authorization gate on a cryptographically verified token');
  assert(source.includes("if (externalRole === 'client')"));
});
