import { createHmac, timingSafeEqual } from 'node:crypto';

export type ClientEnrollmentCommand = {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  password: string;
  emailProofToken: string;
  smsProofToken: string;
  requestId: string;
};

const E164 = /^\+[1-9]\d{7,14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROOF = /^[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{30,}$/;
const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function value(input: unknown, max: number): string {
  if (typeof input !== 'string' || input.length > max) return '';
  return input.trim();
}

export function parseClientEnrollmentCommand(input: Record<string, unknown>): ClientEnrollmentCommand | null {
  const email = value(input.email, 254).toLowerCase();
  const phone = value(input.phone, 24).replace(/[\s()-]/g, '');
  const firstName = value(input.firstName, 100).replace(/\s+/g, ' ');
  const lastName = value(input.lastName, 100).replace(/\s+/g, ' ');
  const password = typeof input.password === 'string' ? input.password : '';
  const emailProofToken = value(input.emailProofToken, 4096);
  const smsProofToken = value(input.smsProofToken, 4096);
  const requestId = value(input.requestId, 80);
  if (
    !EMAIL.test(email) || !E164.test(phone) ||
    firstName.length < 1 || firstName.length > 80 || lastName.length > 80 ||
    /[\u0000-\u001f\u007f<>]/.test(firstName + lastName) ||
    password.length < 12 || password.length > 128 ||
    !/\p{L}/u.test(password) || !/[0-9\p{P}\p{S}]/u.test(password) ||
    password.includes('\u0000') ||
    !PROOF.test(emailProofToken) || !PROOF.test(smsProofToken) ||
    !REQUEST_ID.test(requestId) ||
    input.acceptTerms !== true
  ) return null;
  return {
    email, phone, firstName, lastName, password,
    emailProofToken, smsProofToken, requestId,
  };
}

export function enrollmentHmac(secret: string, label: string, value: string): string {
  if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('enrollment_hmac_key_missing');
  }
  return createHmac('sha256', secret).update(label).update('\u0000').update(value).digest('hex');
}

export function enrollmentReadyForProduction(env: NodeJS.ProcessEnv): boolean {
  return env.DA_CLIENT_ENROLLMENT_ENABLED === 'true' &&
    Boolean(env.DATABASE_URL) &&
    Boolean(env.DA_CLIENT_ENROLLMENT_HMAC_SECRET && Buffer.byteLength(env.DA_CLIENT_ENROLLMENT_HMAC_SECRET, 'utf8') >= 32) &&
    env.DA_CLIENT_ENROLLMENT_KC_BASE_URL === 'http://afritaste-keycloak:8080/' &&
    env.DA_CLIENT_ENROLLMENT_KC_CLIENT_ID === 'delishafrica-client-enrollment' &&
    Boolean(env.DA_CLIENT_ENROLLMENT_KC_CLIENT_SECRET) &&
    env.DA_CLIENT_ENROLLMENT_SECURITY_GATE === 'APPROVED_AFTER_REVIEW' &&
    // Independent human-reviewed gates: successful password recovery delivery
    // and verified *negative* FGAP tests, not merely a healthy OIDC issuer.
    env.DA_CLIENT_ENROLLMENT_RECOVERY_GATE === 'SMTP_RESET_TESTED' &&
    env.DA_CLIENT_ENROLLMENT_AUTHZ_GATE === 'FGAP_NEGATIVE_TESTS_PASSED' &&
    // Only the reviewed Nginx/Cloudflare X-Real-IP ingress is eligible;
    // direct socket mode would collapse public clients into one rate-limit key.
    env.DA_CLIENT_ENROLLMENT_TRUSTED_INGRESS_MODE === 'NGINX_REALIP_ON_LOOPBACK_VERIFIED';
}

// PRIVATE QA COHORT. Default OFF; no unscoped public enrollment may be
// enabled through this path. All upstream recovery, FGAP, DB and trusted-ingress
// gates remain mandatory. The operator provides only purpose-separated HMACs
// of explicitly authorized, verified test email addresses (never raw emails).
const QA_HMAC = /^[0-9a-f]{64}$/;
const QA_MAX_EMAILS = 5;
const QA_MAX_WINDOW_MS = 24 * 60 * 60 * 1000;

function qaHashes(env: NodeJS.ProcessEnv): string[] | null {
  const raw = env.DA_CLIENT_ENROLLMENT_QA_EMAIL_HMACS;
  if (!raw || raw.length > QA_MAX_EMAILS * 65) return null;
  const hashes = raw.split(',');
  if (
    hashes.length < 1 || hashes.length > QA_MAX_EMAILS ||
    hashes.some((hash) => !QA_HMAC.test(hash)) ||
    new Set(hashes).size !== hashes.length
  ) return null;
  return hashes;
}

export function clientEnrollmentQaConfigured(
  env: NodeJS.ProcessEnv,
  nowMs: number = Date.now(),
): boolean {
  if (
    env.DA_CLIENT_ENROLLMENT_ENABLED !== 'false' ||
    env.DA_CLIENT_ENROLLMENT_QA_ENABLED !== 'true' ||
    env.DA_CLIENT_ENROLLMENT_QA_MODE !== 'SCOPED_DEVICE_QA' ||
    env.DA_CLIENT_ENROLLMENT_SECURITY_GATE !== 'QA_SCOPED_APPROVED' ||
    env.DA_CLIENT_ENROLLMENT_QA_APPROVAL !== 'HUMAN_APPROVED_QA_ONLY'
  ) return false;
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) return false;
  const expiryText = env.DA_CLIENT_ENROLLMENT_QA_EXPIRES_UNIX || '';
  if (!/^\d{10}$/.test(expiryText)) return false;
  const expiryMs = Number(expiryText) * 1000;
  if (expiryMs <= nowMs || expiryMs > nowMs + QA_MAX_WINDOW_MS) return false;
  if (!qaHashes(env)) return false;

  // Reuse all substantive reviewed backend gates. Only the explicit
  // *public-enable* switch and production approval are replaced with
  // separate, QA-specific authorization above; never bypass recovery/FGAP.
  return enrollmentReadyForProduction({
    ...env,
    DA_CLIENT_ENROLLMENT_ENABLED: 'true',
    DA_CLIENT_ENROLLMENT_SECURITY_GATE: 'APPROVED_AFTER_REVIEW',
  });
}

export function clientEnrollmentQaEmailAllowed(
  env: NodeJS.ProcessEnv,
  normalizedEmail: string,
  nowMs: number = Date.now(),
): boolean {
  if (!clientEnrollmentQaConfigured(env, nowMs)) return false;
  if (typeof normalizedEmail !== 'string' || !EMAIL.test(normalizedEmail) ||
      normalizedEmail !== normalizedEmail.trim().toLowerCase()) return false;
  const hashes = qaHashes(env);
  if (!hashes) return false;
  const expected = Buffer.from(
    enrollmentHmac(env.DA_CLIENT_ENROLLMENT_HMAC_SECRET || '', 'qa-email', normalizedEmail),
    'hex',
  );
  // Timing-safe comparison avoids exposing which entry matched.
  let found = 0;
  for (const hex of hashes) {
    found |= Number(timingSafeEqual(expected, Buffer.from(hex, 'hex')));
  }
  return found === 1;
}
