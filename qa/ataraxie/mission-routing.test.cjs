const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '../..');
const { MissionRoutesController } = require(path.join(root, 'services/api-nest/dist/routes-preview/mission-routes.controller.js'));
const { RoutesPreviewService } = require(path.join(root, 'services/api-nest/dist/routes-preview/routes-preview.service.js'));
const input = { origin: { lat: 50.83558, lng: 4.36756 }, destination: { lat: 50.8277, lng: 4.3725 }, mode: 'BICYCLE', orderId: 'QA-ATARAXIE-ROUTE' };
function fixture(overrides = {}) {
  const calls = [];
  const principal = { issuer: 'qa', subject: 'fixture-client', role: 'client', ownershipEligible: true, ...overrides };
  const controller = new MissionRoutesController({ resolvePrincipalFromAuthorization: async (header) => header === 'Bearer fixture' ? { ok: true, authenticated: true, principal } : { ok: false, authenticated: false, principal: null } }, { preview: async (...args) => { calls.push(args); return { ok: true }; } });
  return { controller, calls };
}
test('A missing or invalid session cannot invoke the paid provider', async () => {
  const { controller, calls } = fixture();
  for (const header of ['', 'Bearer invalid']) await assert.rejects(controller.preview(header, input), (e) => e.getStatus() === 401);
  assert.equal(calls.length, 0);
});
test('Unverified accounts and unrelated roles cannot invoke mission routing', async () => {
  for (const overrides of [{ ownershipEligible: false }, { role: 'ops' }]) {
    const { controller, calls } = fixture(overrides); await assert.rejects(controller.preview('Bearer fixture', input), (e) => e.getStatus() === 403); assert.equal(calls.length, 0);
  }
});
test('Mission routing validates coordinates, explicit mode and mission identity', async () => {
  const { controller, calls } = fixture();
  for (const body of [null, [], { ...input, origin: { lat: null, lng: 4 } }, { ...input, destination: { lat: 91, lng: 4 } }, { ...input, mode: '' }, { ...input, orderId: '' }]) await assert.rejects(controller.preview('Bearer fixture', body), (e) => e.getStatus() === 400);
  assert.equal(calls.length, 0);
});
test('Verified mission requests pass only supported routing fields', async () => {
  const { controller, calls } = fixture(); await controller.preview('Bearer fixture', { ...input, injectedField: 'not forwarded' });
  assert.equal(calls.length, 1); assert.equal(calls[0][1].allowGoogle, true); assert.equal(calls[0][0].injectedField, undefined); assert.equal(calls[0][0].mode, 'BICYCLE'); assert.equal(calls[0][0].orderId, input.orderId);
});
test('A burst from one account is stopped before additional provider calls', async () => {
  const { controller, calls } = fixture(); for (let n=0;n<8;n++) await controller.preview('Bearer fixture', input);
  await assert.rejects(controller.preview('Bearer fixture', input), (e) => e.getStatus() === 429); assert.equal(calls.length, 8);
});
test('The legacy public preview never consumes a configured Google key', async () => {
  const original = global.fetch; const previous = process.env.GOOGLE_ROUTES_API_KEY; let calls = 0;
  global.fetch = async () => { calls++; throw new Error('No network expected'); }; process.env.GOOGLE_ROUTES_API_KEY = 'fixture-key-not-real';
  try { const result = await new RoutesPreviewService().preview(input); assert.equal(result.fallback, true); assert.equal(calls, 0); }
  finally { global.fetch = original; if (previous === undefined) delete process.env.GOOGLE_ROUTES_API_KEY; else process.env.GOOGLE_ROUTES_API_KEY = previous; }
});
test('Authenticated routing loads the server-side key file and preserves mode metadata', async () => {
  const keys = ['GOOGLE_ROUTES_API_KEY', 'GOOGLE_MAPS_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_ROUTES_API_KEY_FILE']; const previous = Object.fromEntries(keys.map((k) => [k, process.env[k]])); const original = global.fetch;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'da-route-key-')); const keyFile = path.join(directory, 'key'); fs.writeFileSync(keyFile, 'fixture-file-key-not-real'); for (const k of keys) delete process.env[k]; process.env.GOOGLE_ROUTES_API_KEY_FILE = keyFile;
  let seenKey = false;
  global.fetch = async (_url, options) => { seenKey = options.headers['X-Goog-Api-Key'] === 'fixture-file-key-not-real'; return { ok: true, json: async () => ({ routes: [{ distanceMeters: 1200, duration: '480s', polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' } }] }) }; };
  try { const result = await new RoutesPreviewService().preview(input, { allowGoogle: true }); assert.equal(seenKey, true); assert.equal(result.provider, 'google_routes'); assert.equal(result.fallback, false); assert.equal(result.meta.mode, 'BICYCLE'); assert.equal(result.meta.trafficAware, false); }
  finally { global.fetch = original; for (const k of keys) { if (previous[k] === undefined) delete process.env[k]; else process.env[k] = previous[k]; } fs.rmSync(directory, { recursive: true, force: true }); }
});
test('A null coordinate is rejected before any authenticated provider call', async () => {
  const result = await new RoutesPreviewService().preview({ ...input, origin: { lat: null, lng: 4 } }, { allowGoogle: true }); assert.equal(result.ok, false); assert.equal(result.provider, 'fallback_invalid_input');
});
