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
const {
  ClientEnrollmentService,
} = require('../src/client-enrollment/client-enrollment.service');

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

test('even fully populated enrollment env fails closed without recovery or scoped authorization approval', () => {
  const env = {
    DATABASE_URL: 'postgres://unused',
    DA_CLIENT_ENROLLMENT_ENABLED: 'true',
    DA_CLIENT_ENROLLMENT_HMAC_SECRET: 'x'.repeat(48),
    DA_CLIENT_ENROLLMENT_KC_BASE_URL: 'http://afritaste-keycloak:8080/',
    DA_CLIENT_ENROLLMENT_KC_CLIENT_ID: 'delishafrica-client-enrollment',
    DA_CLIENT_ENROLLMENT_KC_CLIENT_SECRET: 'test-only-service-credential',
    DA_CLIENT_ENROLLMENT_SECURITY_GATE: 'APPROVED_AFTER_REVIEW',
    DA_CLIENT_ENROLLMENT_RECOVERY_GATE: 'SMTP_RESET_TESTED',
    DA_CLIENT_ENROLLMENT_AUTHZ_GATE: 'FGAP_NEGATIVE_TESTS_PASSED',
  };
  assert.equal(enrollmentReadyForProduction(env), true, 'all manually audited gates required');
  for (const key of ['DA_CLIENT_ENROLLMENT_RECOVERY_GATE', 'DA_CLIENT_ENROLLMENT_AUTHZ_GATE']) {
    assert.equal(enrollmentReadyForProduction({ ...env, [key]: undefined }), false, key + ' may not be missing');
    assert.equal(enrollmentReadyForProduction({ ...env, [key]: 'false' }), false, key + ' must be exact');
  }
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

function syntheticServiceToken(roles = []) {
  const encode = (object) => Buffer.from(JSON.stringify(object)).toString('base64url');
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    azp: 'delishafrica-client-enrollment',
    resource_access: roles.length ? { 'realm-management': { roles } } : {},
    realm_access: { roles: [] },
  };
  // JWT-shaped fixture only; no real signature, external identity or secret.
  return encode(header) + '.' + encode(claims) + '.synthetic';
}
const safeServiceToken = syntheticServiceToken();

const oid = '1a8884fa-b68d-4b2f-88f3-a56d8e4aa21d';
const role = { id: '5c526e44-0223-4db0-a1b5-f18051f4f1b8', name: 'client', clientRole: false };
const identity = {
  email: 'test@example.org',
  phone: '+32470000000',
  firstName: 'Essai',
  lastName: 'Client',
  password: 'UnePhraseTresLongue#4',
};


test('service rejects broad manage-users and realm-admin grants before ANY provisioning API call', async () => {
  for (const dangerous of ['manage-users', 'realm-admin', 'manage-realm']) {
    let adminRequests = 0;
    await withKeycloakMock(async (url) => {
      const path = new URL(url).pathname;
      if (path.endsWith('/protocol/openid-connect/token')) {
        return response(200, { access_token: syntheticServiceToken([dangerous]) });
      }
      adminRequests += 1;
      throw new Error('UNEXPECTED_ADMIN_API_CALL');
    }, async () => {
      await assert.rejects(
        new ClientEnrollmentKeycloak().createClientIdentity(identity),
        /enrollment_broad_keycloak_admin_token_forbidden/,
      );
    });
    assert.equal(adminRequests, 0, dangerous + ' must be refused before accessing the Keycloak Admin API');
  }
});

test('Keycloak provisioning stages only a DISABLED Client realm-role identity', async () => {
  const captured = [];
  await withKeycloakMock(async (url, options = {}) => {
    const path = new URL(url).pathname;
    captured.push({ path, method: options.method || 'GET', body: options.body });
    if (path.endsWith('/protocol/openid-connect/token')) {
      return response(200, { access_token: safeServiceToken });
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
    if (path.endsWith('/role-mappings/realm/composite')) return response(200, [role]);
    if (path.endsWith('/role-mappings/realm')) return response(200, [role]);
    if (path.endsWith('/users/' + oid) && options.method === 'PUT') {
      throw new Error('NO_ENABLE_DURING_PROVISIONING');
    }
    throw new Error('unexpected_fetch_path');
  }, async () => {
    const id = await new ClientEnrollmentKeycloak().createClientIdentity(identity);
    assert.equal(id, oid);
  });
  assert.equal(captured.filter((call) => call.method === 'POST' && call.path.endsWith('/users')).length, 1);
  assert.equal(captured.some((call) => call.method === 'PUT'), false,
    'a newly staged identity MUST remain disabled until the DB ledger commits');
});

test('mismatched role grants never produce a Client identity', async () => {
  const created = [];
  await withKeycloakMock(async (url, options = {}) => {
    const path = new URL(url).pathname;
    created.push(path);
    if (path.endsWith('/protocol/openid-connect/token')) return response(200, { access_token: safeServiceToken });
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
    if (path.endsWith('/protocol/openid-connect/token')) return response(200, { access_token: safeServiceToken });
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


test('Keycloak activation revalidates effective Client-only roles, provenance and enabled state', async () => {
  const calls = [];
  let userEnabled = false;
  await withKeycloakMock(async (url, options = {}) => {
    const path = new URL(url).pathname;
    const method = options.method || 'GET';
    calls.push(method + ' ' + path);
    if (path.endsWith('/protocol/openid-connect/token')) return response(200, { access_token: safeServiceToken });
    if (path.endsWith('/role-mappings/realm/composite')) return response(200, [role]);
    if (path.endsWith('/role-mappings/realm')) return response(200, [role]);
    if (path.endsWith('/users/' + oid) && method === 'PUT') {
      assert.deepEqual(JSON.parse(options.body), { enabled: true });
      userEnabled = true;
      return response(204, null);
    }
    if (path.endsWith('/users/' + oid) && method === 'GET') {
      return response(200, {
        enabled: userEnabled,
        emailVerified: true,
        attributes: { delishafrica_enrollment_version: ['client-v1'] },
      });
    }
    throw new Error('unexpected_fetch');
  }, async () => {
    await new ClientEnrollmentKeycloak().activateClientIdentity(oid);
  });
  const idxRoles = calls.findIndex((x) => x.includes('/role-mappings/realm'));
  const idxEnable = calls.findIndex((x) => x.startsWith('PUT ') && x.endsWith('/users/' + oid));
  const idxIdentityBefore = calls.findIndex((x) => x.startsWith('GET ') && x.endsWith('/users/' + oid));
  const idxConfirm = calls.findLastIndex((x) => x.startsWith('GET ') && x.endsWith('/users/' + oid));
  assert(idxRoles >= 0 && idxIdentityBefore > idxRoles && idxEnable > idxIdentityBefore && idxConfirm > idxEnable);
});


test('composite Merchant privilege is rejected even when direct role claims say Client', async () => {
  let activated = false;
  await withKeycloakMock(async (url, options = {}) => {
    const route = new URL(url).pathname;
    const method = options.method || 'GET';
    if (route.endsWith('/protocol/openid-connect/token')) return response(200, { access_token: safeServiceToken });
    if (route.endsWith('/role-mappings/realm/composite')) {
      return response(200, [role, { name: 'merchant', clientRole: false }]);
    }
    if (route.endsWith('/role-mappings/realm')) return response(200, [role]);
    if (method === 'PUT') activated = true;
    throw new Error('not_expected');
  }, async () => {
    await assert.rejects(
      new ClientEnrollmentKeycloak().activateClientIdentity(oid),
      /enrollment_effective_roles_unsafe/,
    );
  });
  assert.equal(activated, false, 'composite Merchant authority blocks activation');
});

test('identity without Client onboarding provenance cannot be enabled', async () => {
  let activated = false;
  await withKeycloakMock(async (url, options = {}) => {
    const route = new URL(url).pathname;
    const method = options.method || 'GET';
    if (route.endsWith('/protocol/openid-connect/token')) return response(200, { access_token: safeServiceToken });
    if (route.endsWith('/role-mappings/realm/composite')) return response(200, [role]);
    if (route.endsWith('/role-mappings/realm')) return response(200, [role]);
    if (route.endsWith('/users/' + oid) && method === 'GET') return response(200, {
      enabled: false, emailVerified: true, attributes: { delishafrica_enrollment_version: ['unknown'] },
    });
    if (method === 'PUT') activated = true;
    throw new Error('not_expected');
  }, async () => {
    await assert.rejects(new ClientEnrollmentKeycloak().activateClientIdentity(oid),
      /enrollment_identity_provenance_unsafe/);
  });
  assert.equal(activated, false);
});

async function withEnrollmentFlags(run) {
  const values = {
    DATABASE_URL: 'postgres://unused-test-only',
    DA_CLIENT_ENROLLMENT_ENABLED: 'true',
    DA_CLIENT_ENROLLMENT_HMAC_SECRET: 'h'.repeat(48),
    DA_CLIENT_ENROLLMENT_KC_BASE_URL: 'http://afritaste-keycloak:8080/',
    DA_CLIENT_ENROLLMENT_KC_CLIENT_ID: 'delishafrica-client-enrollment',
    DA_CLIENT_ENROLLMENT_KC_CLIENT_SECRET: 'test-only-service-credential',
    DA_CLIENT_ENROLLMENT_SECURITY_GATE: 'APPROVED_AFTER_REVIEW',
    DA_CLIENT_ENROLLMENT_RECOVERY_GATE: 'SMTP_RESET_TESTED',
    DA_CLIENT_ENROLLMENT_AUTHZ_GATE: 'FGAP_NEGATIVE_TESTS_PASSED',
  };
  const old = Object.fromEntries(Object.keys(values).map((k) => [k, process.env[k]]));
  Object.assign(process.env, values);
  try { await run(); }
  finally {
    for (const [k,v] of Object.entries(old)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test('one Client registration durably commits BEFORE activating the new identity', async () => {
  await withEnrollmentFlags(async () => {
    const order = [];
    const proof = { attest: () => ({ valid: true }) };
    const repo = {
      reserve: async () => { order.push('reserved'); return oid; },
      complete: async () => { order.push('ledger_ready'); },
      flagForReview: async () => { order.push('review'); },
    };
    const kc = {
      createClientIdentity: async () => { order.push('staged_disabled'); return oid; },
      activateClientIdentity: async () => { order.push('activated'); },
      disableClientIdentity: async () => { order.push('disabled'); },
    };
    const output = await new ClientEnrollmentService(proof, repo, kc).register(valid, 'test-client');
    assert.equal(output.status, 'account_created');
    assert.equal(output.paymentStarted, false);
    assert.deepEqual(order, ['reserved','staged_disabled','ledger_ready','activated']);
  });
});

test('when DB commit fails, the Keycloak user NEVER activates and is disabled', async () => {
  await withEnrollmentFlags(async () => {
    const order = [];
    const proof = { attest: () => ({ valid: true }) };
    const repo = {
      reserve: async () => { order.push('reserved'); return oid; },
      complete: async () => { order.push('db_error'); throw new Error('simulated_db_commit_failure'); },
      flagForReview: async () => { order.push('review'); },
    };
    const kc = {
      createClientIdentity: async () => { order.push('staged_disabled'); return oid; },
      activateClientIdentity: async () => { order.push('BUG_ACTIVATED'); },
      disableClientIdentity: async () => { order.push('disabled'); },
    };
    await assert.rejects(
      new ClientEnrollmentService(proof, repo, kc).register(valid, 'test-client'),
      /Service Unavailable|ServiceUnavailableException|503|client_enrollment_pending_review/,
    );
    assert.deepEqual(order, ['reserved','staged_disabled','db_error','disabled','review']);
  });
});

test('failed activation compensates and quarantines even after a successful DB commit', async () => {
  await withEnrollmentFlags(async () => {
    const order = [];
    const proof = { attest: () => ({ valid: true }) };
    const repo = {
      reserve: async () => { order.push('reserved'); return oid; },
      complete: async () => { order.push('ledger_ready'); },
      flagForReview: async () => { order.push('review'); },
    };
    const kc = {
      createClientIdentity: async () => { order.push('staged_disabled'); return oid; },
      activateClientIdentity: async () => { order.push('activation_error'); throw new Error('simulated_keycloak_outage'); },
      disableClientIdentity: async () => { order.push('disabled'); },
    };
    await assert.rejects(new ClientEnrollmentService(proof, repo, kc).register(valid,'test-client'));
    assert.deepEqual(order,['reserved','staged_disabled','ledger_ready','activation_error','disabled','review']);
  });
});


test('six concurrent distinct Client reservations share one trusted-origin quota', async () => {
  const { ClientEnrollmentRepository } = require('../src/client-enrollment/client-enrollment.repository');
  const lockTails = new Map();
  const committed = [];
  let sequence = 0;
  const repo = new ClientEnrollmentRepository();
  // Isolated transaction-aware PG fake: each advisory lock is held until COMMIT/ROLLBACK.
  // No database, Keycloak, payment service or live endpoint is contacted.
  repo.connection = () => ({
    connect: async () => {
      const tx = { pending: null, releases: [] };
      return {
        query: async (sql, params = []) => {
          if (sql === 'BEGIN') return { rows: [], rowCount: 0 };
          if (sql.startsWith('SELECT pg_advisory_xact_lock')) {
            const key = params[0];
            const previous = lockTails.get(key) || Promise.resolve();
            let release;
            const held = new Promise((resolve) => { release = resolve; });
            lockTails.set(key, previous.then(() => held));
            await previous;
            tx.releases.push(release);
            return { rows: [], rowCount: 1 };
          }
          if (sql.includes('SELECT count(*)::text')) {
            return {
              rows: [{ total: String(committed.filter((x) => x.origin === params[0]).length) }],
              rowCount: 1,
            };
          }
          if (sql.startsWith('INSERT INTO')) {
            tx.pending = { origin: params[2] };
            return { rows: [{ enrollment_id: 'qa-' + (++sequence) }], rowCount: 1 };
          }
          if (sql === 'COMMIT' || sql === 'ROLLBACK') {
            if (sql === 'COMMIT' && tx.pending) committed.push(tx.pending);
            tx.pending = null;
            for (const release of tx.releases.splice(0)) release();
            return { rows: [], rowCount: 0 };
          }
          throw new Error('unexpected_mock_sql');
        },
        release: () => undefined,
      };
    },
  });
  const requesterHash = 'r'.repeat(64);
  const requests = Array.from({ length: 6 }, (_, i) => {
    const unique = String(i).padStart(64, '0');
    return {
      requesterHash,
      emailHash: unique,
      phoneHash: unique,
      requestHash: unique,
      emailProofHash: unique,
      smsProofHash: unique,
    };
  });
  const results = await Promise.allSettled(requests.map((request) => repo.reserve(request)));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 5);
  assert.equal(results.filter((r) => r.status === 'rejected' &&
    r.reason?.message === 'client_enrollment_rate_limit').length, 1);
  assert.equal(committed.length, 5);
});
