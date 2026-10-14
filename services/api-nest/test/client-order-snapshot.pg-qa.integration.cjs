'use strict';
/**
 * DELISHAFRICA - PostgreSQL 17 QA-only integration, disconnected.
 * Executes the *actual* transactional TypeScript snapshot adapter against
 * two low-privilege PG pools in an ephemeral Docker --network none namespace.
 * NOT for the VPS, public API, Stripe, Keycloak or production.
 */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Pool } = require('pg');
const { QaCanonicalOrderSnapshotPgAdapter } =
  require('/qa-built/client-order-snapshot.pg-qa.adapter.js');
const { QaClientCommercePgAdapter } =
  require('/qa-built/client-commerce.pg-qa.adapter.js');

if (process.env.GITHUB_ACTIONS !== 'true' ||
    process.env.QA_SYNTHETIC_ONLY !== 'YES' ||
    process.env.QA_COMMERCE_DB_HOST !== '127.0.0.1' ||
    process.env.QA_COMMERCE_DB_NAME !== 'postgres' ||
    !/^[0-9a-f]{64}$/.test(process.env.QA_COMMERCE_HMAC_KEY || '')) {
  throw Error('QA_DISCONNECTED_PG17_INTEGRATION_ONLY');
}

const connection = {
  host: '127.0.0.1', port: 5432, database: 'postgres',
  connectionTimeoutMillis: 10000, query_timeout: 12000,
  statement_timeout: 12000,
};
const firstPool = new Pool({
  ...connection, user: 'da_qa_client_commerce_app', max: 9,
});
const secondPool = new Pool({
  ...connection, user: 'da_qa_client_commerce_app', max: 9,
});
const auditorPool = new Pool({
  ...connection, user: 'postgres', max: 2,
});
const principal = Object.freeze({
  issuer: 'https://qa.example.invalid/realms/da-client',
  subject: 'a63f867f-9f42-4573-9268-dc65a164d2c1',
  role: 'client', authSource: 'external', ownershipEligible: true,
});
const quote = Object.freeze({
  source: 'server-canonical-catalog',
  quoteFingerprint: 'a'.repeat(64), cartFingerprint: 'b'.repeat(64),
  merchantSlug: 'qa-restaurant', totalMinor: 2690, currency: 'EUR',
  fulfillment: Object.freeze({
    subtotalMinor: 2300, deliveryFeeMinor: 390,
    lines: Object.freeze([
      Object.freeze({
        sku: 'rice', name: 'Jollof rice', category: 'Menu',
        quantity: 1, unitAmountMinor: 1500, lineAmountMinor: 1500,
      }),
      Object.freeze({
        sku: 'juice', name: 'Bissap', category: 'Drink',
        quantity: 2, unitAmountMinor: 400, lineAmountMinor: 800,
      }),
    ]),
  }),
});
const first = new QaCanonicalOrderSnapshotPgAdapter(firstPool);
const second = new QaCanonicalOrderSnapshotPgAdapter(secondPool);
const payments = new QaClientCommercePgAdapter(
  firstPool, process.env.QA_COMMERCE_HMAC_KEY,
);
const count = async (sql, parameters) => {
  const query = await auditorPool.query(sql, parameters);
  return Number(query.rows[0].count);
};

test('real PG17: eight cross-pool concurrent retries create one order and snapshot', async () => {
  try {
    const mutation = 'qa-snapshot-concurrency-pg17-0001';
    const reservations = await Promise.all(Array.from({ length: 8 }, (_, i) =>
      (i % 2 === 0 ? first : second)
        .reserveOrderAndSnapshot(principal, quote, mutation)));
    assert.equal(new Set(reservations.map(x => x.orderId)).size, 1);
    const orderId = reservations[0].orderId;
    assert.equal(await count(
      'SELECT count(*) FROM public.da_client_commerce_order_snapshot_qa WHERE order_id=$1',
      [orderId]), 1);
    const rows = (await auditorPool.query(
      'SELECT line_items,subtotal_minor,delivery_fee_minor,total_minor ' +
      'FROM public.da_client_commerce_order_snapshot_qa WHERE order_id=$1',
      [orderId])).rows;
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].line_items, quote.fulfillment.lines);
    assert.equal(Number(rows[0].subtotal_minor), 2300);
    assert.equal(Number(rows[0].delivery_fee_minor), 390);
    assert.equal(Number(rows[0].total_minor), 2690);
    const paymentReservations = await Promise.all(Array.from(
      { length: 8 }, () => payments.reserveTestPayment(principal, orderId)));
    assert.equal(new Set(paymentReservations.map(p => p.authorityId)).size, 1);
    assert.equal(new Set(paymentReservations.map(p => p.stripeIdempotencyKey)).size, 1);
    console.log('QA_REAL_PG17_SNAPSHOT_8_WAY=ONE_ORDER_ONE_SNAPSHOT_ONE_PAYMENT');

    // Old paths still able to reserve just an order are stopped at the
    // database trigger: no payment authority without canonical lines.
    const legacyOrder = await payments.reserveOrder(
      principal, quote, 'qa-snapshot-legacy-orphan-0001');
    await assert.rejects(
      () => payments.reserveTestPayment(principal, legacyOrder.orderId),
      /qa_payment_requires_canonical_order_snapshot/);
    assert.equal(await count(
      'SELECT count(*) FROM public.da_client_commerce_payment_authority_qa WHERE order_id=$1',
      [legacyOrder.orderId]), 0);
    console.log('QA_REAL_PG17_LEGACY_NO_SNAPSHOT=PAYMENT_DENIED');

    // Simulates interrupted statement after the reserved UUID. No partial
    // order may survive because BEGIN and snapshot share one transaction.
    const injectedPool = {
      connect: async () => {
        const db = await secondPool.connect();
        return {
          query: async (sql, params) => {
            if (sql.startsWith('SELECT public.da_qa_service_store_order_snapshot(')) {
              throw Error('QA_INJECT_PRE_COMMIT_DATABASE_FAILURE');
            }
            return db.query(sql, params);
          },
          release: () => db.release(),
        };
      },
    };
    const interrupted = new QaCanonicalOrderSnapshotPgAdapter(injectedPool);
    await assert.rejects(
      () => interrupted.reserveOrderAndSnapshot(
        principal, quote, 'qa-snapshot-interrupted-pg17-0001'),
      /qa_snapshot_atomic_order_reservation_unavailable/);
    assert.equal(await count(
      'SELECT count(*) FROM public.da_client_commerce_orders_qa WHERE client_mutation_id=$1',
      ['qa-snapshot-interrupted-pg17-0001']), 0);
    console.log('QA_REAL_PG17_PRE_COMMIT_CRASH=NO_ORPHAN_UUID');

    await assert.rejects(
      () => firstPool.query('SELECT * FROM public.da_client_commerce_order_snapshot_qa'),
      /permission denied/);
    await assert.rejects(
      () => firstPool.query(
        'UPDATE public.da_client_commerce_order_snapshot_qa SET delivery_fee_minor=0 WHERE order_id=$1',
        [orderId]),
      /permission denied/);
    console.log('QA_REAL_PG17_APP_ROLE_SNAPSHOT_DIRECT_ACCESS=DENIED');
  } finally {
    await Promise.all([
      firstPool.end(), secondPool.end(), auditorPool.end(),
    ]);
  }
});
