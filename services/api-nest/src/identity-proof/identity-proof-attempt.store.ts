import { Injectable } from '@nestjs/common';

export type IdentityAttemptState =
  | 'starting'
  | 'pending'
  | 'reporting'
  | 'approved'
  | 'failed'
  | 'expired'
  | 'superseded';

export type IdentityAttemptFinalError = {
  statusCode: number;
  body: Record<string, unknown>;
};

export type IdentityAttemptRecord = {
  attemptTokenHash: string;
  attemptToken?: string;
  clientRequestId: string;
  canonicalKey: string;
  destinationHash: string;
  role: string;
  channel: string;
  provider?: string;
  providerReference?: string;
  customerReference: string;
  issuedAt: string;
  expiresAt: string;
  state: IdentityAttemptState;
  startResponse?: Record<string, unknown>;
  finalResult?: Record<string, unknown>;
  finalError?: IdentityAttemptFinalError;
};

type LockEntry = { promise: Promise<unknown>; createdAt: number };

const FINAL_STATES: IdentityAttemptState[] = ['approved', 'failed', 'expired', 'superseded'];

@Injectable()
export class IdentityProofAttemptStore {
  private readonly byTokenHash = new Map<string, IdentityAttemptRecord>();
  private readonly activeByCanonicalKey = new Map<string, string>();
  private readonly byClientRequestId = new Map<string, string>();
  private readonly startLocks = new Map<string, LockEntry>();
  private readonly reportLocks = new Map<string, LockEntry>();

  getByTokenHash(tokenHash: string): IdentityAttemptRecord | undefined {
    return this.byTokenHash.get(tokenHash);
  }

  getByClientRequestId(clientRequestId: string): IdentityAttemptRecord | undefined {
    const tokenHash = this.byClientRequestId.get(clientRequestId);
    return tokenHash ? this.byTokenHash.get(tokenHash) : undefined;
  }

  getActive(canonicalKey: string, now = Date.now()): IdentityAttemptRecord | undefined {
    const tokenHash = this.activeByCanonicalKey.get(canonicalKey);
    const record = tokenHash ? this.byTokenHash.get(tokenHash) : undefined;
    if (!record) return undefined;
    if (Date.parse(record.expiresAt) <= now || FINAL_STATES.includes(record.state)) {
      this.activeByCanonicalKey.delete(canonicalKey);
      return undefined;
    }
    return record;
  }

  save(record: IdentityAttemptRecord): IdentityAttemptRecord {
    this.byTokenHash.set(record.attemptTokenHash, record);
    this.byClientRequestId.set(record.clientRequestId, record.attemptTokenHash);
    if (!FINAL_STATES.includes(record.state) && record.attemptToken) {
      this.activeByCanonicalKey.set(record.canonicalKey, record.attemptTokenHash);
    } else if (this.activeByCanonicalKey.get(record.canonicalKey) === record.attemptTokenHash) {
      this.activeByCanonicalKey.delete(record.canonicalKey);
    }
    return record;
  }

  update(tokenHash: string, patch: Partial<IdentityAttemptRecord>): IdentityAttemptRecord | undefined {
    const current = this.byTokenHash.get(tokenHash);
    if (!current) return undefined;
    return this.save({ ...current, ...patch });
  }

  supersede(tokenHash: string): void {
    const current = this.byTokenHash.get(tokenHash);
    if (!current) return;
    this.update(tokenHash, { state: 'superseded' });
  }

  runStartSingleFlight<T>(key: string, task: () => Promise<T>): Promise<T> {
    return this.runSingleFlight(this.startLocks, key, task);
  }

  runReportSingleFlight<T>(key: string, task: () => Promise<T>): Promise<T> {
    return this.runSingleFlight(this.reportLocks, key, task);
  }

  clearForTests(): void {
    this.byTokenHash.clear();
    this.activeByCanonicalKey.clear();
    this.byClientRequestId.clear();
    this.startLocks.clear();
    this.reportLocks.clear();
  }

  private runSingleFlight<T>(locks: Map<string, LockEntry>, key: string, task: () => Promise<T>): Promise<T> {
    const existing = locks.get(key);
    if (existing) return existing.promise as Promise<T>;
    const promise = task().finally(() => locks.delete(key));
    locks.set(key, { promise, createdAt: Date.now() });
    return promise;
  }
}
