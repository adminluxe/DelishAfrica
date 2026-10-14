import test from 'node:test';
import assert from 'node:assert/strict';
import { preflight } from '../scripts/security/stripe-test-account-preflight.mjs';
const expected = 'acct_TEST123';
const secret = 'sk_test_example_not_real';
const env = { STRIPE_EXPECTED_TEST_ACCOUNT_ID: expected, STRIPE_SECRET_KEY: secret };
const ok = (account = { id: expected, livemode: false }) => async () => ({ ok: true, status: 200, json: async () => account });
test('allows only matching test account', async () => {
  const r = await preflight({ env, request: ok() });
  assert.equal(r.code, 0);
  assert.equal(r.message, 'PASS_TEST_ACCOUNT_ID_MATCH');
});
test('fails closed on missing expected account', async () => {
  assert.equal((await preflight({ env: { STRIPE_SECRET_KEY: secret }, request: ok() })).code, 2);
});
test('fails closed on unexpected account', async () => {
  assert.equal((await preflight({ env, request: ok({ id: 'acct_OTHER', livemode: false }) })).code, 3);
});
test('rejects live secret before any request', async () => {
  let called = false;
  const r = await preflight({ env: { ...env, STRIPE_SECRET_KEY: 'sk_live_example' }, request: async () => { called = true; return ok()(); } });
  assert.equal(r.code, 3);
  assert.equal(called, false);
});
test('rejects conflicting runtime aliases', async () => {
  const r = await preflight({ env: { ...env, STRIPE_SECRET: 'sk_test_other' }, request: ok() });
  assert.equal(r.code, 3);
});
test('rejects account returned as live', async () => {
  assert.equal((await preflight({ env, request: ok({ id: expected, livemode: true }) })).code, 3);
});
test('provider error and network failure fail closed', async () => {
  assert.equal((await preflight({ env, request: async () => ({ ok: false, status: 403 }) })).code, 4);
  assert.equal((await preflight({ env, request: async () => { throw new Error('network'); } })).code, 4);
});
