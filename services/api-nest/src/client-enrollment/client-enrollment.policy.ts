import { createHmac } from 'node:crypto';

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
    Boolean(env.DA_CLIENT_ENROLLMENT_KC_BASE_URL && /^https?:\/\//.test(env.DA_CLIENT_ENROLLMENT_KC_BASE_URL)) &&
    env.DA_CLIENT_ENROLLMENT_KC_CLIENT_ID === 'delishafrica-client-enrollment' &&
    Boolean(env.DA_CLIENT_ENROLLMENT_KC_CLIENT_SECRET) &&
    env.DA_CLIENT_ENROLLMENT_SECURITY_GATE === 'APPROVED_AFTER_REVIEW' &&
    env.DA_CLIENT_ENROLLMENT_AUTHZ_GATE === 'PROD_KC2681_FGAP_GROUP_CLIENT_ONLY_PASS' &&
    env.DA_CLIENT_ENROLLMENT_RECOVERY_GATE === 'EMAIL_PASSWORD_RECOVERY_LIVE_VERIFIED';
}
