import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { readFileSync } from 'fs';
import type { MerchantInvitationEncryptedValue } from './merchant-invitations.types';

const KEY_ID_RE = /^[A-Za-z0-9._:-]{3,128}$/;
const ENVELOPE_VERSION = 1;

@Injectable()
export class MerchantInvitationsCrypto {
  private readonly key: Buffer;
  private readonly keyId: string;

  constructor() {
    const filePath = String(
      process.env.DA_INVITATION_ENCRYPTION_KEY_FILE ||
        '/run/secrets/da-invitation-encryption-v1',
    ).trim();
    this.keyId = String(
      process.env.DA_INVITATION_ENCRYPTION_KEY_ID ||
        'invitation-encryption-v1',
    ).trim();

    if (!KEY_ID_RE.test(this.keyId)) {
      throw new ServiceUnavailableException({
        ok: false,
        code: 'invitation_encryption_key_id_invalid',
      });
    }

    let encoded = '';
    try {
      encoded = readFileSync(filePath, 'utf8').trim();
    } catch {
      throw new ServiceUnavailableException({
        ok: false,
        code: 'invitation_encryption_key_unavailable',
      });
    }

    let decoded: Buffer;
    try {
      decoded = Buffer.from(encoded, 'base64url');
    } catch {
      decoded = Buffer.alloc(0);
    }
    if (decoded.length !== 32) {
      throw new ServiceUnavailableException({
        ok: false,
        code: 'invitation_encryption_key_invalid',
      });
    }
    this.key = decoded;
  }

  encryptUtf8(value: string, purpose: string): MerchantInvitationEncryptedValue {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(`DA-MERCHANT-INVITATION-V1|${this.keyId}|${purpose}`, 'utf8'));
    const ciphertext = Buffer.concat([
      cipher.update(Buffer.from(value, 'utf8')),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return {
      ciphertext: Buffer.concat([
        Buffer.from([ENVELOPE_VERSION]),
        iv,
        tag,
        ciphertext,
      ]),
      keyId: this.keyId,
    };
  }

  decryptUtf8(value: Buffer, keyId: string, purpose: string): string {
    if (keyId !== this.keyId || value.length < 29 || value[0] !== ENVELOPE_VERSION) {
      throw new ServiceUnavailableException({ ok: false, code: 'invitation_ciphertext_invalid' });
    }
    try {
      const iv = value.subarray(1, 13);
      const tag = value.subarray(13, 29);
      const ciphertext = value.subarray(29);
      const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAAD(Buffer.from(`DA-MERCHANT-INVITATION-V1|${this.keyId}|${purpose}`, 'utf8'));
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch {
      throw new ServiceUnavailableException({ ok: false, code: 'invitation_ciphertext_invalid' });
    }
  }

  sha256(value: string | Buffer): string {
    return createHash('sha256').update(value).digest('hex');
  }

  getKeyId(): string {
    return this.keyId;
  }
}
