const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const ts = require(require.resolve('typescript', { paths: [path.join(root, 'apps/courier'), root] }));
function load(relative, overrides = {}) {
  const filename = path.join(root, relative);
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
  const module = { exports: {} };
  const context = { module, exports: module.exports, require: (name) => overrides[name] || require(name), console, Date, Set, process: overrides.process || process };
  vm.runInNewContext(js, context, { filename });
  return module.exports;
}
const core = load('packages/contracts/src/missionJourney.ts');
const { MissionLocationSession } = load('apps/courier/utils/missionLocationSession.ts');
const point = (latitude, longitude) => ({ latitude, longitude });
const fix = { ...point(50.8, 4.3), accuracyMeters: 8, headingDegrees: 90, speedMetersPerSecond: 3, capturedAt: Date.now() };
const tick = () => new Promise(setImmediate);
function deferred() { let resolve; const promise = new Promise((r) => resolve = r); return { promise, resolve }; }
function sessionFixture(custom = {}) {
  const calls = { publish: [], stop: [], removed: 0, watch: 0 };
  let onFix;
  let nextId = 0;
  const adapter = { permission: async () => true, current: async () => fix, validate: async () => true,
    watch: async (callback) => { onFix = callback; calls.watch++; return { remove: () => calls.removed++ }; },
    publish: async (...args) => calls.publish.push(args), stop: async (...args) => calls.stop.push(args), id: () => `session-${++nextId}`, ...custom };
  const session = new MissionLocationSession(adapter);
  return { session, calls, emit: (value = fix) => onFix?.(value) };
}
test('A direct mission link cannot select another order', () => {
  const result = core.selectJourneyMission([{ publicId: 'B', status: 'picked_up' }], 'A');
  assert.equal(result.order, null); assert.equal(result.reason, 'not_found');
});
test('Ambiguous accepted missions require an explicit choice', () => {
  const result = core.selectJourneyMission(['A', 'B'].map((publicId) => ({ publicId, status: 'ready', assignmentProposal: { status: 'accepted' } })));
  assert.equal(result.order, null); assert.equal(result.choices.length, 2);
});
test('Missing coordinates never turn into a real zero coordinate', () => {
  for (const value of [null, undefined, '', '  ', false]) assert.equal(core.journeyPoint({ latitude: value, longitude: 4 }), null);
  assert.equal(core.journeyPoint({ latitude: 91, longitude: 4 }), null);
  assert.equal(core.journeyPoint(point(0, 0)).latitude, 0);
  assert.equal(core.journeyDestinationPoint({ deliveryLocation: { latitude: null, longitude: null } }), null);
});
test('A received signal continues to age while the network is unavailable', () => {
  const read = { ok: true, ageSeconds: 2, receivedAtMs: 1_000, freshness: 'live', location: { active: true, point: fix } };
  assert.equal(core.assessJourneySignal(read, 61_000).freshness, 'recent');
  const stale = core.assessJourneySignal(read, 101_000);
  assert.equal(stale.freshness, 'stale'); assert.equal(stale.usable, false);
});
test('Stopped, inaccurate and absent signals do not drive the map', () => {
  for (const read of [{ ok: true, ageSeconds: 1, location: { active: false, point: fix } }, { ok: true, ageSeconds: 1, location: { active: true, point: { ...fix, accuracyMeters: 300 } } }, null]) assert.equal(core.assessJourneySignal(read).usable, false);
});
test('Progress uses physical distance even with uneven polyline vertices', () => {
  const result = core.journeyRouteProgress([point(0,0), point(0,0.001), point(0,0.1)], point(0,0.05));
  assert.ok(Math.abs(result.progress - 0.5) < 0.001); assert.ok(result.remainingMeters > 5500 && result.remainingMeters < 5600);
});
test('Malformed and out of bounds polylines are rejected', () => {
  for (const value of ['_', '!!!!', '~'.repeat(30), '']) assert.equal(core.decodeJourneyPolyline(value).length, 0);
  assert.equal(core.decodeJourneyPolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@').length, 3);
});
test('Fallback routing, mismatched modes and expired routes cannot produce an ETA', () => {
  const payload = { ok: true, provider: 'google_routes', fallback: false, polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@', distanceMeters: 1000, durationSeconds: 600, meta: { mode: 'BICYCLE', computedAt: new Date().toISOString() } };
  assert.equal(core.verifiedJourneyRoute({ ...payload, fallback: true }, 'BICYCLE'), null);
  assert.equal(core.verifiedJourneyRoute(payload, 'DRIVE'), null);
  assert.equal(core.verifiedJourneyRoute({ ...payload, meta: { ...payload.meta, computedAt: new Date(Date.now()-100_000).toISOString() } }, 'BICYCLE'), null);
  const route = core.verifiedJourneyRoute(payload, 'BICYCLE'); assert.ok(route);
  assert.equal(core.journeyEta(route, point(0,0)), null);
  assert.equal(core.journeyEta(route, route.points[0], Date.now()+100_000), null);
  assert.match(core.journeyEta(route, route.points[0]).label, /10–12 min/);
});
test('Only the order state confirms delivery', () => {
  assert.equal(core.isJourneyDelivered({ status: 'picked_up' }), false);
  assert.equal(core.isJourneyDelivered({ status: 'delivered' }), true);
});
test('Permission refusal starts neither a watcher nor publication', async () => {
  const { session, calls } = sessionFixture({ permission: async () => false });
  await session.share('A', 'BICYCLE'); assert.equal(calls.publish.length, 0); assert.equal(calls.watch, 0); assert.equal(session.snapshot().sharing, false); session.dispose();
});
test('Stopping while permission is pending cannot start a later GPS watcher', async () => {
  const permission = deferred(); const { session, calls } = sessionFixture({ permission: () => permission.promise });
  const start = session.share('A', 'BICYCLE'); session.stop(); permission.resolve(true); await start;
  assert.equal(calls.watch, 0); assert.equal(calls.publish.length, 0); assert.equal(session.snapshot().orderId, null);
});
test('Private positioning never publishes to the mission API', async () => {
  const { session, calls, emit } = sessionFixture(); await session.locate(); emit(); await tick();
  assert.equal(calls.publish.length, 0); assert.equal(session.snapshot().sharing, false); assert.equal(session.snapshot().tracking, true); session.dispose();
});
test('Foreground sharing publishes only after mission validation', async () => {
  const { session, calls } = sessionFixture({ validate: async () => false }); await session.share('A', 'DRIVE');
  assert.equal(calls.publish.length, 0); assert.equal(session.snapshot().sharingRequested, false);
});
test('Network failure never appears as successful sharing; a later fix can recover', async () => {
  let online = false; const { session, emit } = sessionFixture({ publish: async () => { if (!online) throw new Error('offline'); } });
  await session.share('A', 'WALK'); assert.equal(session.snapshot().sharing, false); assert.equal(session.snapshot().sharingRequested, true);
  online = true; emit(); await tick(); assert.equal(session.snapshot().sharing, true); session.dispose();
});
test('Authentication rejection stops publication and the watcher', async () => {
  const { session, calls, emit } = sessionFixture(); await session.share('A', 'DRIVE');
  session.adapter.publish = async () => { throw Object.assign(new Error('unauthorized'), { status: 403 }); };
  emit(); await tick(); assert.equal(session.snapshot().sharingRequested, false); assert.equal(calls.removed, 1);
});
test('Backgrounding stops GPS and invalidates the old session; return revalidates', async () => {
  const { session, calls, emit } = sessionFixture(); await session.share('A', 'BICYCLE');
  session.setActive(false); emit(); await tick(); assert.equal(session.snapshot().paused, true); assert.equal(calls.removed, 1); assert.equal(calls.publish.length, 1);
  session.setActive(true); await tick(); await tick(); assert.equal(calls.publish.length, 2); assert.notEqual(calls.publish[0][3], calls.publish[1][3]); session.dispose();
});
test('A late publication cannot resurrect a stopped local session', async () => {
  const gate = deferred(); const { session } = sessionFixture({ publish: () => gate.promise });
  const start = session.share('A', 'WALK'); await tick(); session.stop(); gate.resolve(); await start;
  assert.equal(session.snapshot().sharing, false); assert.equal(session.snapshot().tracking, false);
});
test('A new mission is not blocked by the previous in-flight publication', async () => {
  const gate = deferred(); const sent = [];
  const { session } = sessionFixture({ publish: async (id) => { sent.push(id); if (id === 'A') await gate.promise; } });
  const first = session.share('A', 'WALK'); await tick(); await session.share('B', 'BICYCLE'); gate.resolve(); await first;
  assert.equal(session.snapshot().orderId, 'B'); assert.equal(sent.join(','), 'A,B'); assert.equal(session.snapshot().sharing, true); session.dispose();
});
test('Mission completion stops the active session on revalidation', async () => {
  const { session, calls } = sessionFixture(); await session.share('A', 'WALK'); session.adapter.validate = async () => false; await session.revalidate(); assert.equal(session.snapshot().sharing, false); assert.equal(calls.removed, 1);
});
function storeFixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'da-journey-'));
  const order = { status: 'picked_up', assignmentProposal: { status: 'accepted', courierId: 'courier-A' } };
  const env = { ...process.env, DA_LIVE_LOCATION_STORE_FILE: path.join(directory, 'location.json') };
  const store = load('services/api-nest/src/orders/orders.live-location.store.ts', { './orders.demo.store': { getDemoOrder: (id) => id === 'A' ? order : null }, process: { env, cwd: process.cwd } });
  const publish = (extra = {}) => store.publishDemoOrderLiveLocation({ orderId: 'A', courierId: 'courier-A', ...fix, capturedAt: new Date().toISOString(), sharingSessionId: 'one', travelMode: 'BICYCLE', ...extra });
  return { ...store, publish, order, cleanup: () => fs.rmSync(directory, { recursive: true, force: true }) };
}
test('API rejects missing coordinates, future timestamps and wrong assignments', () => {
  const s = storeFixture(); try {
    assert.equal(s.publish({ latitude: null }).ok, false); assert.equal(s.publish({ capturedAt: new Date(Date.now()+120_000).toISOString() }).ok, false);
    assert.equal(s.publish({ courierId: 'other' }).error, 'courier_mismatch');
    assert.equal(s.publish().location.travelMode, 'BICYCLE'); assert.equal(s.order.status, 'picked_up');
  } finally { s.cleanup(); }
});
test('Stopping a session before its first delayed publication fences that publication', () => {
  const s = storeFixture(); try {
    assert.equal(s.stopDemoOrderLiveLocation({ orderId: 'A', courierId: 'courier-A', sharingSessionId: 'one' }).ok, true);
    assert.equal(s.publish().error, 'sharing_session_stopped');
  } finally { s.cleanup(); }
});
test('A late stop and late fix from the previous session cannot replace the new session', () => {
  const s = storeFixture(); try {
    assert.equal(s.publish().ok, true); assert.equal(s.publish({ sharingSessionId: 'two' }).ok, true);
    s.stopDemoOrderLiveLocation({ orderId: 'A', courierId: 'courier-A', sharingSessionId: 'one' });
    assert.equal(s.getDemoOrderLiveLocation({ orderId: 'A' }).location.active, true);
    assert.equal(s.publish().error, 'sharing_session_stopped');
    assert.equal(s.getDemoOrderLiveLocation({ orderId: 'A' }).location.sharingSessionId, 'two');
  } finally { s.cleanup(); }
});
test('Out of order fixes cannot move the courier back in time', () => {
  const s = storeFixture(); try {
    assert.equal(s.publish().ok, true); assert.equal(s.publish({ capturedAt: new Date(Date.now()-10_000).toISOString() }).error, 'out_of_order_location');
  } finally { s.cleanup(); }
});
test('An offline stop is retried without restarting GPS', async () => {
  let online = false; let stops = 0;
  const { session, calls } = sessionFixture({ stop: async () => { stops++; if (!online) throw new Error('offline'); } });
  await session.share('A', 'BICYCLE'); session.stop(); await tick(); online = true; await session.revalidate(); await tick();
  assert.equal(stops, 2); assert.equal(calls.watch, 1); assert.equal(session.snapshot().sharingRequested, false);
});
test('A failed disk write never acknowledges a published position', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'da-no-write-'));
  const configured = path.join(directory, 'not-a-directory'); fs.writeFileSync(configured, 'block');
  const store = load('services/api-nest/src/orders/orders.live-location.store.ts', { './orders.demo.store': { getDemoOrder: () => ({ status: 'ready', assignmentProposal: { status: 'accepted', courierId: 'courier-A' } }) }, process: { env: { ...process.env, DA_LIVE_LOCATION_STORE_FILE: path.join(configured, 'location.json') }, cwd: process.cwd } });
  try { const result = store.publishDemoOrderLiveLocation({ orderId: 'A', courierId: 'courier-A', ...fix, capturedAt: new Date().toISOString() }); assert.equal(result.ok, false); assert.equal(result.error, 'location_persistence_unavailable'); }
  finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
