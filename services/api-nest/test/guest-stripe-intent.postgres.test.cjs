'use strict';
const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { readFileSync } = require('node:fs');
const { randomBytes } = require('node:crypto');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => {
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  }).outputText;
  mod._compile(code, file);
};
const { Pool } = require('/opt/delishafrica/monorepo/services/api-nest/.runtime-vendor/pg-runtime/node_modules/pg');
const { GuestCheckoutLedger } = require('../src/guest-checkout/guest-checkout-ledger.ts');
const { GuestPrivateFulfillmentVault } = require('../src/guest-checkout/guest-private-fulfillment-vault.ts');
const { GuestStripeIntentReservation } = require('../src/guest-checkout/guest-stripe-intent-reservation.ts');
const { GuestMerchantCoverageStrict, coverageApprovalDigest } =
  require('../src/guest-checkout/guest-merchant-coverage-strict.ts');
const { PostgresGuestCoverageOpsApprovals } =
  require('../src/guest-checkout/guest-coverage-ops-approval-pg.ts');

const db = new Pool({ host: '127.0.0.1', port: 55440, user: 'afripayadmin', database: 'postgres', max: 10 });
const capKey = randomBytes(32), encKey = randomBytes(32);
const ledger = new GuestCheckoutLedger(db, capKey);
const vault = new GuestPrivateFulfillmentVault(db, capKey,
  new Map([['dek_lab2026', encKey]]), 'dek_lab2026');
const quote = {
  ok: true, version: 1, partnerSlug: 'thieyp', partnerName: 'Thieyp LAB',
  currency: 'eur', availabilityDate: '2026-10-09', availabilityDay: 'vendredi',
  items: [{ id: 'sku_lab1', sku: 'sku_lab1', name: 'Food LAB', category: 'Food',
    quantity: 1, unitAmount: 2190, lineAmount: 2190, scheduledDay: null }],
  subtotal: 2190, deliveryFee: 0, total: 2190, minimumOrderAmount: 0,
  quoteFingerprint: 'ab'.repeat(32), quotedAt: '2026-10-09T15:00:00Z',
};
const contact = {
  name: 'LAB Customer', phone: '+32470000000',
  address: '12 Rue du laboratoire', city: 'Bruxelles', consent: true,
};
const coverageContract = {
  version: 1, revision: 1, enabled: true, approvedByMerchant: true,
  zones: [{ enabled: true, code: 'be-brussels-pilot', countryCode: 'BE',
    postalCodes: ['1050'],
    center: { latitude: 50.8300, longitude: 4.3700 },
    maxDistanceMeters: 1500 }],
};
const merchant = { id: 'lab_thieyp', slug: 'thieyp', name: 'Lab Thieyp',
  status: 'active',
  delivery: { enabled: true, guestCheckoutCoverage: coverageContract } };
const opsApprovalDigest = coverageApprovalDigest('thieyp', coverageContract);
const opsReader = new PostgresGuestCoverageOpsApprovals(db);
const liveCoverage = new GuestMerchantCoverageStrict({
  async findPublishedBySlug(slug, fallback) {
    assert.equal(slug, 'thieyp');
    assert.deepEqual(fallback, []);
    return merchant;
  },
}, opsReader);
const delivery = {
  verifiedByServer: true, eligible: true, serviceAreaCode: 'be-brussels-pilot',
  locationProof: {
    placeId: 'googleplace_test001', countryCode: 'BE', postalCode: '1050',
    latitude: 50.8300, longitude: 4.3700, source: 'google_places_new',
  },
};
const previousEnv = {
  NODE_ENV: process.env.NODE_ENV,
  DA_GUEST_STRIPE_TEST_ONLY: process.env.DA_GUEST_STRIPE_TEST_ONLY,
};
before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DA_GUEST_STRIPE_TEST_ONLY = '1';
  const probe = await db.query('SELECT inet_server_port() AS port');
  assert.equal(probe.rows[0].port, 55440);
  const sql = readFileSync(path.resolve(__dirname,
    '../../../migrations/20261009_guest_intent_creation_reservations.sql'), 'utf8');
  await db.query(sql);
  const opsMigration = readFileSync(path.resolve(__dirname,
    '../../../migrations/20261009_guest_coverage_ops_approvals.sql'), 'utf8');
  await db.query(opsMigration);
  const recoveryMigration=readFileSync(path.resolve(__dirname,
    '../../../migrations/20261009_guest_intent_recovery.sql'),'utf8');
  await db.query(recoveryMigration);
  await db.query('TRUNCATE da_guest_checkout_sessions CASCADE');
  await db.query('TRUNCATE da_guest_coverage_ops_approvals');
  await db.query(
    `INSERT INTO da_guest_coverage_ops_approvals
      (partner_slug,coverage_sha256,approved_by_ops_subject,expires_at)
      VALUES($1,$2,$3,now()+interval '1 day')`,
    ['thieyp',opsApprovalDigest,'ops_lab_authorized',],
  );
});
after(async () => {
  await db.end();
  for (const [k, v] of Object.entries(previousEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});
async function prepared() {
  const guest = await ledger.issue();
  await ledger.attachVerifiedQuote(guest.token, {
    amountCents: quote.total, currency: quote.currency, fingerprint: quote.quoteFingerprint,
  });
  await vault.seal(guest.token, quote, contact, delivery);
  return guest;
}
let counter = 0;
class FakeStripe {
  constructor() {
    this.mode = 'test';
    this.calls = 0;
    this.records = new Map();
    this.byId = new Map();
    this.dropAfterCreate = false;
    this.invalidMetadata = false;
    this.livemode = false;
    this.delayMs = 0;
    this.cancelCalls = 0;
    this.cancelThrows = false;
    this.cancelBadState = false;
  }
  async createIntent(params) {
    this.calls++;
    if (this.delayMs) await new Promise(r => setTimeout(r, this.delayMs));
    let record = this.records.get(params.idempotencyKey);
    if (record && JSON.stringify(record.params) !== JSON.stringify(params)) {
      throw new Error('mock_stripe_idempotency_parameters_differ');
    }
    if (!record) {
      const id = 'pi_p5c_lab_' + String(++counter).padStart(4, '0');
      record = {
        params: structuredClone(params),
        intent: {
          id, clientSecret: id + '_secret_testonlyabc123',
          amount: params.amount, currency: params.currency,
          status: 'requires_payment_method',
          livemode: this.livemode,
          metadata: structuredClone(params.metadata),
        },
      };
      this.records.set(params.idempotencyKey, record);
      this.byId.set(id, record);
    }
    if (this.dropAfterCreate) {
      this.dropAfterCreate = false;
      throw new Error('simulated_socket_drop_after_stripe_creation');
    }
    const returned = structuredClone(record.intent);
    if (this.invalidMetadata) returned.metadata.orderId = 'DA-G-forgery';
    return returned;
  }
  async getIntent(id) {
    const found = this.byId.get(id);
    if (!found) throw new Error('fake_stripe_intent_not_found');
    return structuredClone(found.intent);
  }
  async cancelIntent(id) {
    this.cancelCalls++;
    const found=this.byId.get(id);
    if (!found) throw new Error('fake_stripe_intent_not_found');
    if (this.cancelThrows) throw new Error('fake_stripe_cancel_timeout');
    if (found.intent.status !== 'requires_payment_method') {
      throw new Error('fake_stripe_intent_not_cancellable');
    }
    if (!this.cancelBadState) found.intent.status='canceled';
    return structuredClone(found.intent);
  }
}
function builder(fake = new FakeStripe(), sql = db, coverage = liveCoverage) {
  return { fake,
    service: new GuestStripeIntentReservation(
      sql, fake, capKey, vault, coverage,
    ) };
}
test('one test-mode Stripe Intent bound to one verified encrypted guest checkout', async () => {
  const guest = await prepared();
  const { fake, service } = builder();
  const result = await service.start(guest.token);
  assert.equal(result.state, 'created');
  assert.equal(result.orderId, guest.orderId);
  assert.equal(result.amount, 2190);
  assert.equal(result.currency, 'eur');
  assert.equal(fake.calls, 1);
  const record = [...fake.records.values()][0];
  assert.equal(record.params.metadata.clientIssuer, 'urn:delishafrica:guest-checkout:v1');
  assert.equal(record.params.metadata.orderId, guest.orderId);
  assert.equal(record.params.idempotencyKey, 'da-gc-pi-v1:' + guest.orderId);
  const pg = await db.query(
    'SELECT s.state,s.payment_intent_id,r.state AS reservation_state,r.idempotency_key FROM da_guest_checkout_sessions s JOIN da_guest_payment_intent_creation r USING(order_id) WHERE s.order_id=$1',
    [guest.orderId],
  );
  assert.equal(pg.rows[0].state, 'payment_pending');
  assert.equal(pg.rows[0].reservation_state, 'bound');
  assert.equal(pg.rows[0].payment_intent_id, result.intentId);
  assert.equal(pg.rows[0].idempotency_key, result.idempotencyKey);
});

test('repeat start after bound restores same Intent with no new Stripe create', async () => {
  const guest = await prepared();
  const { service, fake } = builder();
  const first = await service.start(guest.token);
  const second = await service.start(guest.token);
  assert.equal(first.state, 'created');
  assert.equal(second.state, 'restored');
  assert.equal(second.intentId, first.intentId);
  assert.equal(second.clientSecret, first.clientSecret);
  assert.equal(fake.calls, 1);
});

test('eight concurrent starts do not issue two Stripe Intents', async () => {
  const guest = await prepared();
  const fake = new FakeStripe();
  fake.delayMs = 40;
  const service = builder(fake).service;
  const results = await Promise.all(Array.from({ length: 8 }, () => service.start(guest.token)));
  assert.equal(results.filter(r => r.state === 'created').length, 1);
  assert.equal(fake.records.size, 1);
  assert.equal(fake.calls, 1);
  assert.ok(results.every(r => ['created', 'in_progress', 'restored'].includes(r.state)));
  const once = await db.query('SELECT count(*)::int AS n FROM da_guest_payment_intent_creation WHERE order_id=$1',
    [guest.orderId]);
  assert.equal(once.rows[0].n, 1);
});

test('lost response AFTER provider creation recovers SAME idempotency key', async () => {
  const guest = await prepared(), fake = new FakeStripe();
  fake.dropAfterCreate = true;
  const { service } = builder(fake);
  await assert.rejects(service.start(guest.token), /provider_request_uncertain/);
  assert.equal(fake.records.size, 1);
  let attempt = await db.query('SELECT state FROM da_guest_payment_intent_creation WHERE order_id=$1',
    [guest.orderId]);
  assert.equal(attempt.rows[0].state, 'creating');
  const inProgress = await service.start(guest.token);
  assert.equal(inProgress.state, 'in_progress');
  assert.equal(fake.calls, 1);
  await db.query("UPDATE da_guest_payment_intent_creation SET lease_until=now()-interval '1 second' WHERE order_id=$1",
    [guest.orderId]);
  const recovered = await service.start(guest.token);
  assert.equal(recovered.state, 'created');
  assert.equal(fake.records.size, 1);
  assert.equal(fake.calls, 2);
  const remote = [...fake.records.values()][0].intent;
  assert.equal(recovered.intentId, remote.id);
  attempt = await db.query('SELECT state,attempt_count FROM da_guest_payment_intent_creation WHERE order_id=$1',
    [guest.orderId]);
  assert.equal(attempt.rows[0].state, 'bound');
  assert.equal(attempt.rows[0].attempt_count, 2);
});

test('invalid capability is rejected before any remote provider call', async () => {
  const guest = await prepared(), { service, fake } = builder();
  await assert.rejects(service.start(guest.token + 'forged'), /capability_invalid/);
  assert.equal(fake.calls, 0);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM da_guest_payment_intent_creation WHERE order_id=$1',
    [guest.orderId])).rows[0].n, 0);
});

test('without encrypted delivery packet no reservation or Stripe request', async () => {
  const guest = await ledger.issue();
  await ledger.attachVerifiedQuote(guest.token, {
    amountCents: quote.total, currency: quote.currency, fingerprint: quote.quoteFingerprint,
  });
  const { service, fake } = builder();
  await assert.rejects(service.start(guest.token), /delivery_missing/);
  assert.equal(fake.calls, 0);
});

test('Stripe mismatched metadata or livemode refuse binding and return no secret', async () => {
  for (const broken of ['metadata', 'livemode']) {
    const guest = await prepared(), fake = new FakeStripe();
    if (broken === 'metadata') fake.invalidMetadata = true;
    else fake.livemode = true;
    const { service } = builder(fake);
    await assert.rejects(service.start(guest.token), /invalid|mismatch/);
    const row = await db.query(
      'SELECT state,payment_intent_id FROM da_guest_checkout_sessions WHERE order_id=$1',
      [guest.orderId]);
    assert.equal(row.rows[0].state, 'quoted');
    assert.equal(row.rows[0].payment_intent_id, null);
    assert.equal(fake.records.size, 1);
  }
});

test('production and disabled test feature flags always fail closed', async () => {
  const guest = await prepared();
  const { service, fake } = builder();
  process.env.NODE_ENV = 'production';
  await assert.rejects(service.start(guest.token), /creation_disabled/);
  process.env.NODE_ENV = 'test';
  process.env.DA_GUEST_STRIPE_TEST_ONLY = '0';
  await assert.rejects(service.start(guest.token), /creation_disabled/);
  process.env.DA_GUEST_STRIPE_TEST_ONLY = '1';
  assert.equal(fake.calls, 0);
});

test('a Stripe Intent already progressed cannot re-open payment sheet', async () => {
  const guest = await prepared(), fake = new FakeStripe();
  const { service } = builder(fake);
  const one = await service.start(guest.token);
  fake.byId.get(one.intentId).intent.status = 'succeeded';
  await assert.rejects(service.start(guest.token), /progressed_reconcile/);
  assert.equal(fake.calls, 1);
});

test('Ops revocation between quote and Stripe denies before remote call', async () => {
  const guest = await prepared();
  await db.query('UPDATE da_guest_coverage_ops_approvals SET revoked_at=now() WHERE partner_slug=$1', ['thieyp']);
  try {
    const { service, fake } = builder();
    await assert.rejects(service.start(guest.token), /delivery_authorization_denied/);
    assert.equal(fake.calls, 0);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM da_guest_payment_intent_creation WHERE order_id=$1',
      [guest.orderId])).rows[0].n, 0);
  } finally {
    await db.query('UPDATE da_guest_coverage_ops_approvals SET revoked_at=NULL WHERE partner_slug=$1', ['thieyp']);
  }
});

test('approval revision drift cannot be smuggled in an old sealed checkout', async () => {
  const guest = await prepared();
  merchant.delivery.guestCheckoutCoverage = {
    ...coverageContract, revision: 2,
  };
  try {
    const { service, fake } = builder();
    await assert.rejects(service.start(guest.token), /delivery_authorization_denied/);
    assert.equal(fake.calls, 0);
  } finally {
    merchant.delivery.guestCheckoutCoverage = coverageContract;
  }
});

test('missing original Google proof denies Stripe even when private vault exists', async () => {
  const guest = await ledger.issue();
  await ledger.attachVerifiedQuote(guest.token, {
    amountCents: quote.total, currency: quote.currency, fingerprint: quote.quoteFingerprint,
  });
  await vault.seal(guest.token, quote, contact, {
    verifiedByServer: true, eligible: true, serviceAreaCode: 'be-brussels-pilot',
  });
  const { service, fake } = builder();
  await assert.rejects(service.start(guest.token), /verified_location_missing/);
  assert.equal(fake.calls, 0);
});

test('revocation while Stripe IO is in flight withholds clientSecret and DB binding', async () => {
  const guest = await prepared();
  class RevokeMidFlight extends FakeStripe {
    async createIntent(params) {
      const remote = await super.createIntent(params);
      await db.query('UPDATE da_guest_coverage_ops_approvals SET revoked_at=now() WHERE partner_slug=$1',
        ['thieyp']);
      return remote;
    }
  }
  const fake = new RevokeMidFlight();
  try {
    await assert.rejects(builder(fake).service.start(guest.token), /delivery_authorization_denied/);
    assert.equal(fake.calls, 1);
    const record = await db.query(
      'SELECT state,payment_intent_id FROM da_guest_checkout_sessions WHERE order_id=$1',
      [guest.orderId],
    );
    assert.equal(record.rows[0].state, 'quoted');
    assert.equal(record.rows[0].payment_intent_id, null);
  } finally {
    await db.query('UPDATE da_guest_coverage_ops_approvals SET revoked_at=NULL WHERE partner_slug=$1',
      ['thieyp']);
  }
});

test('zone reduction before Stripe request fails even with unchanged postcode', async () => {
  const guest = await prepared();
  const altered = { ...coverageContract, revision: 2,
    zones: [{ ...coverageContract.zones[0], maxDistanceMeters: 100,
      center: { latitude: 50.89, longitude: 4.37 } }],
  };
  merchant.delivery.guestCheckoutCoverage = altered;
  try {
    const { service, fake } = builder();
    await assert.rejects(service.start(guest.token), /delivery_authorization_denied/);
    assert.equal(fake.calls, 0);
  } finally {
    merchant.delivery.guestCheckoutCoverage = coverageContract;
  }
});

test('Ops registry outage fails closed before Stripe request', async () => {
  const guest = await prepared();
  const down = new GuestMerchantCoverageStrict(
    { async findPublishedBySlug() { return merchant; } },
    { async isApproved() { throw new Error('ops_database_offline'); } },
  );
  const {service,fake} = builder(new FakeStripe(),db,down);
  await assert.rejects(service.start(guest.token), /delivery_authorization_denied/);
  assert.equal(fake.calls,0);
});

test('Ops revoked after DB reservation but before Stripe IO blocks creation', async () => {
  const guest = await prepared();
  let revoked = false;
  const racingDb = {
    async query(sql, params) {
      const result = await db.query(sql, params);
      if (!revoked && sql.includes('INSERT INTO da_guest_payment_intent_creation') &&
          result.rowCount === 1) {
        revoked = true;
        await db.query('UPDATE da_guest_coverage_ops_approvals SET revoked_at=now() WHERE partner_slug=$1',
          ['thieyp']);
      }
      return result;
    },
    connect: () => db.connect(),
  };
  const {service,fake} = builder(new FakeStripe(),racingDb);
  try {
    await assert.rejects(service.start(guest.token), /delivery_authorization_denied/);
    assert.equal(revoked,true);
    assert.equal(fake.calls,0);
    assert.equal((await db.query('SELECT state FROM da_guest_payment_intent_creation WHERE order_id=$1',
      [guest.orderId])).rows[0].state,'creating');
  } finally {
    await db.query('UPDATE da_guest_coverage_ops_approvals SET revoked_at=NULL WHERE partner_slug=$1',
      ['thieyp']);
  }
});

test('a previously created Stripe secret is never reissued after Ops revocation', async () => {
  const guest = await prepared();
  const {service,fake} = builder();
  const first = await service.start(guest.token);
  assert.equal(first.state,'created');
  await db.query('UPDATE da_guest_coverage_ops_approvals SET revoked_at=now() WHERE partner_slug=$1',
    ['thieyp']);
  try {
    await assert.rejects(service.start(guest.token), /delivery_authorization_denied/);
    assert.equal(fake.calls,1);
  } finally {
    await db.query('UPDATE da_guest_coverage_ops_approvals SET revoked_at=NULL WHERE partner_slug=$1',
      ['thieyp']);
  }
});

test('expired independent Ops approval blocks payment creation', async () => {
  const guest = await prepared();
  await db.query(
    "UPDATE da_guest_coverage_ops_approvals SET approved_at=now()-interval '2 days', expires_at=now()-interval '1 day' WHERE partner_slug=$1",
    ['thieyp'],
  );
  try {
    const {service,fake}=builder();
    await assert.rejects(service.start(guest.token), /delivery_authorization_denied/);
    assert.equal(fake.calls,0);
  } finally {
    await db.query(
      "UPDATE da_guest_coverage_ops_approvals SET approved_at=now(),expires_at=now()+interval '1 day' WHERE partner_slug=$1",
      ['thieyp'],
    );
  }
});

test('server catalog + Google Places staging hands a sealed guest order safely to Stripe test', async () => {
  const {GuestCanonicalCheckoutStager} =
    require('../src/guest-checkout/guest-canonical-checkout-stager.ts');
  const guest=await ledger.issue();
  const places={
    async resolve({placeId}) {
      assert.equal(placeId,'googleplace_test001');
      return {
        ok:true,status:'confirmed',
        address:{
          placeId,formattedAddress:'12 Rue du Laboratoire, 1050 Ixelles, Belgique',
          latitude:50.8300,longitude:4.3700,precision:'street_number',
          deliverable:true,evidence:'google_places_new',
        },
        territory:{countryCode:'BE',postalCode:'1050',city:'Ixelles'},
      };
    },
  };
  const policy={
    async quote(cart) {
      assert.equal(cart.partnerSlug,'thieyp');
      assert.deepEqual(cart.items,[{id:'sku_lab1',quantity:1}]);
      assert.equal(Object.hasOwn(cart,'amount'),false);
      return quote;
    },
  };
  const stager=new GuestCanonicalCheckoutStager(
    ledger,vault,policy,places,liveCoverage,
  );
  const staged=await stager.prepare(guest.token,{
    cart:{partnerSlug:'thieyp',items:[{id:'sku_lab1',quantity:1}],amount:1},
    deliveryPlaceId:'googleplace_test001',
    contact:{...contact,address:'Untrusted 1, Paris',city:'Paris'},
  },'guest_lab_requester');
  assert.equal(staged.amountCents,2190);
  assert.equal(staged.paymentAvailable,false);
  const proof=await vault.readTrustedDeliveryForPayment(guest.token);
  assert.equal(proof.locationProof.postalCode,'1050');
  assert.equal(proof.serviceAreaCode,'be-brussels-pilot');
  const {service,fake}=builder();
  const created=await service.start(guest.token);
  assert.equal(created.state,'created');
  assert.equal(created.amount,2190);
  assert.equal(fake.calls,1);
});

test('P5D Ops revocation after remote creation cancels the only Intent and seals terminal reservation',async()=>{
  const guest=await prepared();
  class RevokedDuringProvider extends FakeStripe {
    async createIntent(params){
      const returned=await super.createIntent(params);
      await db.query('UPDATE da_guest_coverage_ops_approvals SET revoked_at=now() WHERE partner_slug=$1',['thieyp']);
      return returned;
    }
  }
  const fake=new RevokedDuringProvider();
  try {
    await assert.rejects(builder(fake).service.start(guest.token),/delivery_authorization_denied/);
    const row=await db.query('SELECT state,stripe_intent_id,reconciliation_reason FROM da_guest_payment_intent_creation WHERE order_id=$1',[guest.orderId]);
    assert.equal(row.rows[0].state,'cancelled');
    assert.equal(row.rows[0].reconciliation_reason,'coverage_revoked_after_create');
    assert.equal(fake.cancelCalls,1);
    assert.equal(fake.byId.get(row.rows[0].stripe_intent_id).intent.status,'canceled');
    await assert.rejects(builder(fake).service.start(guest.token),/delivery_authorization_denied/);
    assert.equal(fake.calls,1);
  } finally {
    await db.query('UPDATE da_guest_coverage_ops_approvals SET revoked_at=NULL WHERE partner_slug=$1',['thieyp']);
  }
  await assert.rejects(builder(fake).service.start(guest.token),/cancelled_new_quote_required/);
  assert.equal(fake.calls,1);
});

test('P5D cancellation timeout quarantines Intent for Ops manual reconciliation',async()=>{
  const guest=await prepared();
  class RevokedDuringProvider extends FakeStripe {
    async createIntent(params){
      const r=await super.createIntent(params);
      await db.query('UPDATE da_guest_coverage_ops_approvals SET revoked_at=now() WHERE partner_slug=$1',['thieyp']);
      return r;
    }
  }
  const fake=new RevokedDuringProvider();
  fake.cancelThrows=true;
  try {
    await assert.rejects(builder(fake).service.start(guest.token),/delivery_authorization_denied/);
    const state=await db.query('SELECT state,reconciliation_reason FROM da_guest_payment_intent_creation WHERE order_id=$1',[guest.orderId]);
    assert.equal(state.rows[0].state,'review_required');
    assert.equal(state.rows[0].reconciliation_reason,'cancel_failed');
    assert.equal(fake.cancelCalls,1);
  } finally {
    await db.query('UPDATE da_guest_coverage_ops_approvals SET revoked_at=NULL WHERE partner_slug=$1',['thieyp']);
  }
  await assert.rejects(builder(fake).service.start(guest.token),/manual_reconciliation_required/);
  assert.equal(fake.calls,1);
});

test('P5D Stripe noncancellable state cannot be marked cancelled',async()=>{
  const guest=await prepared();
  class ChangedState extends FakeStripe {
    async createIntent(params){
      const result=await super.createIntent(params);
      await db.query('UPDATE da_guest_coverage_ops_approvals SET revoked_at=now() WHERE partner_slug=$1',['thieyp']);
      return result;
    }
  }
  const fake=new ChangedState();fake.cancelBadState=true;
  try {
    await assert.rejects(builder(fake).service.start(guest.token),/delivery_authorization_denied/);
    const st=await db.query('SELECT state,reconciliation_reason FROM da_guest_payment_intent_creation WHERE order_id=$1',[guest.orderId]);
    assert.equal(st.rows[0].state,'review_required');
    assert.equal(st.rows[0].reconciliation_reason,'cancel_failed');
    assert.equal(fake.cancelCalls,1);
  } finally {
    await db.query('UPDATE da_guest_coverage_ops_approvals SET revoked_at=NULL WHERE partner_slug=$1',['thieyp']);
  }
});

test('P5D DB binding failure rolls back ledger and cancels provider under active fence',async()=>{
  const guest=await prepared(),fake=new FakeStripe();
  let injected=false;
  const failing={
    connect:async()=>{
      const original=await db.connect();
      return {
        release:()=>original.release(),
        async query(query,args) {
          if (!injected && typeof query==='string' && query.includes("UPDATE da_guest_checkout_sessions") &&
              query.includes("payment_intent_id=$2")) {
            injected=true;throw Error('p5d_simulated_pg_write_rejected');
          }
          return original.query(query,args);
        },
      };
    },
    query:(sql,args)=>db.query(sql,args),
  };
  await assert.rejects(builder(fake,failing).service.start(guest.token),/binding_reconciliation_required/);
  assert.equal(injected,true);
  assert.equal(fake.calls,1);
  assert.equal(fake.cancelCalls,1);
  assert.equal((await db.query('SELECT state FROM da_guest_payment_intent_creation WHERE order_id=$1',[guest.orderId])).rows[0].state,'cancelled');
  const ledgerRow=await db.query('SELECT state,payment_intent_id FROM da_guest_checkout_sessions WHERE order_id=$1',[guest.orderId]);
  assert.equal(ledgerRow.rows[0].state,'quoted');
  assert.equal(ledgerRow.rows[0].payment_intent_id,null);
});

test('P5D uncertain COMMIT outcome never automatically cancels a possibly bound payment',async()=>{
  const guest=await prepared(),fake=new FakeStripe();
  let simulated=false;
  const uncertain={
    query:(sql,args)=>db.query(sql,args),
    async connect(){
      const conn=await db.connect();
      return {
        release:()=>conn.release(),
        async query(sql,args){
          if (!simulated && sql==='COMMIT') {
            simulated=true;throw Error('p5d_network_lost_before_commit_acknowledgement');
          }
          return conn.query(sql,args);
        },
      };
    },
  };
  await assert.rejects(builder(fake,uncertain).service.start(guest.token),/binding_reconciliation_required/);
  assert.equal(simulated,true);
  assert.equal(fake.cancelCalls,0);
  const row=await db.query('SELECT state,reconciliation_reason FROM da_guest_payment_intent_creation WHERE order_id=$1',[guest.orderId]);
  assert.equal(row.rows[0].state,'review_required');
  assert.equal(row.rows[0].reconciliation_reason,'commit_outcome_uncertain');
});

test('P5D Stripe response metadata mismatch quarantines without cancelling an untrusted remote ID',async()=>{
  const guest=await prepared(),fake=new FakeStripe();
  fake.invalidMetadata=true;
  await assert.rejects(builder(fake).service.start(guest.token),/intent_invalid/);
  assert.equal(fake.cancelCalls,0);
  const row=await db.query('SELECT state,reconciliation_reason FROM da_guest_payment_intent_creation WHERE order_id=$1',[guest.orderId]);
  assert.equal(row.rows[0].state,'review_required');
  assert.equal(row.rows[0].reconciliation_reason,'provider_response_invalid');
});

test('P5D lost response after 24h cannot re-issue a Stripe Intent with forgotten key',async()=>{
  const guest=await prepared(),fake=new FakeStripe();
  fake.dropAfterCreate=true;
  await assert.rejects(builder(fake).service.start(guest.token),/provider_request_uncertain/);
  assert.equal(fake.calls,1);
  assert.equal(fake.records.size,1);
  await db.query(
    "UPDATE da_guest_payment_intent_creation SET created_at=now()-interval '24 hours',lease_until=now()-interval '1 second' WHERE order_id=$1",
    [guest.orderId],
  );
  await assert.rejects(builder(fake).service.start(guest.token),/manual_reconciliation_required/);
  assert.equal(fake.calls,1);
  const row=await db.query('SELECT state,reconciliation_reason FROM da_guest_payment_intent_creation WHERE order_id=$1',[guest.orderId]);
  assert.equal(row.rows[0].state,'review_required');
  assert.equal(row.rows[0].reconciliation_reason,'idempotency_window_expired');
});

test('P5D malicious competing lease cannot cancel another worker potentially binding the Intent',async()=>{
  const guest=await prepared(),fake=new FakeStripe();
  class FencingStripe extends FakeStripe {
    async createIntent(params){
      const returned=await super.createIntent(params);
      await db.query("UPDATE da_guest_payment_intent_creation SET lease_owner=$2 WHERE order_id=$1",
        [guest.orderId,'c'.repeat(32)]);
      await db.query('UPDATE da_guest_coverage_ops_approvals SET revoked_at=now() WHERE partner_slug=$1',['thieyp']);
      return returned;
    }
  }
  const racing=new FencingStripe();
  try {
    await assert.rejects(builder(racing).service.start(guest.token),/manual_reconciliation_required/);
    assert.equal(racing.cancelCalls,0);
    const row=await db.query('SELECT state,lease_owner FROM da_guest_payment_intent_creation WHERE order_id=$1',[guest.orderId]);
    assert.equal(row.rows[0].state,'creating');
    assert.equal(row.rows[0].lease_owner,'c'.repeat(32));
  } finally {
    await db.query('UPDATE da_guest_coverage_ops_approvals SET revoked_at=NULL WHERE partner_slug=$1',['thieyp']);
  }
});


test('P5D PostgreSQL connection loss AFTER provider response retains one safe key for retry',async()=>{
  const guest=await prepared(),fake=new FakeStripe();
  let offline=true;
  const wrapped={
    query:(sql,args)=>db.query(sql,args),
    async connect(){
      if(offline){offline=false;throw Error('p5d_connection_lost_after_stripe_response')}
      return db.connect();
    },
  };
  await assert.rejects(builder(fake,wrapped).service.start(guest.token),/database_unavailable_reconciliation_pending/);
  assert.equal(fake.calls,1);
  assert.equal(fake.cancelCalls,0);
  assert.equal(fake.records.size,1);
  const left=await db.query('SELECT state,idempotency_key FROM da_guest_payment_intent_creation WHERE order_id=$1',[guest.orderId]);
  assert.equal(left.rows[0].state,'creating');
  await db.query("UPDATE da_guest_payment_intent_creation SET lease_until=now()-interval '1 second' WHERE order_id=$1",[guest.orderId]);
  const resumed=await builder(fake).service.start(guest.token);
  assert.equal(resumed.state,'created');
  assert.equal(resumed.idempotencyKey,left.rows[0].idempotency_key);
  assert.equal(fake.records.size,1);
  assert.equal(fake.calls,2);
});

test('P5D lost COMMIT ACK after successful PG COMMIT never cancels already bound Intent',async()=>{
  const guest=await prepared(),fake=new FakeStripe();
  let lost=false;
  const wrapper={
    query:(sql,args)=>db.query(sql,args),
    async connect(){
      const pg=await db.connect();
      return {
        release:()=>pg.release(),
        async query(sql,args){
          const reply=await pg.query(sql,args);
          if(!lost && sql==='COMMIT'){
            lost=true;
            throw Error('p5d_commit_success_but_ack_lost');
          }
          return reply;
        },
      };
    },
  };
  await assert.rejects(builder(fake,wrapper).service.start(guest.token),/manual_reconciliation_required/);
  assert.equal(lost,true);
  assert.equal(fake.cancelCalls,0);
  assert.equal(fake.calls,1);
  const record=await db.query(
    'SELECT s.state AS order_state,s.payment_intent_id,r.state AS reserve_state FROM da_guest_checkout_sessions s JOIN da_guest_payment_intent_creation r USING(order_id) WHERE s.order_id=$1',
    [guest.orderId],
  );
  assert.equal(record.rows[0].order_state,'payment_pending');
  assert.equal(record.rows[0].reserve_state,'bound');
  const safe=await builder(fake).service.start(guest.token);
  assert.equal(safe.state,'restored');
  assert.equal(safe.intentId,record.rows[0].payment_intent_id);
  assert.equal(fake.calls,1);
});

test('P5D idempotency expiry refuses IO even while another lease remains active',async()=>{
  const guest=await prepared(),fake=new FakeStripe();
  fake.dropAfterCreate=true;
  await assert.rejects(builder(fake).service.start(guest.token),/provider_request_uncertain/);
  await db.query(
    "UPDATE da_guest_payment_intent_creation SET created_at=now()-interval '24 hours',lease_until=now()+interval '10 minutes' WHERE order_id=$1",
    [guest.orderId],
  );
  await assert.rejects(builder(fake).service.start(guest.token),/manual_reconciliation_required/);
  assert.equal(fake.calls,1);
  assert.equal((await db.query('SELECT state FROM da_guest_payment_intent_creation WHERE order_id=$1',[guest.orderId])).rows[0].state,'creating');
  await db.query("UPDATE da_guest_payment_intent_creation SET lease_until=now()-interval '1 second' WHERE order_id=$1",[guest.orderId]);
  await assert.rejects(builder(fake).service.start(guest.token),/manual_reconciliation_required/);
  assert.equal((await db.query('SELECT state FROM da_guest_payment_intent_creation WHERE order_id=$1',[guest.orderId])).rows[0].state,'review_required');
  assert.equal(fake.calls,1);
});
