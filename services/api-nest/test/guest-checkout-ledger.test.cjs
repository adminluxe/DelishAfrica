'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomBytes } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

require.extensions['.ts'] = function (m, filename) {
  const transpiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  });
  m._compile(transpiled.outputText, filename);
};

const { GuestCheckoutLedger } = require('../src/guest-checkout/guest-checkout-ledger.ts');
const key = randomBytes(32);
const NOW = Date.UTC(2026, 9, 9, 15);

class FakePg {
  constructor() { this.rows = new Map(); this.requests = []; this.throwOnInsert = false; }
  async query(sql, args = []) {
    this.requests.push({sql, args});
    if (sql.includes('INSERT INTO da_guest_checkout_sessions')) {
      if (this.throwOnInsert) throw new Error('postgres_down');
      const [orderId, subject, mutationId, digest, expiresAt] = args;
      const duplicate = [...this.rows.values()].some(x =>
        x.order_id === orderId || x.guest_subject === subject ||
        x.mutation_id === mutationId || x.capability_sha256.equals(digest));
      if (duplicate) return {rowCount:0, rows:[]};
      this.rows.set(orderId, {
        order_id:orderId, guest_subject:subject, mutation_id:mutationId,
        capability_sha256:digest, expires_at:new Date(expiresAt), state:'issued',
        quoted_amount_cents:null, quoted_currency:null, quote_fingerprint:null,
        payment_intent_id:null,
      });
      return {rowCount:1, rows:[{order_id:orderId}]};
    }
    if (sql.includes('UPDATE da_guest_checkout_sessions')) {
      const [orderId, digest, p3, p4, p5] = args;
      const row = this.rows.get(orderId);
      if (!row || !row.capability_sha256.equals(digest) || row.expires_at <= NOW)
        return {rowCount:0, rows:[]};
      if (sql.includes("state = 'quoted'") && sql.includes("state = 'issued'")) {
        if (row.state !== 'issued') return {rowCount:0, rows:[]};
        row.state='quoted'; row.quoted_amount_cents=p3; row.quoted_currency=p4;
        row.quote_fingerprint=p5;
        return {rowCount:1,rows:[{...row}]};
      }
      if (sql.includes("state = 'payment_pending'") && sql.includes("state = 'quoted'")) {
        if (row.state !== 'quoted') return {rowCount:0,rows:[]};
        if ([...this.rows.values()].some(x => x.payment_intent_id === p3)) return {rowCount:0,rows:[]};
        row.state='payment_pending';row.payment_intent_id=p3;
        return {rowCount:1,rows:[{...row}]};
      }
    }
    if (sql.includes('SELECT ') && sql.includes('FROM da_guest_checkout_sessions')) {
      const [orderId,digest] = args;
      const row = this.rows.get(orderId);
      if (!row || !row.capability_sha256.equals(digest) || row.expires_at <= NOW)
        return {rowCount:0,rows:[]};
      return {rowCount:1,rows:[{...row}]};
    }
    throw Error('unexpected_sql_query');
  }
}

const trusted = Object.freeze({
  amountCents: 2190,
  currency:'eur',
  fingerprint:'verified_catalog_fingerprint_12345',
});

test('ledger persists only a capability digest, never token nor PII', async () => {
  const db = new FakePg(), ledger = new GuestCheckoutLedger(db, key, () => NOW);
  const minted = await ledger.issue();
  const stored = db.rows.get(minted.orderId);
  assert.ok(stored);
  assert.equal(stored.capability_sha256.length,32);
  assert.equal(JSON.stringify(stored).includes(minted.token),false);
  assert.equal(stored.email,undefined);
  assert.equal(stored.address,undefined);
  assert.equal((await ledger.findForCapability(minted.token)).state,'issued');
  assert.ok(db.requests.every(x=>x.sql.includes('$1')));
});

test('no access with a different token or forged capability', async () => {
  const db = new FakePg(), ledger = new GuestCheckoutLedger(db, key, () => NOW);
  const first = await ledger.issue();
  const second = await ledger.issue();
  assert.equal((await ledger.findForCapability(first.token)).orderId, first.orderId);
  assert.equal((await ledger.findForCapability(second.token)).orderId, second.orderId);
  await assert.rejects(ledger.findForCapability(first.token + 'x'));
  await assert.rejects(ledger.findForCapability('bearer-not-guest'));
});

test('quote and Stripe intent binding are atomic, idempotent and immutable', async () => {
  const db = new FakePg(), ledger = new GuestCheckoutLedger(db, key, () => NOW);
  const session = await ledger.issue();
  const quoteA = await ledger.attachVerifiedQuote(session.token, trusted);
  assert.equal(quoteA.state,'quoted');
  const quoteB = await ledger.attachVerifiedQuote(session.token, trusted);
  assert.deepEqual(quoteB, quoteA);
  await assert.rejects(ledger.attachVerifiedQuote(session.token,{...trusted,amountCents:9999}));
  const intent = 'pi_abc123456789';
  const bound = await ledger.bindTrustedPaymentIntent(session.token,intent);
  assert.equal(bound.state,'payment_pending');
  assert.equal(bound.paymentIntentId,intent);
  assert.deepEqual(await ledger.bindTrustedPaymentIntent(session.token,intent), bound);
  await assert.rejects(ledger.bindTrustedPaymentIntent(session.token,'pi_different998877'));
  await assert.rejects(ledger.attachVerifiedQuote(session.token,trusted));
});

test('invalid quote, wrong intent, expired token and DB outage fail closed', async () => {
  const db = new FakePg(), ledger = new GuestCheckoutLedger(db, key, () => NOW);
  await assert.rejects(ledger.bindTrustedPaymentIntent('garbage','pi_goodgood888'));
  db.throwOnInsert = true;
  await assert.rejects(ledger.issue(), /postgres_down/);
  db.throwOnInsert = false;
  const session = await ledger.issue();
  await assert.rejects(ledger.attachVerifiedQuote(session.token,{...trusted,amountCents:0}));
  await assert.rejects(ledger.attachVerifiedQuote(session.token,{...trusted,currency:'usd'}));
  await assert.rejects(ledger.attachVerifiedQuote(session.token,{...trusted,fingerprint:'bad'}));
  await assert.rejects(ledger.bindTrustedPaymentIntent(session.token,'not_a_stripe_id'));
  const expired = new GuestCheckoutLedger(db,key,()=>NOW+14401000);
  await assert.rejects(expired.findForCapability(session.token));
  await assert.rejects(expired.attachVerifiedQuote(session.token,trusted));
});

test('ledger migration declares uniqueness and avoids storing raw credentials', () => {
  const file = path.resolve(__dirname,'../../../migrations/20261009_guest_checkout_ledger.sql');
  const sql = readFileSync(file,'utf8');
  assert.match(sql,/order_id text PRIMARY KEY/);
  assert.match(sql,/mutation_id text NOT NULL UNIQUE/);
  assert.match(sql,/capability_sha256 bytea NOT NULL UNIQUE/);
  assert.match(sql,/payment_intent_id text UNIQUE/);
  assert.match(sql,/CREATE TABLE IF NOT EXISTS da_guest_checkout_sessions/);
  assert.doesNotMatch(sql,/\b(email|phone|customer_name|password|card_number)\s+(text|varchar|bytea)\b/i);
});
