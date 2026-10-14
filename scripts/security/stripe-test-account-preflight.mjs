#!/usr/bin/env node
/**
 * DelishAfrica P0 - isolated, read-only Stripe TEST account identity preflight.
 *
 * No write requests, PaymentIntents, transfers or payouts. The script is NOT
 * connected to the deployed API. A live secret is always rejected.
 *
 * Required environment:
 *   STRIPE_EXPECTED_TEST_ACCOUNT_ID=acct_...
 *   STRIPE_EXPECTED_TEST_COUNTRY=LU
 *   STRIPE_SECRET_KEY=sk_test_... (or STRIPE_SECRET)
 *   STRIPE_PREFLIGHT_ALLOW_GET=1
 *
 * Any additional present Stripe alias must be identical. Never log keys.
 */
const EXIT = Object.freeze({
  OK: 0,
  BAD_CONFIG: 2,
  NOT_ALLOWED: 3,
  PROVIDER_ERROR: 4,
});

export async function preflight({ env = process.env, request = globalThis.fetch } = {}) {
  const expectedId = (env.STRIPE_EXPECTED_TEST_ACCOUNT_ID || '').trim();
  const expectedCountry = (env.STRIPE_EXPECTED_TEST_COUNTRY || '').trim();
  const primary = env.STRIPE_SECRET_KEY || env.STRIPE_SECRET || '';
  const aliases = ['STRIPE_SECRET_KEY', 'STRIPE_SECRET', 'STRIPE_API_KEY']
    .filter(name => Boolean(env[name]));

  if (!/^acct_[A-Za-z0-9]+$/.test(expectedId)) {
    return { code: EXIT.BAD_CONFIG, message: 'NO_GO_EXPECTED_ACCOUNT_ID_REQUIRED' };
  }
  if (!/^[A-Z]{2}$/.test(expectedCountry)) {
    return { code: EXIT.BAD_CONFIG, message: 'NO_GO_EXPECTED_COUNTRY_REQUIRED' };
  }
  if (env.STRIPE_PREFLIGHT_ALLOW_GET !== '1') {
    return { code: EXIT.NOT_ALLOWED, message: 'NO_GO_EXPLICIT_GET_OPT_IN_REQUIRED' };
  }
  if (!primary || !aliases.length) {
    return { code: EXIT.BAD_CONFIG, message: 'NO_GO_TEST_SECRET_MISSING' };
  }
  if (aliases.some(name => env[name] !== primary)) {
    return { code: EXIT.NOT_ALLOWED, message: 'NO_GO_STRIPE_KEY_ALIASES_DIFFER' };
  }
  if (!primary.startsWith('sk_test_')) {
    return { code: EXIT.NOT_ALLOWED, message: 'NO_GO_NOT_A_TEST_SECRET' };
  }

  try {
    const response = await request('https://api.stripe.com/v1/account', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${primary}`,
        'User-Agent': 'DelishAfrica-P0-Stripe-Test-Preflight/1.1',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return {
        code: EXIT.PROVIDER_ERROR,
        message: 'NO_GO_ACCOUNT_LOOKUP_HTTP_' + (
          Number.isInteger(response.status) ? response.status : 'UNKNOWN'
        ),
      };
    }
    const account = await response.json();
    if (account?.livemode === true) {
      return { code: EXIT.NOT_ALLOWED, message: 'NO_GO_ACCOUNT_LIVE_MODE' };
    }
    if (account?.id !== expectedId) {
      return { code: EXIT.NOT_ALLOWED, message: 'NO_GO_ACCOUNT_ID_MISMATCH' };
    }
    if (account?.country !== expectedCountry) {
      return { code: EXIT.NOT_ALLOWED, message: 'NO_GO_ACCOUNT_COUNTRY_MISMATCH' };
    }
    return { code: EXIT.OK, message: 'PASS_TEST_ACCOUNT_ID_AND_COUNTRY_MATCH' };
  } catch {
    return { code: EXIT.PROVIDER_ERROR, message: 'NO_GO_ACCOUNT_LOOKUP_FAILED' };
  }
}

// Direct execution only. No implicit network request on import.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const result = await preflight();
  console.log(result.message);
  process.exitCode = result.code;
}
