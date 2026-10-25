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


test('default mode ignores X-Real-IP even when the socket is loopback', () => {
  const old=process.env.DA_CLIENT_ENROLLMENT_TRUSTED_INGRESS_MODE;
  try {
    delete process.env.DA_CLIENT_ENROLLMENT_TRUSTED_INGRESS_MODE;
    assert.equal(trustedRequesterPeer(fakeRequest({
      'x-real-ip':'198.51.100.80',
      'x-forwarded-for':'198.51.100.81',
    },'127.0.0.1')),'ip:127.0.0.1');
  } finally {
    if(old===undefined) delete process.env.DA_CLIENT_ENROLLMENT_TRUSTED_INGRESS_MODE;
    else process.env.DA_CLIENT_ENROLLMENT_TRUSTED_INGRESS_MODE=old;
  }
});

test('reviewed Nginx real-IP mode trusts only one canonical X-Real-IP on loopback', () => {
  const old=process.env.DA_CLIENT_ENROLLMENT_TRUSTED_INGRESS_MODE;
  process.env.DA_CLIENT_ENROLLMENT_TRUSTED_INGRESS_MODE='NGINX_REALIP_ON_LOOPBACK_VERIFIED';
  try {
    const fake=fakeRequest({
      'x-real-ip':'198.51.100.80',
      'cf-connecting-ip':'203.0.113.92',
      'x-forwarded-for':'8.8.8.8, 9.9.9.9',
    },'127.0.0.1');
    assert.equal(trustedRequesterPeer(fake),'ip:198.51.100.80');
    assert.equal(trustedRequesterPeer({...fake,socket:{remoteAddress:'::ffff:127.0.0.1'}}),
      'ip:198.51.100.80');
    assert.equal(trustedRequesterPeer(fakeRequest(fake.headers,'198.51.100.41')),
      'ip:198.51.100.41','non-loopback cannot forge proxy client identity');
    assert.equal(trustedRequesterPeer(fakeRequest({
      ...fake.headers,'x-real-ip':'198.51.100.1, 203.0.113.2',
    },'127.0.0.1')),'ip:unknown','chain cannot be parsed');
    assert.equal(trustedRequesterPeer(fakeRequest({
      'cf-connecting-ip':'198.51.100.80','x-forwarded-for':'198.51.100.80',
    },'127.0.0.1')),'ip:unknown','missing trusted header fails closed');
    assert.equal(trustedRequesterPeer(fakeRequest({
      'x-real-ip':['198.51.100.1','198.51.100.2'],
    },'127.0.0.1')),'ip:unknown','multi-value header fails closed');
  } finally {
    if(old===undefined) delete process.env.DA_CLIENT_ENROLLMENT_TRUSTED_INGRESS_MODE;
    else process.env.DA_CLIENT_ENROLLMENT_TRUSTED_INGRESS_MODE=old;
  }
});
