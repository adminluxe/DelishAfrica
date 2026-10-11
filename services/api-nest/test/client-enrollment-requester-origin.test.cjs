'use strict';
/**
 * Security regression: rate-limit origins cannot come from headers supplied by
 * arbitrary callers. End-to-end HTTPS/proxy behavior remains a deployment gate.
 */
require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { trustedRequesterPeer } = require('../src/identity-proof/trusted-requester-peer');
const { IdentityProofController } = require('../src/identity-proof/identity-proof.controller');
const { ClientEnrollmentController } = require('../src/client-enrollment/client-enrollment.controller');

function fakeRequest(headers = {}, address = '198.51.100.41') {
  return { headers, ip: '203.0.113.99', socket: { remoteAddress: address } };
}

test('trustedRequesterPeer ignores caller-supplied X-Forwarded-For and Cloudflare headers', () => {
  const spoof = fakeRequest({
    'x-forwarded-for': '8.8.8.8, 9.9.9.9',
    'cf-connecting-ip': '192.0.2.250',
    'x-real-ip': '1.1.1.1',
  });
  assert.equal(trustedRequesterPeer(spoof), 'ip:198.51.100.41');
  assert.equal(trustedRequesterPeer(fakeRequest({}, '198.51.100.41')),
    trustedRequesterPeer(spoof));
  assert.notEqual(trustedRequesterPeer(fakeRequest({}, '198.51.100.42')),
    trustedRequesterPeer(spoof));
});

test('trustedRequesterPeer canonicalizes mapped IPv4 and supports IPv6', () => {
  assert.equal(trustedRequesterPeer(fakeRequest({}, '::ffff:192.0.2.42')),
    'ip:192.0.2.42');
  assert.equal(trustedRequesterPeer(fakeRequest({}, '2001:db8::1')),
    'ip:2001:db8::1');
  assert.equal(trustedRequesterPeer(fakeRequest({}, 'not-an-address')), 'ip:unknown');
  assert.equal(trustedRequesterPeer({ headers: { 'x-forwarded-for': '8.8.8.8' } }),
    'ip:unknown');
  assert.equal(trustedRequesterPeer(null), 'ip:unknown');
});

test('verification start, check and attest share the exact same trusted rate-limit origin', async () => {
  const calls = [];
  const proof = {
    start: async (_body, peer) => { calls.push(['start', peer]); return { ok: true }; },
    check: async (_body, peer) => { calls.push(['check', peer]); return { ok: true }; },
    attest: (_body, peer) => { calls.push(['attest', peer]); return { valid: true }; },
    health: () => ({ ok: true }),
  };
  const controller = new IdentityProofController(proof);
  const request = fakeRequest({
    'cf-connecting-ip': '203.0.113.200',
    'x-forwarded-for': '203.0.113.201',
  }, '::ffff:198.51.100.41');
  await controller.start({ channel: 'sms' }, request);
  await controller.check({ channel: 'sms' }, request);
  controller.attest({ channel: 'sms' }, request);
  assert.deepEqual(calls, [
    ['start', 'ip:198.51.100.41'],
    ['check', 'ip:198.51.100.41'],
    ['attest', 'ip:198.51.100.41'],
  ]);
});

test('Client registration uses the SAME peer key and never the spoofed req.ip', async () => {
  const requests = [];
  const enrollment = {
    register: async (_body, peer) => { requests.push(peer); return { ok: false }; },
    readiness: () => ({ enabled: false }),
  };
  const controller = new ClientEnrollmentController(enrollment);
  const input = fakeRequest({
    'cf-connecting-ip': '203.0.113.200',
    'x-forwarded-for': '203.0.113.201',
  }, '::ffff:198.51.100.41');
  await controller.register({}, input);
  assert.deepEqual(requests, ['ip:198.51.100.41']);
  assert.deepEqual(controller.readiness(), { enabled: false });
});

test('rate-limit identifier is deterministic across spoofed-header variations', async () => {
  const headersA = { 'x-forwarded-for': '192.0.2.1', 'cf-connecting-ip': '192.0.2.1' };
  const headersB = { 'x-forwarded-for': '192.0.2.2', 'cf-connecting-ip': '192.0.2.2' };
  assert.equal(trustedRequesterPeer(fakeRequest(headersA, '10.0.0.19')),
    trustedRequesterPeer(fakeRequest(headersB, '10.0.0.19')));
});
