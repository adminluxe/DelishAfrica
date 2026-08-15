import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';

@Injectable()
export class IdentityProofIdempotencyService {
  canonicalDestination(value: string): string {
    return String(value || '').trim().replace(/\s+/g, '');
  }

  hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  tokenHash(token: string): string {
    return this.hash(token);
  }

  canonicalKey(channel: string, role: string, destination: string): string {
    return [channel, role, this.hash(this.canonicalDestination(destination))].join(':');
  }

  normalizeClientRequestId(value: unknown): string {
    const normalized = String(value || '').trim();
    return /^[A-Za-z0-9._:-]{12,160}$/.test(normalized) ? normalized : randomUUID();
  }

  customerReference(clientRequestId: string, canonicalKey: string): string {
    return `da-${this.hash(`${clientRequestId}:${canonicalKey}`).slice(0, 48)}`;
  }
}
