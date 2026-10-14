#!/usr/bin/env node
// P0 Stripe test account identity preflight. Read-only: GET /v1/account only.
// No secrets, keys, customer data or payment objects are logged.
const EXIT = { OK: 0, BAD_CONFIG: 2, NOT_ALLOWED: 3, PROVIDER_ERROR: 4 };
export async function preflight({ env = process.env, request = globalThis.fetch } = {}) {
  const expected = (env.STRIPE_EXPECTED_TEST_ACCOUNT_ID || '').trim();
  const secret = env.STRIPE_SECRET_KEY || env.STRIPE_SECRET || '';
  const aliases = ['STRIPE_SECRET_KEY', 'STRIPE_SECRET', 'STRIPE_API_KEY'].filter(k => Boolean(env[k]));
  if (!/^acct_[A-Za-z0-9]+$/.test(expected)) {
    return { code: EXIT.BAD_CONFIG, message: 'NO_GO_EXPECTED_ACCOUNT_ID_REQUIRED' };
  }
  if (!aliases.length || !secret) {
    return { code: EXIT.BAD_CONFIG, message: 'NO_GO_TEST_SECRET_MISSING' };
  }
  if (aliases.some(k => env[k] !== secret)) {
    return { code: EXIT.NOT_ALLOWED, message: 'NO_GO_STRIPE_KEY_ALIASES_DIFFER' };
  }
  if (!secret.startsWith('sk_test_')) {
    return { code: EXIT.NOT_ALLOWED, message: 'NO_GO_NOT_A_TEST_SECRET' };
  }
  try {
    const response = await request('https://api.stripe.com/v1/account', {
      method: 'GET',
      headers: { Authorization: `Bearer ${secret}`, 'User-Agent': 'DelishAfrica-P0-Stripe-Test-Preflight/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      return { code: EXIT.PROVIDER_ERROR, message: `NO_GO_ACCOUNT_LOOKUP_HTTP_${response.status}` };
    }
    const account = await response.json();
    if (!account?.id || account.id !== expected) {
      return { code: EXIT.NOT_ALLOWED, message: 'NO_GO_ACCOUNT_ID_MISMATCH' };
    }
    if (account.livemode === true) {
      return { code: EXIT.NOT_ALLOWED, message: 'NO_GO_ACCOUNT_LIVE_MODE' };
    }
    return { code: EXIT.OK, message: 'PASS_TEST_ACCOUNT_ID_MATCH' };
  } catch {
    return { code: EXIT.PROVIDER_ERROR, message: 'NO_GO_ACCOUNT_LOOKUP_FAILED' };
  }
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const result = await preflight();
  console.log(result.message);
  process.exitCode = result.code;
}
