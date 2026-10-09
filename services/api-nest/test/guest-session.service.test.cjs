'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const ts = require('typescript');
const key = require('node:crypto').randomBytes(32).toString('base64url');
require('reflect-metadata');
require.extensions['.ts'] = function (module, filename) {
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021,
      experimentalDecorators: true, emitDecoratorMetadata: true },
  }).outputText;
  module._compile(code, filename);
};
const { GuestSessionService } = require('../src/guest-checkout/guest-session.service.ts');
const saved = {
  NODE_ENV: process.env.NODE_ENV,
  DA_GUEST_CHECKOUT_PREVIEW: process.env.DA_GUEST_CHECKOUT_PREVIEW,
  DA_GUEST_CHECKOUT_HMAC_KEY_B64: process.env.DA_GUEST_CHECKOUT_HMAC_KEY_B64,
};
function setConfig(mode, enabled, secret = key) {
  process.env.NODE_ENV = mode;
  process.env.DA_GUEST_CHECKOUT_PREVIEW = enabled;
  process.env.DA_GUEST_CHECKOUT_HMAC_KEY_B64 = secret;
}
test('production remains sealed even if preview flag and key exist', () => {
  setConfig('production', '1');
  const service = new GuestSessionService();
  assert.equal(service.isPreviewEnabled(), false);
  assert.equal(service.status().paymentsEnabled, false);
  assert.throws(() => service.createPreviewSession('127.0.0.1'), x => x.status === 503);
});
test('disabled preview and missing key fail closed', () => {
  const service = new GuestSessionService();
  setConfig('development', '0');
  assert.throws(() => service.createPreviewSession('127.0.0.1'), x => x.status === 503);
  setConfig('development', '1', 'weak');
  assert.throws(() => service.createPreviewSession('127.0.0.1'), x => x.status === 503);
});
test('developer preview issues token, rate-limits and does not activate payment', () => {
  setConfig('development', '1');
  const service = new GuestSessionService();
  for (let i = 0; i < 8; i++) {
    const item = service.createPreviewSession('127.0.0.1');
    assert.equal(item.stage, 'preview_only_no_payments');
    assert.match(item.token, /^dagc1\./);
  }
  assert.throws(() => service.createPreviewSession('127.0.0.1'), x => x.status === 429);
  assert.equal(service.status().orderCreationEnabled, false);
});
test.after(() => {
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});
