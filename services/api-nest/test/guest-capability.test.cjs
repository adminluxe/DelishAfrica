const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomBytes } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const sourceFile = path.resolve(__dirname, '../src/guest-checkout/guest-capability.ts');
const js = ts.transpileModule(readFileSync(sourceFile, 'utf8'), {
  fileName: sourceFile,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
}).outputText;
const compiled = new Module(sourceFile, module);
compiled.filename = sourceFile;
compiled.paths = module.paths;
compiled._compile(js, sourceFile);
const { createGuestCheckoutCapability: mint, verifyGuestCheckoutCapability: verify,
  guestCapabilityMatchesOrder: matches, loadGuestCapabilityKey: readKey } = compiled.exports;
const key = randomBytes(32);
const otherKey = randomBytes(32);
const now = Date.UTC(2026, 9, 9, 13);
test('strong keys only', () => {
  assert.equal(readKey('abc'), null);
  assert.deepEqual(readKey(key.toString('base64url')), key);
});
test('single-order identity is valid and scoped', () => {
  const a = mint(key, now), b = mint(key, now);
  const claims = verify(key, a.token, now);
  assert.ok(claims);
  assert.equal(matches(claims, a.orderId, a.mutationId), true);
  assert.equal(matches(claims, b.orderId, b.mutationId), false);
  assert.notEqual(a.orderId, b.orderId);
  assert.notEqual(claims.subject, verify(key, b.token, now).subject);
});
test('tampering, wrong key, expiration and invalid input fail closed', () => {
  const a = mint(key, now);
  assert.equal(verify(otherKey, a.token, now), null);
  assert.equal(verify(key, a.token.slice(0, -4) + 'evil', now), null);
  assert.equal(verify(key, a.token, now + 14400000), null);
  assert.equal(verify(key, a.token, now - 31000), null);
  assert.equal(verify(key, 'invalid', now), null);
  assert.throws(() => mint(Buffer.alloc(3), now));
});
test('no contact details or elevated roles are embedded', () => {
  const a = mint(key, now);
  const claim = JSON.parse(Buffer.from(a.token.split('.')[1], 'base64url').toString('utf8'));
  assert.equal(claim.email, undefined);
  assert.equal(claim.address, undefined);
  assert.equal(claim.role, undefined);
});
