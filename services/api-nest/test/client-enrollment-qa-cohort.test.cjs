/* R5Y: scoped Client QA enrollment must remain OFF unless explicitly approved.
 * Synthetic-only tests: no network, no credentials, no production writes. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  enrollmentHmac,
  enrollmentReadyForProduction,
  clientEnrollmentQaConfigured,
  clientEnrollmentQaEmailAllowed,
} = require('../src/client-enrollment/client-enrollment.policy.ts');

const NOW = 1793000000000;
const EMAIL = 'qa.client@example.org';
const HMAC_KEY = 'q'.repeat(48);
const HMAC_EMAIL = enrollmentHmac(HMAC_KEY, 'qa-email', EMAIL);

function qaEnv() {
  return {
    DATABASE_URL: 'postgres://synthetic-only',
    DA_CLIENT_ENROLLMENT_ENABLED: 'false',
    DA_CLIENT_ENROLLMENT_HMAC_SECRET: HMAC_KEY,
    DA_CLIENT_ENROLLMENT_KC_BASE_URL: 'http://afritaste-keycloak:8080/',
    DA_CLIENT_ENROLLMENT_KC_CLIENT_ID: 'delishafrica-client-enrollment',
    DA_CLIENT_ENROLLMENT_KC_CLIENT_SECRET: 'synthetic-only',
    DA_CLIENT_ENROLLMENT_SECURITY_GATE: 'QA_SCOPED_APPROVED',
    DA_CLIENT_ENROLLMENT_RECOVERY_GATE: 'SMTP_RESET_TESTED',
    DA_CLIENT_ENROLLMENT_AUTHZ_GATE: 'FGAP_NEGATIVE_TESTS_PASSED',
    DA_CLIENT_ENROLLMENT_TRUSTED_INGRESS_MODE: 'NGINX_REALIP_ON_LOOPBACK_VERIFIED',
    DA_CLIENT_ENROLLMENT_QA_ENABLED: 'true',
    DA_CLIENT_ENROLLMENT_QA_MODE: 'SCOPED_DEVICE_QA',
    DA_CLIENT_ENROLLMENT_QA_APPROVAL: 'HUMAN_APPROVED_QA_ONLY',
    DA_CLIENT_ENROLLMENT_QA_EXPIRES_UNIX: String((NOW + 10 * 60 * 1000) / 1000),
    DA_CLIENT_ENROLLMENT_QA_EMAIL_HMACS: HMAC_EMAIL,
  };
}

test('QA is OFF by default; production also stays OFF for the cohort', () => {
  assert.equal(clientEnrollmentQaConfigured({}, NOW), false);
  assert.equal(clientEnrollmentQaEmailAllowed({}, EMAIL, NOW), false);
  assert.equal(enrollmentReadyForProduction(qaEnv()), false);
  const env = qaEnv();
  assert.equal(clientEnrollmentQaConfigured(env, NOW), true);
  assert.equal(clientEnrollmentQaEmailAllowed(env, EMAIL, NOW), true);
  assert.equal(clientEnrollmentQaEmailAllowed(env, 'outsider@example.org', NOW), false);
  assert.equal(clientEnrollmentQaEmailAllowed(env, 'QA.CLIENT@example.org', NOW), false);
  assert.equal(clientEnrollmentQaEmailAllowed(env, ' ' + EMAIL, NOW), false);
});

test('QA requires the independent authorization, anti-spoof, IAM and recovery gates', () => {
  const baseline = qaEnv();
  for (const key of [
    'DA_CLIENT_ENROLLMENT_QA_ENABLED', 'DA_CLIENT_ENROLLMENT_QA_MODE',
    'DA_CLIENT_ENROLLMENT_QA_APPROVAL', 'DA_CLIENT_ENROLLMENT_SECURITY_GATE',
    'DA_CLIENT_ENROLLMENT_RECOVERY_GATE', 'DA_CLIENT_ENROLLMENT_AUTHZ_GATE',
    'DA_CLIENT_ENROLLMENT_TRUSTED_INGRESS_MODE', 'DATABASE_URL',
    'DA_CLIENT_ENROLLMENT_KC_CLIENT_SECRET', 'DA_CLIENT_ENROLLMENT_HMAC_SECRET',
  ]) {
    assert.equal(clientEnrollmentQaConfigured({ ...baseline, [key]: undefined }, NOW), false, key);
  }
  assert.equal(clientEnrollmentQaConfigured({
    ...baseline, DA_CLIENT_ENROLLMENT_ENABLED: 'true',
  }, NOW), false, 'public ENABLED must never masquerade as a QA-only cohort');
  assert.equal(clientEnrollmentQaConfigured({
    ...baseline, DA_CLIENT_ENROLLMENT_QA_APPROVAL: 'true',
  }, NOW), false);
});

test('QA automatically expires and never admits an unbounded time window', () => {
  const env = qaEnv();
  const expires = Number(env.DA_CLIENT_ENROLLMENT_QA_EXPIRES_UNIX) * 1000;
  assert.equal(clientEnrollmentQaConfigured(env, expires - 1), true);
  assert.equal(clientEnrollmentQaConfigured(env, expires), false);
  assert.equal(clientEnrollmentQaConfigured(env, expires + 1), false);
  assert.equal(clientEnrollmentQaEmailAllowed(env, EMAIL, expires + 1), false);
  assert.equal(clientEnrollmentQaConfigured({
    ...env, DA_CLIENT_ENROLLMENT_QA_EXPIRES_UNIX: String((NOW + 25 * 3600 * 1000) / 1000),
  }, NOW), false);
  assert.equal(clientEnrollmentQaConfigured({
    ...env, DA_CLIENT_ENROLLMENT_QA_EXPIRES_UNIX: 'not-a-date',
  }, NOW), false);
  assert.equal(clientEnrollmentQaConfigured(env, NaN), false);
});

test('QA HMAC allowlist rejects malformed, duplicate and oversized entries', () => {
  const env = qaEnv();
  for (const hashes of [
    '', HMAC_EMAIL.slice(1), HMAC_EMAIL.toUpperCase(), HMAC_EMAIL + ',',
    HMAC_EMAIL + ',' + HMAC_EMAIL, Array(6).fill(HMAC_EMAIL).join(','),
  ]) {
    assert.equal(clientEnrollmentQaConfigured({
      ...env, DA_CLIENT_ENROLLMENT_QA_EMAIL_HMACS: hashes,
    }, NOW), false, JSON.stringify(hashes).slice(0, 30));
  }
  const second = enrollmentHmac(HMAC_KEY, 'qa-email', 'second@example.org');
  assert.equal(clientEnrollmentQaConfigured({
    ...env, DA_CLIENT_ENROLLMENT_QA_EMAIL_HMACS: HMAC_EMAIL + ',' + second,
  }, NOW), true);
  assert.equal(clientEnrollmentQaEmailAllowed({
    ...env, DA_CLIENT_ENROLLMENT_QA_EMAIL_HMACS: HMAC_EMAIL + ',' + second,
  }, 'second@example.org', NOW), true);
});

test('QA operator can revoke immediately through the independent enable flag', () => {
  const env = qaEnv();
  assert.equal(clientEnrollmentQaEmailAllowed(env, EMAIL, NOW), true);
  assert.equal(clientEnrollmentQaEmailAllowed({
    ...env, DA_CLIENT_ENROLLMENT_QA_ENABLED: 'false',
  }, EMAIL, NOW), false);
});
