import test from 'node:test';
import assert from 'node:assert/strict';
import { preflight } from '../scripts/security/stripe-test-account-preflight.mjs';

// All credentials and account IDs below are fake. Network is always stubbed.
const expected = 'acct_TEST123';
const secret = 'sk_test_example_not_real';
const env = {
  STRIPE_EXPECTED_TEST_ACCOUNT_ID: expected,
  STRIPE_EXPECTED_TEST_COUNTRY: 'LU',
  STRIPE_PREFLIGHT_ALLOW_GET: '1',
  STRIPE_SECRET_KEY: secret,
};

const responder = (account = { id: expected, country: 'LU', livemode: false }) =>
  async () => ({ ok: true, status: 200, json: async () => account });

test('accepts matching TEST account and country with GET only', async () => {
  let requests = 0;
  const result = await preflight({
    env,
    request: async (url, options) => {
      requests += 1;
      assert.equal(url, 'https://api.stripe.com/v1/account');
      assert.equal(options.method, 'GET');
      return responder()();
    },
  });
  assert.equal(requests, 1);
  assert.equal(result.code, 0);
  assert.equal(result.message, 'PASS_TEST_ACCOUNT_ID_AND_COUNTRY_MATCH');
});

test('requires configured expected account ID before network', async () => {
  let called = false;
  const result = await preflight({
    env: { ...env, STRIPE_EXPECTED_TEST_ACCOUNT_ID: '' },
    request: async () => { called = true; return responder()(); },
  });
  assert.equal(result.code, 2);
  assert.equal(called, false);
});

test('requires configured expected country before network', async () => {
  let called = false;
  const result = await preflight({
    env: { ...env, STRIPE_EXPECTED_TEST_COUNTRY: '' },
    request: async () => { called = true; return responder()(); },
  });
  assert.equal(result.code, 2);
  assert.equal(called, false);
});

test('requires explicit opt-in before network, even for fake TEST secret', async () => {
  let called = false;
  const result = await preflight({
    env: { ...env, STRIPE_PREFLIGHT_ALLOW_GET: '' },
    request: async () => { called = true; return responder()(); },
  });
  assert.equal(result.code, 3);
  assert.equal(called, false);
});

test('refuses live key without invoking Stripe', async () => {
  let called = false;
  const result = await preflight({
    env: { ...env, STRIPE_SECRET_KEY: 'sk_live_example' },
    request: async () => { called = true; return responder()(); },
  });
  assert.equal(result.code, 3);
  assert.equal(called, false);
});

test('refuses mismatched key aliases', async () => {
  const result = await preflight({
    env: { ...env, STRIPE_API_KEY: 'sk_test_another_fake' },
    request: responder(),
  });
  assert.equal(result.code, 3);
  assert.equal(result.message, 'NO_GO_STRIPE_KEY_ALIASES_DIFFER');
});

test('refuses no TEST secret', async () => {
  assert.equal((await preflight({
    env: { ...env, STRIPE_SECRET_KEY: '' },
    request: responder(),
  })).code, 2);
});

test('refuses a different Stripe account', async () => {
  const result = await preflight({
    env,
    request: responder({ id: 'acct_OTHER', country: 'LU', livemode: false }),
  });
  assert.equal(result.code, 3);
  assert.equal(result.message, 'NO_GO_ACCOUNT_ID_MISMATCH');
});

test('refuses a matching Stripe account with different country', async () => {
  const result = await preflight({
    env,
    request: responder({ id: expected, country: 'BE', livemode: false }),
  });
  assert.equal(result.code, 3);
  assert.equal(result.message, 'NO_GO_ACCOUNT_COUNTRY_MISMATCH');
});

test('refuses account unexpectedly flagged live', async () => {
  const result = await preflight({
    env,
    request: responder({ id: expected, country: 'LU', livemode: true }),
  });
  assert.equal(result.code, 3);
});

test('fails closed for HTTP failure, invalid JSON and network errors', async () => {
  assert.equal((await preflight({
    env, request: async () => ({ ok: false, status: 403 }),
  })).code, 4);
  assert.equal((await preflight({
    env, request: async () => ({ ok: true, json: async () => { throw new Error('invalid'); } }),
  })).code, 4);
  assert.equal((await preflight({
    env, request: async () => { throw new Error('network'); },
  })).code, 4);
});
