import * as crypto from 'crypto';
import * as fs from 'fs';

const PURPOSE = 'delishafrica|identity-lifecycle|v1';

function decodeKey(encoded: string): Buffer {
  try {
    const decoded = Buffer.from(encoded.trim(), 'base64url');
    if (decoded.length === 32) return decoded;
  } catch {
    // Fail closed below.
  }
  throw new Error('identity_lifecycle_secret_invalid');
}

function rootSecret(): Buffer {
  const explicit = String(process.env.DA_IDENTITY_LIFECYCLE_SECRET || '').trim();
  if (explicit) return decodeKey(explicit);

  const filePath = String(
    process.env.DA_IDENTITY_LIFECYCLE_SECRET_FILE ||
      process.env.DA_INVITATION_ENCRYPTION_KEY_FILE ||
      '/run/secrets/da-invitation-encryption-v1',
  ).trim();

  try {
    return decodeKey(fs.readFileSync(filePath, 'utf8'));
  } catch {
    throw new Error('identity_lifecycle_secret_unavailable');
  }
}

function lifecycleKey(): Buffer {
  return crypto.createHmac('sha256', rootSecret()).update(PURPOSE).digest();
}

export function identityFingerprint(input: {
  issuer: string;
  subject: string;
  role: string;
}): string {
  return crypto
    .createHmac('sha256', lifecycleKey())
    .update('identity|')
    .update(input.issuer)
    .update('|')
    .update(input.subject)
    .update('|')
    .update(input.role)
    .digest('hex');
}

export function idempotencyFingerprint(value: string): string {
  return crypto
    .createHmac('sha256', lifecycleKey())
    .update('idempotency|')
    .update(value)
    .digest('hex');
}
