import { equal, match, notEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, createHmac } from 'node:crypto';
import {
  buildSinchApplicationRequest,
  formatSinchSmsExpiry,
  normalizeSinchVerificationExpirySeconds,
} from './provider-bridge.adapters';

test('Sinch expiry is explicit and independent from interception timeout', () => {
  equal(normalizeSinchVerificationExpirySeconds(undefined), 300);
  equal(normalizeSinchVerificationExpirySeconds(420), 420);
  equal(normalizeSinchVerificationExpirySeconds(30), 300);
  equal(formatSinchSmsExpiry(300), '00:05:00');
});

test('Application signed request matches the documented canonical contract', () => {
  const applicationKey = 'application-key';
  const secretBytes = Buffer.from('review-secret-bytes', 'utf8');
  const applicationSecret = secretBytes.toString('base64');
  const timestamp = '2026-08-06T18:00:00.000Z';
  const path = '/verification/v1/verifications';
  const payload = {
    identity: { type: 'number', endpoint: '+32470000000' },
    method: 'sms',
    smsOptions: { expiry: '00:05:00' },
    reference: 'opaque-reference',
  };
  const request = buildSinchApplicationRequest({
    method: 'POST', path, payload, applicationKey, applicationSecret, timestamp,
  });
  const md5 = createHash('md5').update(request.body, 'utf8').digest('base64');
  const stringToSign = ['POST', md5, 'application/json', `x-timestamp:${timestamp}`, path].join('\n');
  const expected = createHmac('sha256', secretBytes).update(stringToSign, 'utf8').digest('base64');
  equal(request.headers.authorization, `Application ${applicationKey}:${expected}`);
  equal(request.headers['x-timestamp'], timestamp);
  equal(request.headers['content-type'], 'application/json');
  match(request.body, /"smsOptions":\{"expiry":"00:05:00"\}/);
  notEqual(request.headers.authorization.includes(applicationSecret), true);
});
