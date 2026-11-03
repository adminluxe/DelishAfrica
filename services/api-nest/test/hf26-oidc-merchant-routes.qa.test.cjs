'use strict';
// HF26: isolated HTTP integration, ephemeral RSA, no production token, DB or external network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Module = require('node:module');
const oldLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (typeof request === 'string' && request.replace(/\\/g, '/').endsWith('/.runtime-vendor/pg-runtime/node_modules/pg'))
    return { Pool: class NO_DB_IN_HF26 { constructor() { throw Error('HF26_DB_ACCESS_FORBIDDEN'); } } };
  return oldLoad.call(this, request, parent, isMain);
};
let AuthController, AuthService, ExternalJwksVerifierService;
let MerchantCatalogOwnershipGuard, MerchantCatalogGateService;
let MerchantMembershipController, MerchantCatalogReadController, Test, CatalogFoundationService;
try {
  require('reflect-metadata');
  ({ AuthController } = require('../dist/auth/auth.controller.js'));
  ({ AuthService } = require('../dist/auth/auth.service.js'));
  ({ ExternalJwksVerifierService } = require('../dist/auth/external-jwks-verifier.service.js'));
  ({ MerchantCatalogOwnershipGuard } = require('../dist/merchant-catalog-gate/merchant-catalog-gate.guard.js'));
  ({ MerchantCatalogGateService } = require('../dist/merchant-catalog-gate/merchant-catalog-gate.service.js'));
  ({ CatalogFoundationService } = require('../dist/catalog-foundation/catalog-foundation.service.js'));
  ({ MerchantMembershipController, MerchantCatalogReadController } = require('../dist/merchant-catalog-gate/merchant-catalog-gate.controller.js'));
  ({ Test } = require('@nestjs/testing'));
} finally {
  Module._load = oldLoad;
}
const ISSUER = 'https://keycloak.afritaste.delishafrica.me/realms/afritaste';
const MERCHANT = 'delishafrica-merchant';
const CLIENT = 'delishafrica-client';
const ATM = 'afritaste-mobile';
const OPS = 'delishafrica-master-dashboard';
const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
function jwt(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: ISSUER, aud: [CLIENT, MERCHANT], azp: ATM, sub: 'hf26-ephemeral-subject',
    iat: now - 10, exp: now + 600, realm_access: { roles: ['merchant'] },
    ...overrides,
  };
  const h = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'hf26-temp' })).toString('base64url');
  const p = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const body = h + '.' + p;
  return body + '.' + crypto.sign('RSA-SHA256', Buffer.from(body, 'ascii'), keys.privateKey).toString('base64url');
}
function verifier() {
  const v = Object.create(ExternalJwksVerifierService.prototype);
  v.config = {
    issuer: ISSUER, audience: MERCHANT, merchantRealmRoles: ['merchant', MERCHANT],
    merchantClientRoles: ['merchant'], clockSkewSeconds: 30,
  };
  v.keys = new Map([['hf26-temp', { kid: 'hf26-temp', alg: 'RS256', key: keys.publicKey }]]);
  v.ready = true;
  v.refreshKeys = async () => {};
  return v;
}
function owned(slug) {
  return { partnerId: 'hf26-qa-' + slug, slug, ownershipRole: 'owner',
    publishedPayload: { name: 'QA synthetic establishment' },
    publishedRevision: 1, draftRevision: 0, draftPayload: null };
}
test('HF26 real Nest HTTP: ephemeral signed OIDC -> 401/403/409/200 gates, no DB', async () => {
  const prior = process.env.DA_INTERNAL_AUTH_ENABLED;
  process.env.DA_INTERNAL_AUTH_ENABLED = 'false';
  let partners = [owned('venue-one')], memberships = [];
  const catalog = {
    listOwnedBySubject: async () => partners,
    listMerchantMembershipsBySubject: async () => memberships,
  };
  const auth = new AuthService(verifier());
  const gate = new MerchantCatalogGateService(catalog, auth);
  const guard = new MerchantCatalogOwnershipGuard(auth, catalog);
  const mod = await Test.createTestingModule({
    controllers: [AuthController, MerchantMembershipController, MerchantCatalogReadController],
    providers: [
      { provide: AuthService, useValue: auth },
      { provide: CatalogFoundationService, useValue: catalog },
      { provide: MerchantCatalogGateService, useValue: gate },
      { provide: MerchantCatalogOwnershipGuard, useValue: guard },
    ],
  }).compile();
  const app = mod.createNestApplication({ logger: false });
  app.setGlobalPrefix('api/v1');
  await app.listen(0, '127.0.0.1');
  const port = app.getHttpServer().address().port;
  async function get(path, token, extra = {}, method = 'GET') {
    const headers = token ? { Authorization: 'Bearer ' + token, ...extra } : extra;
    const response = await fetch('http://127.0.0.1:' + port + '/api/v1' + path, { method, headers });
    const json = await response.json().catch(() => ({}));
    return { status: response.status, json };
  }
  try {
    for (const path of ['/auth/merchant/me', '/merchant/membership/me', '/merchant/catalog/me']) {
      assert.equal((await get(path)).status, 401, 'missing Bearer must reject ' + path);
    }
    const merchant = jwt();
    const wrongAzp = jwt({ azp: 'not-an-authorized-merchant-client' });
    assert.equal((await get('/auth/merchant/me', wrongAzp)).status, 401);
    const signed = merchant.split('.');
    const tampered = signed[0] + '.' + signed[1] + '.' +
      (signed[2][0] === 'A' ? 'B' : 'A') + signed[2].slice(1);
    assert.equal((await get('/auth/merchant/me', tampered)).status, 401);
    const trusted = await get('/auth/merchant/me', merchant);
    assert.equal(trusted.status, 200);
    assert.equal(trusted.json.principal.role, 'merchant');
    const noMembership = await get('/merchant/membership/me', merchant);
    assert.equal(noMembership.status, 200);
    assert.equal(noMembership.json.accessEligible, false);
    assert.equal(noMembership.json.eligibleMembershipCount, 0);
    // Characterization, NOT approval of access policy: current catalog guard checks ownership only.
    assert.equal((await get('/merchant/catalog/me', merchant)).status, 200);
    assert.equal((await get('/merchant/catalog/me/draft', merchant)).status, 200);
    assert.equal((await get('/merchant/catalog/me', merchant, {}, 'POST')).status, 404);
    partners = [];
    assert.equal((await get('/merchant/catalog/me', merchant)).status, 403);
    partners = [owned('venue-one'), owned('venue-two')];
    assert.equal((await get('/merchant/catalog/me', merchant)).status, 409);
    assert.equal((await get('/merchant/catalog/me', merchant, { 'x-da-partner-slug': 'foreign' })).status, 403);
    assert.equal((await get('/merchant/catalog/me', merchant, { 'x-da-partner-slug': 'venue-two' })).status, 200);
    const ops = jwt({ aud: [OPS, MERCHANT], azp: OPS, realm_access: { roles: [] },
      resource_access: { [OPS]: { roles: ['ops'] } } });
    assert.equal((await get('/merchant/catalog/me', ops)).status, 403);
    assert.equal((await get('/auth/merchant/me', ops)).status, 403);
    memberships = [{ accessEligible: true }];
    const eligible = await get('/merchant/membership/me', merchant);
    assert.equal(eligible.status, 200);
    assert.equal(eligible.json.accessEligible, true);
    assert.equal(eligible.json.eligibleMembershipCount, 1);
  } finally {
    await app.close();
    if (prior === undefined) delete process.env.DA_INTERNAL_AUTH_ENABLED;
    else process.env.DA_INTERNAL_AUTH_ENABLED = prior;
  }
});