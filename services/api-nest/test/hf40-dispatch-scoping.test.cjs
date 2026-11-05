'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

// This suite never touches the pilot or production orders. Each run owns a
// different temporary filesystem; the backend reads the configured file.
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'da-hf38-dispatch-'));
process.env.DA_DEMO_ORDERS_STORE_FILE = path.join(sandbox, 'orders.json');
process.env.DA_COURIER_PRESENCE_STORE_FILE = path.join(sandbox, 'presence.json');

// The QA source has a production-only vendored PG path. We unit-test only
// dispatch/presence behavior here and never open a database connection.
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function loadForIsolatedUnitTest(request, parent, isMain) {
  if (String(request).endsWith('/.runtime-vendor/pg-runtime/node_modules/pg')) {
    return { Pool: class NoDatabaseConnectionAllowed {} };
  }
  return originalLoad.call(this, request, parent, isMain);
};
let OrdersDispatchService;
let CourierPresenceService;
try {
  ({ OrdersDispatchService } = require('../dist/orders/orders.dispatch.service'));
  ({ CourierPresenceService } = require('../dist/orders/courier-presence.service'));
} finally {
  Module._load = originalLoad;
}

process.on('exit', () => fs.rmSync(sandbox, { recursive: true, force: true }));

test('merchant and client cannot read Courier offer inbox or trigger reconciliation', async () => {
  let reconciled = 0;
  const service = new OrdersDispatchService({}, { visibleOrders: async () => [] });
  service.reconcileReadyOrders = async () => { reconciled += 1; };
  await assert.rejects(() => service.offers({ role: 'merchant' }), (error) => error?.status === 403);
  await assert.rejects(() => service.offers({ role: 'client' }), (error) => error?.status === 403);
  assert.equal(reconciled, 0);
});

test('Courier scoped offer inbox reconciles before reading and does not widen visibility', async () => {
  const calls = [];
  const principal = { role: 'courier', subject: 'hf38-test-courier', issuer: 'qa-issuer' };
  const service = new OrdersDispatchService({}, {
    visibleOrders: async (current, _raw) => {
      calls.push('visibleOrders');
      assert.strictEqual(current, principal);
      // Access filtering is authoritative; only its scoped result is returned.
      return [{ id: 'HF38-LOCAL-ONLY', status: 'ready', assignmentProposal: {
        status: 'proposed', courierId: principal.subject,
      }}];
    },
  });
  service.reconcileReadyOrders = async () => { calls.push('reconcileReadyOrders'); };
  const response = await service.offers(principal);
  assert.deepEqual(calls, ['reconcileReadyOrders', 'visibleOrders']);
  assert.equal(response.ok, true);
  assert.equal(response.count, 1);
  assert.deepEqual(response.orders, response.data);
  assert.deepEqual(response.orders, response.items);
  assert.equal(response.orders[0].assignmentProposal.courierId, principal.subject);
});

test('Courier presence is scoped to authenticated Courier principal and expires when offline', () => {
  const presence = new CourierPresenceService();
  const courier = { role: 'courier', subject: 'hf38-courier', issuer: 'qa', name: 'Local test' };
  assert.throws(() => presence.heartbeat({ role: 'client', subject: 'attacker' }, {
    available: true,
  }), (error) => error?.status === 403);
  const online = presence.heartbeat(courier, {
    available: true, activeZone: 'Bruxelles', city: 'Bruxelles',
    countryCode: 'BE', vehicle: 'bike', capacity: 1,
  });
  assert.equal(online.courierId, courier.subject);
  assert.equal(online.online, true);
  assert.equal(presence.isActive(courier.subject), true);
  assert.equal(presence.isActive('other-courier'), false);
  const offline = presence.heartbeat(courier, { available: false });
  assert.equal(offline.online, false);
  assert.equal(presence.isActive(courier.subject), false);
});


test('expired proposal is reissued only to an active Courier and hidden from its previous target', async () => {
  const { createDemoOrder } = require('../dist/orders/orders.demo.store');
  const presence = new CourierPresenceService();
  const current = { role: 'courier', subject: 'hf38-next-courier', issuer: 'qa', name: 'Courier QA' };
  const previous = { role: 'courier', subject: 'hf38-offline-courier', issuer: 'qa' };
  presence.heartbeat(current, {
    available: true, city: 'Bruxelles', countryCode: 'BE',
    activeZone: 'Bruxelles', vehicle: 'bike', capacity: 1,
  });
  createDemoOrder({
    id: 'HF38-EPHEMERAL-QA', partnerSlug: 'la-boule-bleue',
    restaurantCity: 'Bruxelles', countryCode: 'BE', status: 'ready',
    assignmentProposal: {
      status: 'proposed', courierId: previous.subject, source: 'server-dispatch',
      expiresAt: new Date(Date.now() - 30_000).toISOString(),
    },
  });
  const service = new OrdersDispatchService(presence, {
    visibleOrders: async (principal, orders) => orders.filter((order) =>
      order.status === 'ready'
      && order.assignmentProposal?.courierId === principal.subject
      && order.assignmentProposal?.status === 'proposed'),
  });
  const next = await service.offers(current);
  assert.equal(next.count, 1);
  assert.equal(next.orders[0].orderId, 'HF38-EPHEMERAL-QA');
  assert.equal(next.orders[0].assignmentProposal.courierId, current.subject);
  assert.ok(new Date(next.orders[0].assignmentProposal.expiresAt).getTime() > Date.now());
  const old = await service.offers(previous);
  assert.equal(old.count, 0);
});
