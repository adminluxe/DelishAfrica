/* Security regression tests for Client-only onboarding. Network calls are mocked. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  parseClientEnrollmentCommand,
  enrollmentHmac,
  enrollmentReadyForProduction,
} = require('../src/client-enrollment/client-enrollment.policy');
const {
  ClientEnrollmentKeycloak,
} = require('../src/client-enrollment/client-enrollment.keycloak');

const valid = {
  email: '  TEST@Example.Org ',
  phone: '+32 470 00 00 00',
  firstName: 'Essai',
  lastName: 'Client',
  password: 'UnePhraseTresLongue#4',
  emailProofToken: 'a'.repeat(36) + '.' + 'b'.repeat(43),
  smsProofToken: 'c'.repeat(36) + '.' + 'd'.repeat(43),
  requestId: '18e5265a-aaf0-4ceb-a585-43c4f79eab11',
  acceptTerms: true,
};

test('server accepts only a fully specified, consenting Client request', () => {
  const parsed = parseClientEnrollmentCommand(valid);
  assert.equal(parsed.email, 'test@example.org');
  assert.equal(parsed.phone, '+32470000000');
  assert.equal(parsed.password, valid.password);
  assert.equal(parseClientEnrollmentCommand({ ...valid, acceptTerms: false }), null);
  assert.equal(parseClientEnrollmentCommand({ ...valid, password: 'welcome' }), null);
  assert.equal(parseClientEnrollmentCommand({ ...valid, phone: '1234' }), null);
  assert.equal(parseClientEnrollmentCommand({ ...valid, smsProofToken: '' }), null);
  assert.equal(parseClientEnrollmentCommand({ ...valid, requestId: 'same-request' }), null);
});

test('identifiers use purpose-separated keyed HMAC and require a secure secret', () => {
  const key = 'x'.repeat(48);
  const a = enrollmentHmac(key, 'email', 'test@example.org');
  const b = enrollmentHmac(key, 'phone', 'test@example.org');
  assert.notEqual(a, b);
  assert.equal(a.length, 64);
  assert.equal(a, enrollmentHmac(key, 'email', 'test@example.org'));
  assert.throws(() => enrollmentHmac('weak', 'email', 'test@example.org'));
});

test('feature always fails closed unless all review gates are explicitly set', () => {
  assert.equal(enrollmentReadyForProduction({}), false);
  assert.equal(enrollmentReadyForProduction({
    DA_CLIENT_ENROLLMENT_ENABLED: 'true',
    DATABASE_URL: 'postgres://unused',
    DA_CLIENT_ENROLLMENT_HMAC_SECRET: 'x'.repeat(48),
    DA_CLIENT_ENROLLMENT_KC_BASE_URL: 'http://afritaste-keycloak:8080/',
    DA_CLIENT_ENROLLMENT_KC_CLIENT_ID: 'delishafrica-client-enrollment',
    DA_CLIENT_ENROLLMENT_KC_CLIENT_SECRET: 'secret',
  }), false);
});

function response(status, data, location) {
  return {
    status,
    headers: { get: (name) => name === 'location' ? (location || null) : null },
    json: async () => data,
  };
}

async function withKeycloakMock(stub, run) {
  const beforeFetch = globalThis.fetch;
  const keys = [
    'DA_CLIENT_ENROLLMENT_KC_BASE_URL',
    'DA_CLIENT_ENROLLMENT_KC_CLIENT_ID',
    'DA_CLIENT_ENROLLMENT_KC_CLIENT_SECRET',
  ];
  const old = keys.map((key) => process.env[key]);
  process.env.DA_CLIENT_ENROLLMENT_KC_BASE_URL = 'http://afritaste-keycloak:8080/';
  process.env.DA_CLIENT_ENROLLMENT_KC_CLIENT_ID = 'delishafrica-client-enrollment';
  process.env.DA_CLIENT_ENROLLMENT_KC_CLIENT_SECRET = 'test-only-service-credential';
  globalThis.fetch = stub;
  try { await run(); }
  finally {
    globalThis.fetch = beforeFetch;
    keys.forEach((key, i) => {
      if (old[i] === undefined) delete process.env[key];
      else process.env[key] = old[i];
    });
  }
}

const oid = '1a8884fa-b68d-4b2f-88f3-a56d8e4aa21d';
const role = { id: '5c526e44-0223-4db0-a1b5-f18051f4f1b8', name: 'client', clientRole: false };
const identity = {
  email: 'test@example.org',
  phone: '+32470000000',
  firstName: 'Essai',
  lastName: 'Client',
  password: 'UnePhraseTresLongue#4',
};

test('Keycloak provisioning creates ONLY a Client realm-role identity', async () => {
  const captured = [];
  await withKeycloakMock(async (url, options = {}) => {
    const path = new URL(url).pathname;
    captured.push({ path, method: options.method || 'GET', body: options.body });
    if (path.endsWith('/protocol/openid-connect/token')) {
      return response(200, { access_token: 'a'.repeat(40) });
    }
    if (path.endsWith('/roles/client')) return response(200, role);
    if (path.endsWith('/users') && options.method === 'POST') {
      const payload = JSON.parse(options.body);
      assert.equal(payload.emailVerified, true);
      assert.equal(payload.enabled, false, 'new identities MUST start disabled');
      assert.deepEqual(payload.requiredActions, []);
      assert.deepEqual(payload.credentials.map((r) => r.type), ['password']);
      assert.deepEqual(payload.attributes.delishafrica_enrollment_version, ['client-v1']);
      assert.equal(payload.credentials[0].value, identity.password);
      return response(201, null, 'http://afritaste-keycloak:8080/admin/realms/afritaste/users/' + oid);
    }
    if (path.endsWith('/role-mappings/realm') && options.method === 'POST') {
      assert.deepEqual(JSON.parse(options.body).map((r) => r.name), ['client']);
      return response(204, null);
    }
    if (path.endsWith('/role-mappings/realm')) return response(200, [role]);
    if (path.endsWith('/users/' + oid) && options.method === 'PUT') {
      assert.equal(JSON.parse(options.body).enabled, true);
      return response(204, null);
    }
    throw new Error('unexpected_fetch_path');
  }, async () => {
    const id = await new ClientEnrollmentKeycloak().createClientIdentity(identity);
    assert.equal(id, oid);
  });
  assert.equal(captured.filter((call) => call.method === 'POST' && call.path.endsWith('/users')).length, 1);
  assert.equal(captured.at(-1).method, 'PUT', 'activation MUST happen after role re-check');
});

test('mismatched role grants never produce a Client identity', async () => {
  const created = [];
  await withKeycloakMock(async (url, options = {}) => {
    const path = new URL(url).pathname;
    created.push(path);
    if (path.endsWith('/protocol/openid-connect/token')) return response(200, { access_token: 'a'.repeat(40) });
    if (path.endsWith('/roles/client')) return response(200, { ...role, clientRole: true });
    throw new Error('unreachable');
  }, async () => {
    await assert.rejects(
      new ClientEnrollmentKeycloak().createClientIdentity(identity),
      /enrollment_client_role_misconfigured/,
    );
  });
  assert(!created.some((p) => p.endsWith('/users')));
});

test('mapping failures fail closed and disable the newly created account', async () => {
  let disabled = false;
  await withKeycloakMock(async (url, options = {}) => {
    const path = new URL(url).pathname;
    if (path.endsWith('/protocol/openid-connect/token')) return response(200, { access_token: 'a'.repeat(40) });
    if (path.endsWith('/roles/client')) return response(200, role);
    if (path.endsWith('/users') && options.method === 'POST') {
      return response(201, null, 'http://afritaste-keycloak:8080/admin/realms/afritaste/users/' + oid);
    }
    if (path.endsWith('/role-mappings/realm') && options.method === 'POST') return response(500, {});
    if (path.endsWith('/users/' + oid) && options.method === 'PUT') {
      disabled = JSON.parse(options.body).enabled === false;
      return response(204, null);
    }
    throw new Error('unexpected_fetch');
  }, async () => {
    await assert.rejects(
      new ClientEnrollmentKeycloak().createClientIdentity(identity),
      /enrollment_realm_role_mapping_failed/,
    );
  });
  assert.equal(disabled, true);
});

test('non-private Admin API host is rejected before any token request', async () => {
  let calls = 0;
  await withKeycloakMock(async () => { calls++; throw new Error('network_called'); }, async () => {
    process.env.DA_CLIENT_ENROLLMENT_KC_BASE_URL = 'https://attacker.example.org/';
    await assert.rejects(
      new ClientEnrollmentKeycloak().createClientIdentity(identity),
      /enrollment_keycloak_endpoint_not_private/,
    );
    assert.equal(calls, 0);
  });
});
