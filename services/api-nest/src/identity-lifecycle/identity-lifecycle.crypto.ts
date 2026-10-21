import * as crypto from 'crypto';
import * as fs from 'fs';

const PURPOSE = 'delishafrica|identity-lifecycle|v1';

function rootSecret(): Buffer {
  const explicit = String(process.env.DA_AUTH_SECRET || '').trim();
  if (explicit) return Buffer.from(explicit, 'utf8');

  const filePath = String(
    process.env.DA_AUTH_SECRET_FILE || '/run/secrets/delishafrica-auth-secret',
  ).trim();
  const value = fs.readFileSync(filePath, 'utf8').trim();
  if (!value) throw new Error('identity_lifecycle_secret_unavailable');
  return Buffer.from(value, 'utf8');
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
