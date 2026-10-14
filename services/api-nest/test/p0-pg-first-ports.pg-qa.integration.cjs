'use strict';
/**
 * P0 PostgreSQL-first composition contract, disconnected GitHub QA only.
 * Actual compiled TypeScript adapters + real PostgreSQL 17, fake provider.
 * No Keycloak, no external network, no paid provider, no VPS or Store.
 * NativeClientNestCommerceGuard and two-phase HTTP were certified separately;
 * do not mistake this ports-level suite for an OIDC admission E2E.
 */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createHash } = require('node:crypto');
const { Pool } = require('pg');
const { createQaPgFirstCheckoutPorts } =
  require('/qa-built/native-client-checkout-pg-first.qa.ports.js');

if (process.env.GITHUB_ACTIONS !== 'true' ||
    process.env.QA_SYNTHETIC_ONLY !== 'YES' ||
    process.env.DA_QA_ISOLATED_CLIENT_COMMERCE_ENABLED !== 'YES' ||
    process.env.NODE_ENV === 'production' ||
    process.env.QA_COMMERCE_DB_HOST !== '127.0.0.1' ||
    process.env.QA_COMMERCE_DB_NAME !== 'postgres' ||
    !/^[0-9a-f]{64}$/.test(process.env.QA_COMMERCE_HMAC_KEY || '')) {
  throw Error('P0_PG_FIRST_DISCONNECTED_CI_ONLY');
}

const db = user => new Pool({
  host: '127.0.0.1', port: 5432, database: 'postgres', user,
  connectionTimeoutMillis: 7500, statement_timeout: 12000,
  query_timeout: 12000, max: 8,
});
const app = db('da_qa_client_commerce_app');
const creator = db('da_qa_stripe_intent_creator');
const ownerRead = db('da_qa_client_commerce_app');
const auditor = db('postgres');

const principal = Object.freeze({
  issuer: 'https://qa.example.invalid/realms/da-client',
  subject: 'a63f867f-9f42-4573-9268-dc65a164d2c1',
  role: 'client', authSource: 'external', ownershipEligible: true,
});
const foreign = Object.freeze({
  ...principal, subject: 'b63f867f-9f42-4573-9268-dc65a164d2c2',
});
const fakeSecret = ['sk', 'test', 'P0_SYNTHETIC_NEVER_EXTERNAL_20261014'].join('_');
const fakePub = ['pk', 'test', 'P0_SYNTHETIC_NEVER_EXTERNAL_20261014'].join('_');
const accountId = 'acct_DAQASYNTHETIC20261014';
const providerByKey = new Map();
const providerById = new Map();
let providerCreateCalls = 0;
let providerObjectCount = 0;
let loseNextProviderReply = false;
const issuedKeys = [];
const hash = input => createHash('sha256').update(input).digest('hex');

const catalog = {
  async quote(input) {
    assert.equal(input.partnerSlug, 'qa-market');
    assert.deepEqual(input.items, [
      { id: 'rice', quantity: 1 },
      { id: 'juice', quantity: 2 },
    ]);
    return {
      ok: true, version: 1,
      partnerSlug: 'qa-market', currency: 'eur',
      availabilityDate: '2026-10-14',
      quoteFingerprint: hash('p0-canonical-catalog-v1-rice-juice'),
      minimumOrderAmount: 1200,
      subtotal: 2300, deliveryFee: 390, total: 2690,
      items: [
        {
          id: 'rice', sku: 'rice', name: 'Jollof rice', category: 'Menu',
          quantity: 1, unitAmount: 1500, lineAmount: 1500,
        },
        {
          id: 'juice', sku: 'juice', name: 'Bissap', category: 'Drink',
          quantity: 2, unitAmount: 400, lineAmount: 800,
        },
      ],
    };
  },
};

const fakeFetch = async (url, init) => {
  const address = String(url);
  assert.ok(address.startsWith('https://api.stripe.com/v1/'));
  if (address === 'https://api.stripe.com/v1/account' &&
      init.method === 'GET') {
    return Response.json({ id: accountId, object: 'account' });
  }
  if (address === 'https://api.stripe.com/v1/payment_intents' &&
      init.method === 'POST') {
    providerCreateCalls++;
    const key = init.headers['Idempotency-Key'];
    assert.match(key, /^da-qa-test-v1-[0-9a-f]{64}$/);
    issuedKeys.push(key);
    const form = new URLSearchParams(init.body);
    assert.equal(form.get('amount'), '2690');
    assert.equal(form.get('currency'), 'eur');
    assert.equal(form.get('confirm'), 'false');
    assert.equal(form.get('capture_method'), 'automatic');
    assert.equal(form.get('transfer_data[destination]'), null);
    let record = providerByKey.get(key);
    if (!record) {
      providerObjectCount++;
      const id = 'pi_P0SYNTHETICPORTS000' + providerObjectCount;
      const metadata = {};
      for (const [k, v] of form) {
        if (k.startsWith('metadata[') && k.endsWith(']')) {
          metadata[k.slice(9, -1)] = v;
        }
      }
      record = {
        id, object: 'payment_intent', livemode: false, amount: 2690,
        currency: 'eur', client_secret: id + '_secret_SYNTHETICONLY',
        status: 'requires_payment_method', metadata,
        on_behalf_of: null, transfer_data: null,
      };
      providerByKey.set(key, record);
      providerById.set(id, record);
    }
    if (loseNextProviderReply) {
      loseNextProviderReply = false;
      throw Error('QA_FAKE_PROVIDER_RESPONSE_LOST_AFTER_SAVE');
    }
    return Response.json(record);
  }
  if (init.method === 'GET' &&
      address.startsWith('https://api.stripe.com/v1/payment_intents/')) {
    const id = address.slice(address.lastIndexOf('/') + 1);
    const record = providerById.get(id);
    assert.ok(record, 'read existing synthetic provider intent only');
    return Response.json(record);
  }
  throw Error('QA_UNEXPECTED_PROVIDER_CALL_FORBIDDEN');
};

const makePorts = (overrides = {}) => createQaPgFirstCheckoutPorts({
  canonicalCatalog: catalog,
  orderReservationPool: overrides.orderReservationPool || app,
  stripeIntentCreatorPool: overrides.stripeIntentCreatorPool || creator,
  ownedReceiptPool: ownerRead,
  providerIdempotencyHmacKey: process.env.QA_COMMERCE_HMAC_KEY,
  stripe: {
    secretKey: fakeSecret, publishableKey: fakePub,
    expectedAccountId: accountId, syntheticOnly: true,
    fetcher: fakeFetch,
  },
});
const cart = {
  partnerSlug: 'qa-market', items: [
    { id: 'rice', quantity: 1, price: 1 },
    { id: 'juice', quantity: 2, amount: 1 },
  ],
  total: 1, paid: true, currency: 'xof',
};
const count = async (table, field, value) => {
  const allowed = {
    orders: ['da_client_commerce_orders_qa', 'client_mutation_id'],
    snapshots: ['da_client_commerce_order_snapshot_qa', 'order_id'],
    payment: ['da_client_commerce_payment_authority_qa', 'order_id'],
  };
  const [target, col] = allowed[table];
  assert.equal(col, field);
  const result = await auditor.query(
    'SELECT count(*)::int AS n FROM public.' + target +
      ' WHERE ' + col + '=$1', [value],
  );
  return result.rows[0].n;
};

test('P0 actual PG-first ports: durable order, failure, replay, ownership, no LIVE', async () => {
  try {
    const ports = makePorts();
    const quote = await ports.quoteFromServerCatalog(cart);
    assert.equal(quote.totalMinor, 2690);
    assert.equal(quote.currency, 'EUR');
    assert.equal(quote.fulfillment.lines.length, 2);
    assert.equal(quote.fulfillment.subtotalMinor, 2300);

    // A payment request without a durable order snapshot MUST fail in SQL
    // before even an account lookup; no Stripe activity.
    const orphanMutation = 'p0-unreserved-provider-block-20261014';
    await assert.rejects(
      () => ports.createOrResumeStripeTest(principal, quote, orphanMutation),
      /qa_payment_requires_canonical_order_snapshot/,
    );
    assert.equal(providerCreateCalls, 0);
    console.log('P0_BEFORE_SNAPSHOT=PROVIDER_ZERO');

    // A failing snapshot within BEGIN must roll back the order UUID.
    const injected = {
      query: (sql, params) => app.query(sql, params),
      connect: async () => {
        const actual = await app.connect();
        return {
          query: async (sql, params) => {
            if (sql.includes('da_qa_service_store_order_snapshot')) {
              throw Error('QA_INJECTED_PRECOMMIT_FAILURE');
            }
            return actual.query(sql, params);
          },
          release: () => actual.release(),
        };
      },
    };
    const brokenPorts = makePorts({ orderReservationPool: injected });
    const brokenMutation = 'p0-precommit-failure-20261014';
    await assert.rejects(
      () => brokenPorts.reserveCanonicalOrder(
        principal, quote, brokenMutation),
      /qa_snapshot_atomic_order_reservation_unavailable/,
    );
    assert.equal(await count('orders', 'client_mutation_id', brokenMutation), 0);
    assert.equal(providerCreateCalls, 0);
    console.log('P0_DB_FAIL_BEFORE_STRIPE=NO_ORDER_NO_INTENT');

    // Guard role identity and quote replay against unintended provider use.
    const mutation = 'p0-durable-order-20261014-001';
    const order = await ports.reserveCanonicalOrder(principal, quote, mutation);
    assert.match(order.orderId, /^[0-9a-f-]{36}$/);
    assert.equal(order.state, 'pending_payment');
    assert.equal(await count('snapshots', 'order_id', order.orderId), 1);
    assert.equal(await count('payment', 'order_id', order.orderId), 0);
    const replay = await ports.reserveCanonicalOrder(principal, quote, mutation);
    assert.equal(replay.orderId, order.orderId);
    const changed = Object.freeze({
      ...quote, quoteFingerprint: 'f'.repeat(64),
    });
    await assert.rejects(
      () => ports.reserveCanonicalOrder(principal, changed, mutation),
      /qa_snapshot_atomic_order_reservation_unavailable/,
    );
    await assert.rejects(
      () => ports.reserveCanonicalOrder(
        { ...principal, role: 'merchant' }, quote, 'p0-foreign-role-20261014'),
      /qa_snapshot_signed_client_required/,
    );
    await assert.rejects(
      () => ports.readOwnedOrderStatus(foreign, order.orderId, mutation),
      /qa_receipt_order_not_found_or_not_owned/,
    );
    assert.equal(providerCreateCalls, 0);
    console.log('P0_IDEMPOTENCY_AND_ROLE_TENANCY=PASS_NO_PROVIDER');

    // Provider received one durable reservation and a single immutable key.
    // Its first response is lost. We retry the SAME mutation, never minting a
    // new order, authority or different Stripe Idempotency-Key.
    loseNextProviderReply = true;
    await assert.rejects(
      () => ports.createOrResumeStripeTest(principal, quote, mutation),
      /qa_checkout_provider_transport_ambiguous_retry_same_key/,
    );
    assert.equal(providerObjectCount, 1);
    assert.equal(await count('payment', 'order_id', order.orderId), 1);
    const intent = await ports.createOrResumeStripeTest(
      principal, quote, mutation);
    assert.equal(intent.orderId, order.orderId);
    assert.equal(intent.mode, 'test');
    assert.equal(intent.status, 'requires_payment_method');
    assert.equal(providerObjectCount, 1);
    assert.equal(new Set(issuedKeys).size, 1);
    const p3 = await ports.createOrResumeStripeTest(principal, quote, mutation);
    assert.equal(p3.paymentIntentId, intent.paymentIntentId);
    assert.equal(providerObjectCount, 1);
    const pending = await ports.readOwnedOrderStatus(
      principal, order.orderId, mutation);
    assert.equal(pending.financialStatus, 'awaiting_payment');
    assert.equal(pending.dispatchEligible, false);
    assert.equal(pending.paymentIntentId, intent.paymentIntentId);
    console.log('P0_PROVIDER_TIMEOUT_RETRY_ONE_INTENT=PASS');

    // Simulate PostgreSQL losing the provider bind response AFTER a second
    // synthetic provider intent was created. Recovery uses the same key.
    const bindMutation = 'p0-provider-db-bind-lost-20261014';
    const nextOrder = await ports.reserveCanonicalOrder(
      principal, quote, bindMutation);
    let loseDbBind = true;
    const brokenCreator = {
      query: async (sql, params) => {
        if (sql.includes('da_qa_provider_bind_test_intent') && loseDbBind) {
          loseDbBind = false;
          throw Error('QA_SYNTHETIC_DB_BIND_LOST');
        }
        return creator.query(sql, params);
      },
      connect: () => creator.connect(),
    };
    const brokenBindPorts = makePorts({
      stripeIntentCreatorPool: brokenCreator,
    });
    await assert.rejects(
      () => brokenBindPorts.createOrResumeStripeTest(
        principal, quote, bindMutation),
      /QA_SYNTHETIC_DB_BIND_LOST/,
    );
    const beforeRecovery = providerObjectCount;
    const recovered = await ports.createOrResumeStripeTest(
      principal, quote, bindMutation);
    assert.equal(recovered.orderId, nextOrder.orderId);
    assert.equal(providerObjectCount, beforeRecovery);
    assert.equal(new Set(issuedKeys.slice(-2)).size, 1);
    assert.equal(await count('payment', 'order_id', nextOrder.orderId), 1);
    console.log('P0_PG_BIND_LOST_RECONCILE_SAME_KEY=PASS');

    // No financial finality, capture, refund or payout occurs in this test.
    // Existing isolated tests certify their separate signed inbox and
    // restricted reconciler; the checkout ports never activate those paths.
    assert.equal(providerObjectCount, 2);
    console.log('P0_PG_FIRST_COMPOSITE=PASS_SYNTHETIC_PG17_NO_LIVE');
  } finally {
    await Promise.allSettled([
      app.end(), creator.end(), ownerRead.end(), auditor.end(),
    ]);
  }
});
