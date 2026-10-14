const test = require('node:test');
const assert = require('node:assert/strict');

// Test the compiled NestJS controller, but isolate its unrelated constructor
// dependencies. The real PaymentsService imports a private PG runtime vendor
// path; loading it would need a database driver even though health has no DB.
const Module = require('node:module');
function stubCompiledModule(relative, exports) {
  const filename = require.resolve(relative);
  const stub = new Module(filename);
  stub.filename = filename;
  stub.loaded = true;
  stub.exports = exports;
  require.cache[filename] = stub;
}
stubCompiledModule('../dist/payments/payments.service.js', {
  PaymentsService: class PaymentsService {},
});
stubCompiledModule('../dist/payments/payments.auth.guard.js', {
  PaymentsAuthGuard: class PaymentsAuthGuard {},
});
const { PaymentsController } = require('../dist/payments/payments.controller.js');

test('anonymous payment health exposes liveness only', () => {
  let called = 0;
  const internal = {
    ok: true,
    service: 'payments',
    stripeConfigured: true,
    publishableKeyConfigured: true,
    webhookConfigured: false,
    webhookSignatureVerification: 'required',
    catalogAuthority: 'server_recalculated',
    orderCommitAuthority: 'stripe_retrieval',
    paymentAuthorityStore: 'postgres_private_implementation',
    financialFinalityGuard: 'private',
    mockOrderCommitAllowed: false,
  };
  const controller = new PaymentsController({ health() { called++; return internal; } });
  const publicResult = controller.health();
  assert.equal(called, 1);
  assert.deepEqual(publicResult, { ok: true, service: 'payments' });
  assert.deepEqual(Object.keys(publicResult).sort(), ['ok', 'service']);
});

test('health fail status cannot be promoted to success by redaction', () => {
  const controller = new PaymentsController({
    health() { return { ok: false, service: 'payments', stripeConfigured: false }; },
  });
  assert.deepEqual(controller.health(), { ok: false, service: 'payments' });
});

test('provider catalogue contract remains unchanged', () => {
  const providers = { ok: true, providers: [{ id: 'stripe', status: 'configured' }] };
  const controller = new PaymentsController({
    health() { return { ok: true, service: 'payments' }; },
    providers() { return providers; },
  });
  assert.equal(controller.providers(), providers);
});
